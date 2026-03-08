import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────
export interface PricingTier {
  tier: string;      // e.g. "Starter", "Standard", "Premium"
  price: string;     // e.g. "$400", "$700/video", "$1,100"
  description: string;
}

export interface OfferForStripe {
  offer_name: string;
  target_audience: string;
  pricing_tiers: PricingTier[];
  included: string;
  turnaround: string;
  business_name: string;
}

export interface StripeAccountRecord {
  id: string;
  user_id: string;
  stripe_account_id: string;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  business_name: string | null;
  stripe_products: StripeProductRecord[];
  checkout_urls: Record<string, string>;
}

export interface StripeProductRecord {
  tier: string;
  product_id: string;
  price_id: string;
  amount: number; // in cents
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Parse a price string like "$400", "$700/video", "$1,100/month", "$2,500"
 * into cents. Returns 0 if it can't parse.
 */
function parsePriceToCents(priceStr: string): number {
  // Remove everything except digits, dots, and commas
  const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return 0;
  return Math.round(num * 100);
}

/**
 * Normalize a tier name into a URL-safe key: "Standard" → "standard"
 */
function tierKey(tier: string): string {
  return tier.toLowerCase().replace(/[^a-z0-9]/g, '_');
}


// ─── Service ─────────────────────────────────────────────────────

export class StripeService {
  private stripe: Stripe;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.supabase = supabase;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. ONBOARDING — Create Express account + onboarding link
  // ═══════════════════════════════════════════════════════════════

  /**
   * Creates a Stripe Express connected account for the user and returns
   * an Account Link URL that redirects them to Stripe's hosted onboarding.
   */
  async createConnectedAccount(
    userId: string,
    email: string,
    businessName?: string,
    returnUrl?: string
  ): Promise<{ accountId: string; onboardingUrl: string }> {

    // Check if user already has a connected account
    const existing = await this.getAccountByUserId(userId);
    if (existing) {
      // If they already have one but haven't finished onboarding, give them a new link
      if (!existing.onboarding_complete) {
        const link = await this.createAccountLink(
          existing.stripe_account_id,
          returnUrl
        );
        return { accountId: existing.stripe_account_id, onboardingUrl: link };
      }
      // Already fully onboarded
      return { accountId: existing.stripe_account_id, onboardingUrl: '' };
    }

    // Create the Express account on Stripe
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'US',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      business_profile: {
        name: businessName || undefined,
        product_description: 'Freelance services offered through Zelrex platform',
      },
      metadata: {
        zelrex_user_id: userId,
        platform: 'zelrex',
      },
    });

    // Save to database
    const { error } = await this.supabase.from('stripe_accounts').insert({
      user_id: userId,
      stripe_account_id: account.id,
      business_name: businessName || null,
      onboarding_complete: false,
      charges_enabled: false,
      payouts_enabled: false,
    });

    if (error) {
      console.error('[Stripe] Failed to save account:', error);
      // Don't throw — the Stripe account exists, we just failed to record it
    }

    // Create the onboarding link
    const onboardingUrl = await this.createAccountLink(account.id, returnUrl);

