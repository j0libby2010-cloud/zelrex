// app/api/deploy/route.ts — Deploy freelancer websites to Vercel
import { NextRequest, NextResponse } from "next/server";
import {
  deployWebsite,
  redeployWebsite,
  addCustomDomain,
  verifyDomain,
  makeProjectSlug,
} from "@/lib/deploy";

export const maxDuration = 30;

// ─── POST: Deploy or update a website ───────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, html, businessName, projectId, domain } = body;

    // ── DEPLOY: push website HTML live ──
    if (action === "deploy") {
      if (!html || !businessName) {
        return NextResponse.json(
          { error: "Missing html or businessName" },
          { status: 400 }
        );
      }

      if (!process.env.VERCEL_API_TOKEN) {
        return NextResponse.json(
          { error: "Deployment not configured. VERCEL_API_TOKEN is missing." },
          { status: 500 }
        );
      }

      const slug = makeProjectSlug(businessName);
      const result = await deployWebsite(slug, html);

      if (!result.success) {
        return NextResponse.json(
          { error: (result as any).error },
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

    // ── REDEPLOY: update existing site ──
    if (action === "redeploy") {
      if (!html || !businessName) {
        return NextResponse.json(
          { error: "Missing html or businessName" },
          { status: 400 }
        );
      }

      const slug = makeProjectSlug(businessName);
      const result = await redeployWebsite(slug, html);

      if (!result.success) {
        return NextResponse.json(
          { error: (result as any).error },
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

    // ── ADD DOMAIN: attach custom domain to project ──
    if (action === "add-domain") {
      if (!projectId || !domain) {
        return NextResponse.json(
          { error: "Missing projectId or domain" },
          { status: 400 }
        );
      }

      const result = await addCustomDomain(projectId, domain);

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // ── VERIFY DOMAIN: check if DNS is configured ──
    if (action === "verify-domain") {
      if (!projectId || !domain) {
        return NextResponse.json(
          { error: "Missing projectId or domain" },
          { status: 400 }
        );
      }

      const result = await verifyDomain(projectId, domain);

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (e: any) {
    console.error("ZELREX DEPLOY ROUTE:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
