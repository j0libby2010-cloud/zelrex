/**
 * ZELREX ENVIRONMENT VARIABLE HANDLING
 * 
 * Centralizes all env var access with validation. Instead of using
 * `process.env.X!` (which crashes the server at startup if X is missing),
 * this provides:
 *   - Runtime validation with clear error messages
 *   - Type safety
 *   - Graceful degradation where possible
 *   - Single source of truth for what env vars Zelrex needs
 * 
 * Usage:
 *   import { env, requireEnv } from '@/lib/env';
 *   const key = env.ANTHROPIC_API_KEY;   // may be null
 *   const key = requireEnv('ANTHROPIC_API_KEY');  // throws with clear message if missing
 */

type EnvShape = {
  // Anthropic
  ANTHROPIC_API_KEY: string | null;
  ANTHROPIC_MODEL_OPUS: string;      // defaults to claude-opus-4-6
  ANTHROPIC_MODEL_SONNET: string;    // defaults to claude-sonnet-4-20250514
  ANTHROPIC_MODEL_HAIKU: string;     // defaults to claude-haiku-4-5-20251001

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string | null;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string | null;
  SUPABASE_SERVICE_ROLE_KEY: string | null;

  // Clerk
  CLERK_SECRET_KEY: string | null;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string | null;

  // Stripe
  STRIPE_SECRET_KEY: string | null;
  STRIPE_WEBHOOK_SECRET: string | null;

  // Vercel
  VERCEL_TOKEN: string | null;
  VERCEL_TEAM_ID: string | null;

  // Infrastructure
  CRON_SECRET: string | null;
  ADMIN_USER_ID: string | null;
  NEXT_PUBLIC_APP_URL: string;

  // Optional integrations
  SENTRY_DSN: string | null;
  SENTRY_ORG: string | null;
  SENTRY_PROJECT: string | null;
  SENTRY_AUTH_TOKEN: string | null;
  RESEND_API_KEY: string | null;
  FROM_EMAIL: string;

  // Runtime
  NODE_ENV: 'development' | 'production' | 'test';
};

function getEnv(key: string): string | null {
  const val = process.env[key];
  if (!val || val.trim() === '') return null;
  return val;
}

export const env: EnvShape = {
  ANTHROPIC_API_KEY: getEnv('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL_OPUS: getEnv('ANTHROPIC_MODEL_OPUS') || 'claude-opus-4-6',
  ANTHROPIC_MODEL_SONNET: getEnv('ANTHROPIC_MODEL_SONNET') || 'claude-sonnet-4-20250514',
  ANTHROPIC_MODEL_HAIKU: getEnv('ANTHROPIC_MODEL_HAIKU') || 'claude-haiku-4-5-20251001',

  NEXT_PUBLIC_SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY'),

  CLERK_SECRET_KEY: getEnv('CLERK_SECRET_KEY'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: getEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),

  STRIPE_SECRET_KEY: getEnv('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: getEnv('STRIPE_WEBHOOK_SECRET'),

  VERCEL_TOKEN: getEnv('VERCEL_TOKEN'),
  VERCEL_TEAM_ID: getEnv('VERCEL_TEAM_ID'),

  CRON_SECRET: getEnv('CRON_SECRET'),
  ADMIN_USER_ID: getEnv('ADMIN_USER_ID'),
  NEXT_PUBLIC_APP_URL: getEnv('NEXT_PUBLIC_APP_URL') || 'https://zelrex.ai',

  SENTRY_DSN: getEnv('SENTRY_DSN'),
  SENTRY_ORG: getEnv('SENTRY_ORG'),
  SENTRY_PROJECT: getEnv('SENTRY_PROJECT'),
  SENTRY_AUTH_TOKEN: getEnv('SENTRY_AUTH_TOKEN'),
  RESEND_API_KEY: getEnv('RESEND_API_KEY'),
  FROM_EMAIL: getEnv('FROM_EMAIL') || 'noreply@zelrex.ai',

  NODE_ENV: (process.env.NODE_ENV as any) || 'development',
};

/**
 * Require an env var. Throws a clear error if missing.
 * Use this in the body of route handlers — it'll return a clean 500 instead of crashing the server.
 */
export function requireEnv(key: keyof EnvShape): string {
  const val = env[key];
  if (!val) {
    throw new Error(`[Zelrex Config] Missing required env var: ${key}. Add it to your Vercel project settings or .env.local.`);
  }
  return val as string;
}

/**
 * Check if all critical env vars are present.
 * Useful for health check endpoints.
 */
export function checkCriticalEnv(): { ok: boolean; missing: string[] } {
  const critical: (keyof EnvShape)[] = [
    'ANTHROPIC_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLERK_SECRET_KEY',
  ];
  const missing = critical.filter(k => !env[k]);
  return { ok: missing.length === 0, missing };
}

/**
 * Check if Supabase is configured (common check).
 */
export function isSupabaseConfigured(): boolean {
  return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Check if Anthropic is configured.
 */
export function isAnthropicConfigured(): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

/**
 * Dev-only logging. Won't leak in production.
 */
export function devLog(...args: any[]): void {
  if (env.NODE_ENV === 'development') {
    console.log(...args);
  }
}