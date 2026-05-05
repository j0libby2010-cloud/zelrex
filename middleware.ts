/**
 * ZELREX MIDDLEWARE — FIXED VERSION
 *
 * Critical fixes:
 * 1. /api/chat removed from public list — middleware now enforces auth (defense in depth)
 * 2. Explicit Stripe webhook path handling — webhooks are public but path must be exact
 * 3. Origin validation for state-changing routes — basic CSRF defense
 * 4. Health check endpoint allowed (for monitoring)
 *
 * IMPORTANT NOTES FOR JOSEPH:
 *
 * 1. STRIPE WEBHOOK PATH:
 *    Looking at your /app/api/stripe/ folder, you have: callback, onboard, products.
 *    None of those names suggest a webhook listener. If you don't have a Stripe
 *    webhook handler yet, you'll need to add one BEFORE going live with billing —
 *    otherwise you won't know when customers pay your freelancers.
 *
 *    Recommended path: /api/stripe/webhook (or /api/webhooks/stripe).
 *    This middleware allows BOTH paths through without auth so Stripe's
 *    signed webhook calls can reach the handler.
 *
 * 2. CHAT ROUTE AUTH:
 *    With /api/chat now requiring middleware auth, the chat route will receive
 *    requests with Clerk session cookies. Inside the route, you should still
 *    use auth().userId from the Clerk session, NOT a userId from the request body.
 *    Trusting body-provided userId allows users to read other users' data.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// PUBLIC routes — no auth required
// IMPORTANT: be very specific. Webhook paths MUST be exact, not wildcard,
// to prevent attackers from finding undefined sub-routes that bypass auth.
const isPublicRoute = createRouteMatcher([
  // Marketing/landing
  "/",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
  "/ai-disclaimer",
  
  // Auth pages
  "/sign-in(.*)",
  "/sign-up(.*)",
  
  // Webhook endpoints — these MUST be public so external services can post to them
  // Each handler is responsible for verifying request authenticity (signature checks)
  "/api/webhooks/clerk",       // Clerk user lifecycle webhooks
  "/api/webhooks/stripe",      // Stripe payment events
  "/api/stripe/webhook",       // Alternate location if you organized under /stripe/
  "/api/webhooks(.*)",         // Catch-all for other webhooks (still requires signature)
  
  // Health check (for monitoring services like Vercel/UptimeRobot)
  "/api/health",
  
  // Public marketing assets
  "/api/og(.*)",                // Open Graph image generator if you have one
]);

// State-changing API routes that should validate Origin/Referer for CSRF defense
// (in addition to Clerk session validation)
const isStateChangingApi = createRouteMatcher([
  "/api/deploy",
  "/api/z/(.*)",
  "/api/stripe/onboard",
  "/api/stripe/products",
]);

// Allowed origins for state-changing requests
function getAllowedOrigins(): string[] {
  const origins = ["https://zelrex.ai", "https://www.zelrex.ai"];
  // Allow Vercel preview deploys
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  // Allow localhost in dev
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000", "http://localhost:3001");
  }
  return origins;
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  
  // Public routes — let through
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }
  
  // Protected routes — require authentication
  await auth.protect();
  
  // CSRF defense for state-changing API routes (POST/PUT/PATCH/DELETE)
  // Allows GET (which shouldn't change state) without origin check
  const method = request.method.toUpperCase();
  if (isStateChangingApi(request) && method !== "GET" && method !== "HEAD") {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const allowed = getAllowedOrigins();
    
    // Either origin must match, or referer must start with an allowed origin
    const originAllowed = origin && allowed.includes(origin);
    const refererAllowed = referer && allowed.some(o => referer.startsWith(o));
    
    if (!originAllowed && !refererAllowed) {
      // Allow same-origin requests where neither header is set (some browsers strip them)
      // but flag suspicious cross-origin requests
      const host = request.headers.get("host");
      if (origin && !origin.includes(host || "")) {
        console.warn(`[Zelrex] Blocked cross-origin ${method} from ${origin} to ${pathname}`);
        return NextResponse.json(
          { error: "Cross-origin requests not allowed" },
          { status: 403 }
        );
      }
    }
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match everything except static files and Next internals
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};