import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StripeService } from '@/lib/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripeService = new StripeService(supabase);

/**
 * POST /api/stripe/products
 *
 * Takes the user's offer data (from Zelrex offer engineering) and
 * creates bespoke Stripe Products, Prices, and Payment Links on
 * their connected account.
 *
 * This is the magic — it turns a Zelrex offer into real, chargeable
 * payment links automatically.
 *
 * Body: {
 *   userId: string,
 *   offer: {
 *     offer_name: string,
 *     target_audience: string,
 *     pricing_tiers: [{ tier, price, description }],
 *     included: string,
 *     turnaround: string,
 *     business_name: string
 *   },
 *   websiteUrl?: string  // The deployed website URL for success/cancel redirects
 * }
 *
 * Returns: {
 *   products: [{ tier, product_id, price_id, amount }],
 *   paymentLinks: { starter: "https://...", standard: "https://...", premium: "https://..." }
 * }
 */
export async function POST(req: Request) {
  try {
    const { userId, offer, websiteUrl } = await req.json();

    if (!userId || !offer || !offer.pricing_tiers) {
      return NextResponse.json(
        { error: 'userId and offer with pricing_tiers are required' },
        { status: 400 }
      );
    }

    // 1. Create Products + Prices on the connected account
    console.log(`[Stripe Products] Creating for user ${userId}: "${offer.offer_name}" with ${offer.pricing_tiers.length} tiers`);

    const products = await stripeService.createProductsFromOffer(userId, offer);

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'Could not create any products — check that pricing tiers have valid dollar amounts (e.g. "$400", "$1,500").' },
        { status: 400 }
      );
    }

    // 2. Create permanent Payment Links (better than sessions for websites)
    const paymentLinks = await stripeService.createPaymentLinks(userId);

    console.log(`[Stripe Products] Created ${products.length} products and ${Object.keys(paymentLinks).length} payment links`);

    return NextResponse.json({
      products,
      paymentLinks,
      message: `Created ${products.length} products with payment links. These are live on your Stripe account and ready to accept payments.`,
    });
  } catch (error) {
    console.error('[Stripe Products] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to create products.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/products?userId=xxx
 *
 * Returns the user's current Stripe account status, products, and payment links.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const status = await stripeService.getAccountStatus(userId);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[Stripe Products GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get Stripe status.' },
      { status: 500 }
    );
  }
}