    return { accountId: account.id, onboardingUrl };
  }

  /**
   * Creates an Account Link for Stripe-hosted Express onboarding.
   * This is the URL you redirect the user to.
   */
  private async createAccountLink(
    accountId: string,
    returnUrl?: string
  ): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/stripe/onboard?refresh=true`,
      return_url: returnUrl || `${baseUrl}/api/stripe/callback`,
      type: 'account_onboarding',
    });
    return link.url;
  }


  // ═══════════════════════════════════════════════════════════════
  // 2. CALLBACK — Handle return from onboarding
  // ═══════════════════════════════════════════════════════════════

  /**
   * Called when the user returns from Stripe onboarding.
   * Checks if their account is fully set up and updates the database.
   */
  async handleOnboardingCallback(accountId: string): Promise<{
    complete: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }> {
    const account = await this.stripe.accounts.retrieve(accountId);

    const complete = account.details_submitted ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    await this.supabase
      .from('stripe_accounts')
      .update({
        onboarding_complete: complete,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
      })
      .eq('stripe_account_id', accountId);

    return { complete, chargesEnabled, payoutsEnabled };
  }


  // ═══════════════════════════════════════════════════════════════
  // 3. PRODUCTS — Create Stripe Products + Prices from offer tiers
  // ═══════════════════════════════════════════════════════════════

  /**
   * Takes the user's offer (from Zelrex's offer engineering) and creates
   * real Stripe Products and Prices on their connected account.
   * This is what makes each checkout bespoke to the user's business.
   */
  async createProductsFromOffer(
    userId: string,
    offer: OfferForStripe
  ): Promise<StripeProductRecord[]> {
    const account = await this.getAccountByUserId(userId);
    if (!account) throw new Error('No Stripe account found. Connect Stripe first.');
    if (!account.charges_enabled) throw new Error('Stripe account not fully set up yet.');

    const products: StripeProductRecord[] = [];

    for (const tier of offer.pricing_tiers) {
      const amount = parsePriceToCents(tier.price);
      if (amount === 0) {
        console.warn(`[Stripe] Could not parse price for tier "${tier.tier}": "${tier.price}". Skipping.`);
        continue;
      }

      // Create a Product on the user's connected account
      const product = await this.stripe.products.create(
        {
          name: `${offer.offer_name} — ${tier.tier}`,
          description: tier.description,
          metadata: {
            zelrex_user_id: userId,
            zelrex_tier: tier.tier,
            zelrex_offer: offer.offer_name,
          },
        },
        { stripeAccount: account.stripe_account_id }
      );

      // Create a Price for the product (one-time payment)
      const price = await this.stripe.prices.create(
        {
          product: product.id,
          unit_amount: amount,
          currency: 'usd',
        },
        { stripeAccount: account.stripe_account_id }
      );

      products.push({
        tier: tier.tier,
        product_id: product.id,
        price_id: price.id,
        amount,
      });
    }

    // Save products to database
    await this.supabase
      .from('stripe_accounts')
      .update({ stripe_products: products })
      .eq('user_id', userId);

    return products;
  }


  // ═══════════════════════════════════════════════════════════════
  // 4. CHECKOUT — Create bespoke Checkout Sessions
  // ═══════════════════════════════════════════════════════════════

  /**
   * Creates a Stripe Checkout Session for a specific tier on the user's
   * connected account. The checkout page is fully branded with the
   * user's business name and offer details.
   *
   * This is what gets embedded in the user's website.
   */
  async createCheckoutSession(
    userId: string,
    tierName: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<string> {
    const account = await this.getAccountByUserId(userId);
    if (!account) throw new Error('No Stripe account found.');
    if (!account.charges_enabled) throw new Error('Stripe account not ready for charges.');

    // Find the matching product/price for this tier
    const products = account.stripe_products || [];
    const tier = products.find(
      (p) => p.tier.toLowerCase() === tierName.toLowerCase()
    );

    if (!tier) {
      throw new Error(
        `No Stripe product found for tier "${tierName}". Available tiers: ${products.map((p) => p.tier).join(', ')}`
      );
    }

    // Determine URLs — default to the user's deployed website
    const baseUrl = successUrl?.replace(/\/success.*/, '') || 'https://zelrex.ai';

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price: tier.price_id,
            quantity: 1,
          },
        ],
        payment_intent_data: {
          // Optional: take an application fee for Zelrex (add later)
          // application_fee_amount: Math.round(tier.amount * 0.05), // 5% platform fee
        },
        success_url: successUrl || `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${baseUrl}/#pricing`,
        metadata: {
          zelrex_user_id: userId,
          zelrex_tier: tierName,
        },
      },
      { stripeAccount: account.stripe_account_id }
    );

    return session.url || '';
  }

  /**
   * Creates checkout URLs for ALL tiers and stores them.
   * This is called after products are created, and the URLs are
   * injected into the user's website.
   */
  async createAllCheckoutUrls(
    userId: string,
    websiteUrl?: string
  ): Promise<Record<string, string>> {
    const account = await this.getAccountByUserId(userId);
    if (!account) throw new Error('No Stripe account found.');

    const products = account.stripe_products || [];
    if (products.length === 0) {
      throw new Error('No products created yet. Design your offer first.');
    }

    const baseUrl = websiteUrl || 'https://zelrex.ai';
    const urls: Record<string, string> = {};

    for (const product of products) {
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [{ price: product.price_id, quantity: 1 }],
          success_url: `${baseUrl}/success?tier=${tierKey(product.tier)}`,
          cancel_url: `${baseUrl}/#pricing`,
          metadata: {
            zelrex_user_id: userId,
            zelrex_tier: product.tier,
          },
        },
        { stripeAccount: account.stripe_account_id }
      );

      urls[tierKey(product.tier)] = session.url || '';
    }

    // Store the URLs
    await this.supabase
      .from('stripe_accounts')
      .update({ checkout_urls: urls })
      .eq('user_id', userId);

    return urls;
  }


  // ═══════════════════════════════════════════════════════════════
  // 5. PAYMENT LINKS (alternative to sessions — longer-lived)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Creates Stripe Payment Links for each tier. Unlike Checkout Sessions
   * (which expire after 24h), Payment Links are permanent and reusable.
   * These are better for embedding in websites.
   */
  async createPaymentLinks(
    userId: string
  ): Promise<Record<string, string>> {
    const account = await this.getAccountByUserId(userId);
    if (!account) throw new Error('No Stripe account found.');

    const products = account.stripe_products || [];
    if (products.length === 0) {
      throw new Error('No products created yet.');
    }

    const urls: Record<string, string> = {};

    for (const product of products) {
      const link = await this.stripe.paymentLinks.create(
        {
          line_items: [{ price: product.price_id, quantity: 1 }],
          metadata: {
            zelrex_user_id: userId,
            zelrex_tier: product.tier,
          },
          // Optional: enable adjustable quantity
          // line_items: [{ price: product.price_id, adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 } }],
        },
        { stripeAccount: account.stripe_account_id }
      );

      urls[tierKey(product.tier)] = link.url;
    }

    // Store the permanent URLs
    await this.supabase
      .from('stripe_accounts')
      .update({ checkout_urls: urls })
      .eq('user_id', userId);

    return urls;
  }


  // ═══════════════════════════════════════════════════════════════
  // 6. ACCOUNT STATUS — Check if ready for payments
  // ═══════════════════════════════════════════════════════════════

  /**
   * Returns the current status of the user's Stripe Connect account.
   * Used by the frontend to show connection status and enable/disable features.
   */
  async getAccountStatus(userId: string): Promise<{
    connected: boolean;
    onboardingComplete: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    stripeAccountId: string | null;
    hasProducts: boolean;
    checkoutUrls: Record<string, string>;
  }> {
    const account = await this.getAccountByUserId(userId);

    if (!account) {
      return {
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        stripeAccountId: null,
        hasProducts: false,
        checkoutUrls: {},
      };
    }

    // Refresh status from Stripe (in case it changed)
    try {
      const stripeAccount = await this.stripe.accounts.retrieve(
        account.stripe_account_id
      );
      const chargesEnabled = stripeAccount.charges_enabled ?? false;
      const payoutsEnabled = stripeAccount.payouts_enabled ?? false;
      const onboardingComplete = stripeAccount.details_submitted ?? false;

      // Update DB if changed
      if (
        chargesEnabled !== account.charges_enabled ||
        payoutsEnabled !== account.payouts_enabled ||
        onboardingComplete !== account.onboarding_complete
      ) {
        await this.supabase
          .from('stripe_accounts')
          .update({
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            onboarding_complete: onboardingComplete,
          })
          .eq('user_id', userId);
      }

      return {
        connected: true,
        onboardingComplete,
        chargesEnabled,
        payoutsEnabled,
        stripeAccountId: account.stripe_account_id,
        hasProducts: (account.stripe_products || []).length > 0,
        checkoutUrls: account.checkout_urls || {},
      };
    } catch (e) {
      console.error('[Stripe] Failed to refresh account status:', e);
      return {
        connected: true,
        onboardingComplete: account.onboarding_complete,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        stripeAccountId: account.stripe_account_id,
        hasProducts: (account.stripe_products || []).length > 0,
        checkoutUrls: account.checkout_urls || {},
      };
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // DB HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async getAccountByUserId(
    userId: string
  ): Promise<StripeAccountRecord | null> {
    const { data, error } = await this.supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Stripe] DB lookup failed:', error);
    }
    return data || null;
  }

  async getAccountByStripeId(
    stripeAccountId: string
  ): Promise<StripeAccountRecord | null> {
    const { data, error } = await this.supabase
      .from('stripe_accounts')
      .select('*')
      .eq('stripe_account_id', stripeAccountId)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Stripe] DB lookup failed:', error);
    }
    return data || null;
  }
}