import { SupabaseClient } from '@supabase/supabase-js';

let Stripe: any;
try {
  Stripe = require('stripe').default || require('stripe');
} catch {
  console.error('[Stripe] stripe package not installed');
}

function parsePriceToCents(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return 0;
  return Math.round(num * 100);
}

function tierKey(tier: string): string {
  return tier.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export class StripeService {
  private stripe: any;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    if (!Stripe) {
      throw new Error('stripe npm package not available');
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.supabase = supabase;
  }

  // ─── 1. ONBOARDING ──────────────────────────────────────────

  async createConnectedAccount(
    userId: string,
    email: string,
    businessName?: string,
    returnUrl?: string
  ): Promise<{ accountId: string; onboardingUrl: string }> {
    const existing = await this.getAccountByUserId(userId);
    if (existing) {
      if (!existing.onboarding_complete) {
        const link = await this.createAccountLink(existing.stripe_account_id, returnUrl);
        return { accountId: existing.stripe_account_id, onboardingUrl: link };
      }
      return { accountId: existing.stripe_account_id, onboardingUrl: '' };
    }

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
        product_description: 'Freelance services via Zelrex',
      },
      metadata: { zelrex_user_id: userId, platform: 'zelrex' },
    });

    await this.supabase.from('stripe_accounts').insert({
      user_id: userId,
      stripe_account_id: account.id,
      business_name: businessName || null,
      onboarding_complete: false,
      charges_enabled: false,
      payouts_enabled: false,
    });

    const onboardingUrl = await this.createAccountLink(account.id, returnUrl);
    return { accountId: account.id, onboardingUrl };
  }

  private async createAccountLink(accountId: string, returnUrl?: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/stripe/onboard?refresh=true`,
      return_url: returnUrl || `${baseUrl}/api/stripe/callback`,
      type: 'account_onboarding',
    });
    return link.url;
  }

  // ─── 2. CALLBACK ────────────────────────────────────────────

  async handleOnboardingCallback(accountId: string) {
    const account = await this.stripe.accounts.retrieve(accountId);
    const complete = account.details_submitted ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    await this.supabase
      .from('stripe_accounts')
      .update({ onboarding_complete: complete, charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled })
      .eq('stripe_account_id', accountId);

    return { complete, chargesEnabled, payoutsEnabled };
  }

  // ─── 3. CREATE PRODUCTS FROM OFFER ──────────────────────────

  async createProductsFromOffer(userId: string, offer: any) {
    const account = await this.getAccountByUserId(userId);
    if (!account) throw new Error('No Stripe account found. Connect Stripe first.');
    if (!account.charges_enabled) throw new Error('Stripe account not fully set up.');

    const products: any[] = [];

    for (const tier of (offer.pricing_tiers || [])) {
      const amount = parsePriceToCents(tier.price);
      if (amount === 0) continue;

      const product = await this.stripe.products.create(
        {
          name: `${offer.offer_name} — ${tier.tier}`,
          description: tier.description || tier.tier,
          metadata: { zelrex_user_id: userId, zelrex_tier: tier.tier },
        },
        { stripeAccount: account.stripe_account_id }
      );

      const price = await this.stripe.prices.create(
        { product: product.id, unit_amount: amount, currency: 'usd' },
        { stripeAccount: account.stripe_account_id }
      );

      products.push({ tier: tier.tier, product_id: product.id, price_id: price.id, amount });
    }

    await this.supabase
      .from('stripe_accounts')
      .update({ stripe_products: products })
      .eq('user_id', userId);

    return products;
  }

  // ─── 4. CREATE PAYMENT LINKS ────────────────────────────────

  async createPaymentLinks(userId: string): Promise<Record<string, string>> {
    const account = await this.getAccountByUserId(userId);
    if (!account) throw new Error('No Stripe account found.');

    const products = account.stripe_products || [];
    if (products.length === 0) throw new Error('No products created yet.');

    const urls: Record<string, string> = {};

    for (const product of products) {
      const link = await this.stripe.paymentLinks.create(
        {
          line_items: [{ price: product.price_id, quantity: 1 }],
          metadata: { zelrex_user_id: userId, zelrex_tier: product.tier },
        },
        { stripeAccount: account.stripe_account_id }
      );
      urls[tierKey(product.tier)] = link.url;
    }

    await this.supabase
      .from('stripe_accounts')
      .update({ checkout_urls: urls })
      .eq('user_id', userId);

    return urls;
  }

  // ─── 5. ACCOUNT STATUS ─────────────────────────────────────

  async getAccountStatus(userId: string) {
    const account = await this.getAccountByUserId(userId);

    if (!account) {
      return {
        connected: false, onboardingComplete: false, chargesEnabled: false,
        payoutsEnabled: false, stripeAccountId: null, hasProducts: false, checkoutUrls: {},
      };
    }

    try {
      const sa = await this.stripe.accounts.retrieve(account.stripe_account_id);
      const chargesEnabled = sa.charges_enabled ?? false;
      const payoutsEnabled = sa.payouts_enabled ?? false;
      const onboardingComplete = sa.details_submitted ?? false;

      if (chargesEnabled !== account.charges_enabled || payoutsEnabled !== account.payouts_enabled || onboardingComplete !== account.onboarding_complete) {
        await this.supabase.from('stripe_accounts').update({
          charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled, onboarding_complete: onboardingComplete,
        }).eq('user_id', userId);
      }

      return {
        connected: true, onboardingComplete, chargesEnabled, payoutsEnabled,
        stripeAccountId: account.stripe_account_id,
        hasProducts: (account.stripe_products || []).length > 0,
        checkoutUrls: account.checkout_urls || {},
      };
    } catch (e) {
      return {
        connected: true, onboardingComplete: account.onboarding_complete,
        chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled,
        stripeAccountId: account.stripe_account_id,
        hasProducts: (account.stripe_products || []).length > 0,
        checkoutUrls: account.checkout_urls || {},
      };
    }
  }

  // ─── DB HELPERS ─────────────────────────────────────────────

  private async getAccountByUserId(userId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') console.error('[Stripe] DB lookup:', error);
    return data || null;
  }
}