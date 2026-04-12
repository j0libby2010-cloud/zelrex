// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// This route is called by Vercel Cron every Monday at 8am UTC
// Add to vercel.json: { "crons": [{ "path": "/api/z/summary/cron", "schedule": "0 8 * * 1" }] }

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Verify cron secret to prevent public access
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !apiKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const anthropic = new Anthropic({ apiKey });

  // Find all users who have a deployed website (active users)
  const { data: deploys } = await supabase
    .from("deploys")
    .select("user_id, url")
    .not("url", "is", null);

  if (!deploys?.length) {
    return NextResponse.json({ message: "No active users with deployed sites", generated: 0 });
  }

  // Deduplicate by user_id
  const userIds = [...new Set(deploys.map((d: any) => d.user_id))];
  let generated = 0;
  const errors: string[] = [];

  for (const userId of userIds.slice(0, 50)) {
    // Rate limit: max 50 summaries per cron run
    try {
      // Get analytics for this user's site
      const deploy = deploys.find((d: any) => d.user_id === userId);
      const domain = deploy?.url?.replace("https://", "").replace("http://", "") || "";

      // Get this week's analytics
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const [thisWeekRes, lastWeekRes, crmRes] = await Promise.all([
        supabase.from("site_analytics").select("event_type").eq("user_id", userId).gte("created_at", weekAgo.toISOString()),
        supabase.from("site_analytics").select("event_type").eq("user_id", userId).gte("created_at", twoWeeksAgo.toISOString()).lt("created_at", weekAgo.toISOString()),
        supabase.from("crm_invoices").select("amount_cents, status").eq("user_id", userId),
      ]);

      const thisWeek = thisWeekRes.data || [];
      const lastWeek = lastWeekRes.data || [];
      const pageviewsThis = thisWeek.filter((e: any) => e.event_type === "pageview").length;
      const pageviewsLast = lastWeek.filter((e: any) => e.event_type === "pageview").length;
      const ctaThis = thisWeek.filter((e: any) => e.event_type === "cta_click").length;
      const ctaLast = lastWeek.filter((e: any) => e.event_type === "cta_click").length;
      const checkoutThis = thisWeek.filter((e: any) => e.event_type === "checkout_start").length;

      const invoices = crmRes.data || [];
      const totalRevenue = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
      const overdueCount = invoices.filter((i: any) => i.status === "overdue").length;

      // Generate summary with Claude
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Generate a concise weekly business summary for a freelancer. This is an automated Monday summary.

ANALYTICS (last 7 days):
- Page views: ${pageviewsThis} (previous week: ${pageviewsLast})
- CTA clicks: ${ctaThis} (previous week: ${ctaLast})
- Checkout starts: ${checkoutThis}
- Traffic change: ${pageviewsLast > 0 ? Math.round(((pageviewsThis - pageviewsLast) / pageviewsLast) * 100) : 0}%

BUSINESS:
- Total revenue (all time): $${(totalRevenue / 100).toFixed(2)}
- Overdue invoices: ${overdueCount}

Write a 3-5 paragraph summary covering:
1. Traffic performance (up/down, what it means)
2. Conversion signals (CTAs, checkouts)
3. Revenue health
4. ONE specific action for this week (not a list — one clear priority)

Be direct, specific, and honest. Don't be vague. If traffic is zero, say so and explain what to do about it.`,
        }],
      });

      const summaryText = response.content[0]?.type === "text" ? response.content[0].text : "Summary generation failed.";

      // Calculate week boundaries
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date();

      // Save to Supabase
      await supabase.from("weekly_summaries").insert({
        user_id: userId,
        week_start: weekStart.toISOString().slice(0, 10),
        week_end: weekEnd.toISOString().slice(0, 10),
        summary_text: summaryText,
        analytics_snapshot: {
          pageviews: pageviewsThis,
          pageviews_prev: pageviewsLast,
          cta_clicks: ctaThis,
          checkout_starts: checkoutThis,
          total_revenue: totalRevenue,
          overdue_invoices: overdueCount,
        },
        auto_generated: true,
      });

      generated++;
    } catch (e: any) {
      errors.push(`${userId}: ${e?.message || "unknown error"}`);
    }
  }

  return NextResponse.json({
    message: `Generated ${generated} weekly summaries`,
    generated,
    total_users: userIds.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}