/**
 * ZELREX SENTRY INTEGRATION
 * 
 * Centralized error monitoring for Zelrex platform.
 * Catches unhandled exceptions, API errors, and React crashes.
 * Alerts you via email/Slack when things break in production.
 * 
 * SETUP:
 * 1. Sign up at sentry.io (free tier = 5k errors/month)
 * 2. Create a Next.js project in Sentry
 * 3. Run: npm install @sentry/nextjs
 * 4. Run: npx @sentry/wizard@latest -i nextjs
 *    (This auto-creates sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts)
 * 5. Add these env vars in Vercel:
 *    - SENTRY_DSN (from Sentry project settings)
 *    - SENTRY_ORG (your org slug)
 *    - SENTRY_PROJECT (your project slug)
 *    - SENTRY_AUTH_TOKEN (for source maps, from Sentry settings)
 * 6. In Sentry project settings, set up alert rules:
 *    - Email when error count > 5 in 1 hour
 *    - Slack integration for critical errors
 * 
 * USAGE:
 * import { captureError, captureMessage } from '@/lib/sentry';
 * 
 * try { ... } catch (e) { captureError(e, { userId, action: 'create-invoice' }); }
 */

// Lazy-load Sentry so it doesn't crash if not installed
let Sentry: any = null;
try {
  Sentry = require('@sentry/nextjs');
} catch {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Sentry] @sentry/nextjs not installed — error monitoring disabled');
  }
}

interface ErrorContext {
  userId?: string;
  action?: string;
  route?: string;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

/**
 * Capture an error with context. Use this in catch blocks and error handlers.
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  
  // Always log to console in dev
  if (process.env.NODE_ENV === 'development') {
    console.error('[Zelrex Error]', err.message, context);
  }
  
  if (!Sentry) return;
  
  try {
    Sentry.withScope((scope: any) => {
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.action) scope.setTag('action', context.action);
      if (context.route) scope.setTag('route', context.route);
      if (context.tags) {
        for (const [k, v] of Object.entries(context.tags)) {
          scope.setTag(k, v);
        }
      }
      if (context.metadata) scope.setContext('metadata', context.metadata);
      if (context.level) scope.setLevel(context.level);
      
      Sentry.captureException(err);
    });
  } catch {}
}

/**
 * Capture a non-error message (warnings, important events).
 */
export function captureMessage(message: string, context: ErrorContext = {}): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Zelrex Message]', message, context);
  }
  
  if (!Sentry) return;
  
  try {
    Sentry.withScope((scope: any) => {
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.action) scope.setTag('action', context.action);
      if (context.route) scope.setTag('route', context.route);
      if (context.tags) {
        for (const [k, v] of Object.entries(context.tags)) {
          scope.setTag(k, v);
        }
      }
      if (context.metadata) scope.setContext('metadata', context.metadata);
      scope.setLevel(context.level || 'info');
      
      Sentry.captureMessage(message);
    });
  } catch {}
}

/**
 * Wrap an async function with automatic error capture.
 * Any thrown error will be captured and re-thrown.
 */
export function withErrorCapture<T>(
  fn: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T> {
  return fn().catch((err) => {
    captureError(err, context);
    throw err;
  });
}

/**
 * Add breadcrumb (low-level events that led up to an error).
 * Useful for tracing what happened before a crash.
 */
export function addBreadcrumb(message: string, category: string = 'zelrex', data?: Record<string, any>): void {
  if (!Sentry) return;
  
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  } catch {}
}

/**
 * Set user context for all subsequent error captures in this request.
 * Call at the start of API routes.
 */
export function setSentryUser(userId: string, email?: string): void {
  if (!Sentry) return;
  
  try {
    Sentry.setUser({ id: userId, email });
  } catch {}
}

/**
 * Clear user context (call on sign-out).
 */
export function clearSentryUser(): void {
  if (!Sentry) return;
  
  try {
    Sentry.setUser(null);
  } catch {}
}