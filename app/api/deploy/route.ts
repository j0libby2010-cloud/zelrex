// app/api/deploy/route.ts — Deploy freelancer websites to Vercel
//
// FIXED VERSION
//
// Critical fixes from previous version:
// 1. AUTHENTICATION — uses Clerk to verify the request comes from a logged-in user
// 2. RATE LIMITING — prevents abuse / Vercel quota exhaustion
// 3. HTML VALIDATION — rejects HTML payloads that look malicious
// 4. ERROR SANITIZATION — strips internal tokens/secrets from error responses
// 5. INCREASED TIMEOUT — 60s instead of 30s for slow Vercel deploys
//
// SECURITY NOTE: The previous version had no auth — any URL discoverer could
// deploy arbitrary HTML to your Vercel account, exhaust your quota, or host
// malicious content under your team. This is fixed.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  deployWebsite,
  redeployWebsite,
  addCustomDomain,
  verifyDomain,
  makeProjectSlug,
} from "@/lib/deploy";

export const maxDuration = 60; // Increased from 30 — Vercel deploys can take 30-50s

// ─── RATE LIMITING ──────────────────────────────────────────────
// Prevents a single user from spamming deploys and exhausting Vercel quota

const deployBuckets = new Map<string, { count: number; resetAt: number }>();
const DEPLOY_LIMIT_PER_HOUR = 10;
const DEPLOY_LIMIT_PER_DAY = 30;

const dailyBuckets = new Map<string, { count: number; resetAt: number }>();

// Cleanup old buckets every 30 min
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of deployBuckets.entries()) if (v.resetAt < now) deployBuckets.delete(k);
    for (const [k, v] of dailyBuckets.entries()) if (v.resetAt < now) dailyBuckets.delete(k);
  }, 30 * 60 * 1000);
}

function checkRateLimit(userId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  
  // Hourly bucket
  const hourly = deployBuckets.get(userId);
  if (hourly && now < hourly.resetAt) {
    if (hourly.count >= DEPLOY_LIMIT_PER_HOUR) {
      return { allowed: false, reason: `Too many deploys this hour (${DEPLOY_LIMIT_PER_HOUR} max). Try again later.` };
    }
    hourly.count++;
  } else {
    deployBuckets.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
  }

  // Daily bucket
  const daily = dailyBuckets.get(userId);
  if (daily && now < daily.resetAt) {
    if (daily.count >= DEPLOY_LIMIT_PER_DAY) {
      return { allowed: false, reason: `Daily deploy limit reached (${DEPLOY_LIMIT_PER_DAY} max). Try again tomorrow.` };
    }
    daily.count++;
  } else {
    dailyBuckets.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  }

  return { allowed: true };
}

// ─── HTML VALIDATION ────────────────────────────────────────────
// Catches obvious malicious patterns before deploying

