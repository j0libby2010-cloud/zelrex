import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StripeService } from '@/lib/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripeService = new StripeService(supabase);

/**
 * POST /api/stripe/onboard
 *
 * Starts the Stripe Connect onboarding flow for a user.
 * Creates an Express account and returns a URL to redirect them to.
 *
 * Body: { userId: string, email: string, businessName?: string }
 * Returns: { onboardingUrl: string, accountId: string }
 */
export async function POST(req: Request) {
  try {
    const { userId, email, businessName } = await req.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';
    const returnUrl = `${baseUrl}/api/stripe/callback?user_id=${userId}`;

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
  } catch (error) {
    console.error('[Stripe Onboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start Stripe onboarding. Try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/onboard?refresh=true
 *
 * Stripe redirects here if the onboarding link expires.
 * We create a fresh link and redirect them back.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get('refresh');

  if (refresh) {
    // For now, redirect to chat with a message
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';
    return NextResponse.redirect(`${baseUrl}/chat?stripe=refresh`);
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
