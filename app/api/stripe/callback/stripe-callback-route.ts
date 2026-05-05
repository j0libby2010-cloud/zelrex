// app/api/stripe/callback/route.ts
//
// FIXED VERSION
//
// Critical fixes from previous version:
// 1. AUTHENTICATION — uses Clerk auth() to verify the request comes from a logged-in user
// 2. NO MORE URL PARAM TRUST — userId comes from Clerk session, not from URL
// 3. CROSS-USER PROTECTION — even if URL has user_id, we verify it matches session
// 4. ERROR HANDLING — distinguishes auth errors from Stripe errors from system errors
//
// PREVIOUS VULNERABILITY: Anyone could craft a request with user_id=BOB_ID and
// trigger callbacks for any user. Could probe other users' Stripe states and
// fire side effects in handleOnboardingCallback.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { StripeService } from '@/lib/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripeService = new StripeService(supabase);

/**
 * GET /api/stripe/callback
 *
 * Stripe redirects the user here after they complete (or exit) the
 * Express onboarding flow. The user MUST be logged in via Clerk —
 * otherwise the redirect goes to sign-in.
 *
 * userId is taken from Clerk session, NOT from URL params.
 */
export async function GET(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';

  // FIXED: Require authenticated user
  const { userId } = auth();
  if (!userId) {
    // User isn't logged in — redirect to sign-in. They can't access /chat anyway.
    return NextResponse.redirect(`${baseUrl}/sign-in?redirect_url=${encodeURIComponent('/chat')}`);
  }

  // FIXED: Backwards compatibility check
  // The old version of this route passed user_id in the URL. If a stale link
  // is followed and the user_id doesn't match the session, that's a sign of
  // either an old link or a tampering attempt — either way, ignore the URL param
  // and use the Clerk session.
  const url = new URL(req.url);
  const userIdFromUrl = url.searchParams.get('user_id');
  if (userIdFromUrl && userIdFromUrl !== userId) {
    console.warn(
      `[Stripe Callback] URL user_id (${userIdFromUrl.slice(0, 12)}...) doesn't match session. Using session.`
    );
    // Fall through — we use the Clerk session userId regardless
  }

  try {
    // Look up the user's Stripe account using the AUTHENTICATED userId
    const { data: account, error: lookupError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      console.error('[Stripe Callback] Account lookup error:', lookupError.message);
      return NextResponse.redirect(`${baseUrl}/chat?stripe=error`);
    }

    if (!account || !account.stripe_account_id) {
      // No Stripe account on file for this user — likely they exited onboarding
      // before the account was created, or they hit this route without ever
      // starting onboarding
      return NextResponse.redirect(`${baseUrl}/chat?stripe=incomplete`);
    }

    // Check the account status with Stripe
    let status: { complete?: boolean; chargesEnabled?: boolean };
    try {
      status = await stripeService.handleOnboardingCallback(account.stripe_account_id);
    } catch (stripeError: any) {
      console.error('[Stripe Callback] Stripe API error:', stripeError?.message);
      return NextResponse.redirect(`${baseUrl}/chat?stripe=error`);
    }

    // Distinguish three outcomes
    if (status.complete && status.chargesEnabled) {
      return NextResponse.redirect(`${baseUrl}/chat?stripe=connected`);
    }
    if (status.complete && !status.chargesEnabled) {
      // Onboarding done but Stripe is still verifying — they need to wait
      return NextResponse.redirect(`${baseUrl}/chat?stripe=pending`);
    }
    // Incomplete — they exited onboarding early
    return NextResponse.redirect(`${baseUrl}/chat?stripe=incomplete`);
  } catch (error: any) {
    console.error('[Stripe Callback] Unexpected error:', error?.message);
    return NextResponse.redirect(`${baseUrl}/chat?stripe=error`);
  }
}