function validateHtml(html: string): { valid: boolean; reason?: string } {
  if (typeof html !== "string") return { valid: false, reason: "HTML must be a string" };
  if (html.length === 0) return { valid: false, reason: "HTML is empty" };
  if (html.length > 5_000_000) return { valid: false, reason: "HTML exceeds 5MB limit" };
  
  // Check for obvious malicious patterns
  const suspicious = [
    // Server-side patterns that shouldn't be in static HTML
    /<\?php/i,
    /<%[^>]*%>/,
    // Suspicious external script loads (these are red flags but not always malicious)
    /<script[^>]+src\s*=\s*["']?(?:https?:)?\/\/(?:bit\.ly|tinyurl|t\.co)/i,
    // Iframe injection patterns commonly used for clickjacking
    /<iframe[^>]+style\s*=\s*["'][^"']*display\s*:\s*none/i,
  ];
  
  for (const pattern of suspicious) {
    if (pattern.test(html)) {
      return { valid: false, reason: "HTML contains suspicious patterns" };
    }
  }
  
  // Must look like actual HTML
  if (!/<html|<body|<head|<!doctype/i.test(html)) {
    return { valid: false, reason: "HTML doesn't look like a complete document" };
  }
  
  return { valid: true };
}

// ─── ERROR SANITIZATION ─────────────────────────────────────────
// Strips internal tokens/secrets from error messages before sending to client

function sanitizeError(message: string): string {
  if (!message) return "An error occurred";
  return message
    // Strip Vercel tokens (start with vrl_ or similar patterns)
    .replace(/(?:vrl|sk|pk|Bearer)[_\s-]?[A-Za-z0-9]{15,}/g, "[REDACTED]")
    // Strip URLs that might contain internal info
    .replace(/https?:\/\/[^\s"]+vercel\.app/g, "[INTERNAL_URL]")
    // Strip API keys generally
    .replace(/(?:api[_-]?key|secret|token)[\s:=]+["']?[^\s"',]{6,}/gi, "[REDACTED]")
    // Limit length
    .slice(0, 300);
}

// ─── INPUT VALIDATION ───────────────────────────────────────────

function validateBusinessName(name: any): { valid: boolean; reason?: string } {
  if (typeof name !== "string") return { valid: false, reason: "businessName must be a string" };
  if (name.length === 0) return { valid: false, reason: "businessName is empty" };
  if (name.length > 200) return { valid: false, reason: "businessName too long" };
  return { valid: true };
}

function validateDomain(domain: any): { valid: boolean; reason?: string } {
  if (typeof domain !== "string") return { valid: false, reason: "domain must be a string" };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
    return { valid: false, reason: "Invalid domain format" };
  }
  if (domain.length > 253) return { valid: false, reason: "Domain too long" };
  return { valid: true };
}

function validateProjectId(projectId: any): { valid: boolean; reason?: string } {
  if (typeof projectId !== "string") return { valid: false, reason: "projectId must be a string" };
  // Vercel project IDs are typically alphanumeric + hyphens
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(projectId)) {
    return { valid: false, reason: "Invalid projectId format" };
  }
  return { valid: true };
}

// ─── MAIN HANDLER ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // FIXED: Authentication required for all actions
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to deploy." },
      { status: 401 }
    );
  }

  // FIXED: Rate limit check
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { action, html, businessName, projectId, domain } = body;

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Missing or invalid action" }, { status: 400 });
    }

    // ── DEPLOY ──
    if (action === "deploy") {
      // Validate inputs
      const nameCheck = validateBusinessName(businessName);
      if (!nameCheck.valid) {
        return NextResponse.json({ error: nameCheck.reason }, { status: 400 });
      }
      const htmlCheck = validateHtml(html);
      if (!htmlCheck.valid) {
        return NextResponse.json({ error: htmlCheck.reason }, { status: 400 });
      }

      if (!process.env.VERCEL_API_TOKEN) {
        return NextResponse.json(
          { error: "Deployment temporarily unavailable. Please contact support." },
          { status: 500 }
        );
      }

      const slug = makeProjectSlug(businessName);
      const result = await deployWebsite(slug, html);

      if (!result.success) {
        return NextResponse.json(
          { error: sanitizeError((result as any).error) },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        url: result.url,
        projectId: result.projectId,
        projectName: result.projectName,
        message: `Your site is live at ${result.url}`,
      });
    }

    // ── REDEPLOY ──
    if (action === "redeploy") {
      const nameCheck = validateBusinessName(businessName);
      if (!nameCheck.valid) {
        return NextResponse.json({ error: nameCheck.reason }, { status: 400 });
      }
      const htmlCheck = validateHtml(html);
      if (!htmlCheck.valid) {
        return NextResponse.json({ error: htmlCheck.reason }, { status: 400 });
      }

      const slug = makeProjectSlug(businessName);
      const result = await redeployWebsite(slug, html);

      if (!result.success) {
        return NextResponse.json(
          { error: sanitizeError((result as any).error) },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        url: result.url,
        projectId: result.projectId,
        message: `Site updated and live at ${result.url}`,
      });
    }

    // ── ADD DOMAIN ──
    if (action === "add-domain") {
      const projectCheck = validateProjectId(projectId);
      if (!projectCheck.valid) {
        return NextResponse.json({ error: projectCheck.reason }, { status: 400 });
      }
      const domainCheck = validateDomain(domain);
      if (!domainCheck.valid) {
        return NextResponse.json({ error: domainCheck.reason }, { status: 400 });
      }

      try {
        const result = await addCustomDomain(projectId, domain);
        return NextResponse.json({ success: true, ...result });
      } catch (err: any) {
        return NextResponse.json(
          { error: sanitizeError(err?.message) },
          { status: 500 }
        );
      }
    }

    // ── VERIFY DOMAIN ──
    if (action === "verify-domain") {
      const projectCheck = validateProjectId(projectId);
      if (!projectCheck.valid) {
        return NextResponse.json({ error: projectCheck.reason }, { status: 400 });
      }
      const domainCheck = validateDomain(domain);
      if (!domainCheck.valid) {
        return NextResponse.json({ error: domainCheck.reason }, { status: 400 });
      }

      try {
        const result = await verifyDomain(projectId, domain);
        return NextResponse.json({ success: true, ...result });
      } catch (err: any) {
        return NextResponse.json(
          { error: sanitizeError(err?.message) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (e: any) {
    console.error("ZELREX DEPLOY ROUTE:", e);
    return NextResponse.json(
      { error: sanitizeError(e?.message) || "Internal server error" },
      { status: 500 }
    );
  }
}