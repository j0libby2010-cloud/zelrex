// app/api/stripe/onboard/route.ts
//
// FIXED VERSION
//
// Critical fixes from previous version:
// 1. AUTHENTICATION — uses Clerk auth() to verify the request comes from a logged-in user
// 2. NO MORE BODY userId — userId is taken from Clerk session, never trusted from body
// 3. EMAIL FROM CLERK — uses the verified email from Clerk session, not body
// 4. INPUT VALIDATION — businessName length cap, format checks
// 5. ERROR SANITIZATION — strips internal details from errors
// 6. RATE LIMITING — prevents onboarding spam
//
// PREVIOUS VULNERABILITY: Anyone could call this route with any userId and start
// a Stripe Connect onboarding for that user. An attacker could complete onboarding
// under their own bank details — when the victim's clients paid, money would go to
// the attacker's bank account.

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { StripeService } from '@/lib/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripeService = new StripeService(supabase);

// ─── Rate limiting ──────────────────────────────────────────────
// Prevents a single user from spamming onboarding requests.
// In-memory only — for serverless, consider Vercel KV for production.

const onboardingBuckets = new Map<string, { count: number; resetAt: number }>();
const ONBOARD_LIMIT_PER_HOUR = 5;

function checkRateLimit(userId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const bucket = onboardingBuckets.get(userId);
  if (!bucket || now > bucket.resetAt) {
    onboardingBuckets.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return { allowed: true };
  }
  bucket.count++;
  if (bucket.count > ONBOARD_LIMIT_PER_HOUR) {
    return { allowed: false, reason: `Too many onboarding attempts. Try again in an hour.` };
  }
  return { allowed: true };
}

// ─── Input validation ──────────────────────────────────────────

function validateBusinessName(name: any): { valid: boolean; cleaned?: string; reason?: string } {
  if (name === undefined || name === null || name === '') {
    return { valid: true, cleaned: '' }; // Optional field
  }
  if (typeof name !== 'string') {
    return { valid: false, reason: 'businessName must be a string' };
  }
  const cleaned = name.trim().slice(0, 200);
  if (cleaned.length === 0) {
    return { valid: true, cleaned: '' };
  }
  return { valid: true, cleaned };
}

// ─── Error sanitization ────────────────────────────────────────

function sanitizeError(message: string): string {
  if (!message) return "Failed to start Stripe onboarding";
  return String(message)
    .replace(/(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{15,}/g, "[REDACTED]")
    .replace(/(?:api[_-]?key|secret|token)[\s:=]+["']?[^\s"',]{6,}/gi, "[REDACTED]")
    .slice(0, 200);
}

/**
 * POST /api/stripe/onboard
 *
 * Starts the Stripe Connect onboarding flow for the AUTHENTICATED user.
 * userId is ALWAYS taken from the Clerk session, never from the request body.
 *
 * Body: { businessName?: string }
 * Returns: { onboardingUrl: string, accountId: string }
 */
export async function POST(req: Request) {
  // FIXED: Authentication required
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in.' },
      { status: 401 }
    );
  }

  // FIXED: Rate limiting
  const rl = checkRateLimit(userId);
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason }, { status: 429 });
  }

  try {
    // FIXED: Get email from Clerk session, not request body
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User session invalid. Please sign in again.' },
        { status: 401 }
      );
    }

    const email = user.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found on account. Please verify your email first.' },
        { status: 400 }
      );
    }

    // Parse body for businessName only (everything else comes from Clerk)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }

    const nameCheck = validateBusinessName(body.businessName);
    if (!nameCheck.valid) {
      return NextResponse.json({ error: nameCheck.reason }, { status: 400 });
    }
    const businessName = nameCheck.cleaned || '';

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';
    // Note: callback URL no longer includes user_id — the callback uses Clerk session
    const returnUrl = `${baseUrl}/api/stripe/callback`;

    const { accountId, onboardingUrl } = await stripeService.createConnectedAccount(
      userId,
      email,
      businessName,
      returnUrl
    );

    if (!onboardingUrl) {
      // Already onboarded
      return NextResponse.json({
        accountId,
        onboardingUrl: null,
        message: 'Stripe account already connected and active.',
      });
    }

    return NextResponse.json({ accountId, onboardingUrl });
  } catch (error: any) {
    console.error('[Stripe Onboard] Error:', error?.message);
    return NextResponse.json(
      { error: sanitizeError(error?.message) || 'Failed to start Stripe onboarding. Try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/onboard?refresh=true
 *
 * Stripe redirects here if the onboarding link expires.
 */
export async function GET(req: Request) {
  // Even GET should require auth
  const { userId } = auth();
  if (!userId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';
    return NextResponse.redirect(`${baseUrl}/sign-in`);
  }

  const url = new URL(req.url);
  const refresh = url.searchParams.get('refresh');

  if (refresh) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';
    return NextResponse.redirect(`${baseUrl}/chat?stripe=refresh`);
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}