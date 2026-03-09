import { NextResponse } from 'next/server';
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
 * Express onboarding flow. We check their account status and redirect
 * them back to the chat with a status parameter.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';

  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/chat?stripe=error`);
  }

  try {
    // Look up the user's Stripe account
    const { data: account } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!account) {
      return NextResponse.redirect(`${baseUrl}/chat?stripe=error`);
    }

    // Check the account status with Stripe
    const status = await stripeService.handleOnboardingCallback(
      account.stripe_account_id
    );

    if (status.complete && status.chargesEnabled) {
      // Success — account is ready to accept payments
      return NextResponse.redirect(`${baseUrl}/chat?stripe=connected`);
    } else {
      // Incomplete — they exited onboarding early
      return NextResponse.redirect(`${baseUrl}/chat?stripe=incomplete`);
    }
  } catch (error) {
    console.error('[Stripe Callback] Error:', error);
    return NextResponse.redirect(`${baseUrl}/chat?stripe=error`);
  }
}
