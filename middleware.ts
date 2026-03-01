/**
 * ZELREX MIDDLEWARE
 * 
 * Protects routes using Clerk authentication.
 * - /chat → requires auth (redirect to /sign-in)
 * - /sign-in, /sign-up → public
 * - /api/webhooks → public (Clerk webhooks)
 * - Everything else → public
 */

import { authMiddleware } from "@clerk/nextjs/server";

export default authMiddleware({
  // Routes that don't require authentication
  publicRoutes: [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/webhooks(.*)",
    "/api/chat",         // Chat API handles its own auth check
  ],
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
