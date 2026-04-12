// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/z/health — returns system health metrics
// Protected: requires CRON_SECRET or admin userId

export async function GET(req: Request) {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const adminUser = url.searchParams.get("userId");

  // Auth: either cron secret or check if user is admin
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  // For v1: also allow if userId matches ADMIN_USER_ID env var
  const isAdmin = adminUser && adminUser === process.env.ADMIN_USER_ID;
  if (!isAuthed && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) return NextResponse.json({ error: "Missing config" }, { status: 500 });
  const supabase = createClient(sbUrl, sbKey);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

  try {
    const [
      totalUsersR, activeUsersR, totalChatsR, recentChatsR,
      totalWebsitesR, totalDeploysR, totalInvoicesR, paidInvoicesR,
      totalProspectsR, sentEmailsR, repliedEmailsR,
      memoryCountR, outcomesR, contactMsgsR,
    ] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("chats").select("user_id", { count: "exact", head: true }).gte("updated_at", sevenDaysAgo),
      supabase.from("chats").select("id", { count: "exact", head: true }),
      supabase.from("chats").select("id", { count: "exact", head: true }).gte("updated_at", oneDayAgo),
      supabase.from("websites").select("id", { count: "exact", head: true }),
      supabase.from("deploys").select("id", { count: "exact", head: true }),
      supabase.from("crm_invoices").select("id", { count: "exact", head: true }),
      supabase.from("crm_invoices").select("id", { count: "exact", head: true }).eq("status", "paid"),
      supabase.from("outreach_prospects").select("id", { count: "exact", head: true }),
      supabase.from("outreach_emails").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabase.from("outreach_emails").select("id", { count: "exact", head: true }).eq("status", "replied"),
      supabase.from("user_memory").select("id", { count: "exact", head: true }),
      supabase.from("crm_outcomes").select("id", { count: "exact", head: true }).catch(() => ({ count: 0 })),
      supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new").catch(() => ({ count: 0 })),
    ]);

    // Revenue across all users
    const { data: allPaid } = await supabase.from("crm_invoices").select("amount_cents").eq("status", "paid");
    const totalPlatformRevenue = (allPaid || []).reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    // Weekly summary generation stats
    const { data: recentSummaries } = await supabase.from("weekly_summaries")
      .select("auto_generated, created_at")
      .gte("created_at", thirtyDaysAgo);
    const autoSummaries = (recentSummaries || []).filter((s: any) => s.auto_generated).length;
    const manualSummaries = (recentSummaries || []).filter((s: any) => !s.auto_generated).length;

    // Analytics volume
    const { count: analyticsCount } = await supabase.from("site_analytics")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // Data collection volume
    const { count: dataPointCount } = await supabase.from("zelrex_data_points")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo)
      .catch(() => ({ count: 0 }));

    // Outreach reply rate
    const totalSent = sentEmailsR.count || 0;
    const totalReplied = repliedEmailsR.count || 0;
    const overallReplyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

    return NextResponse.json({
      timestamp: now.toISOString(),
      status: "operational",

      users: {
        total: totalUsersR.count || 0,
        activeThisWeek: activeUsersR.count || 0,
      },

      chat: {
        totalChats: totalChatsR.count || 0,
        chatsToday: recentChatsR.count || 0,
      },

      websites: {
        totalBuilt: totalWebsitesR.count || 0,
        totalDeployed: totalDeploysR.count || 0,
      },

      crm: {
        totalInvoices: totalInvoicesR.count || 0,
        paidInvoices: paidInvoicesR.count || 0,
        platformRevenue: totalPlatformRevenue,
        outcomes: outcomesR.count || 0,
      },

      outreach: {
        totalProspects: totalProspectsR.count || 0,
        emailsSent: totalSent,
        emailsReplied: totalReplied,
        replyRate: overallReplyRate,
      },

      memory: {
        totalFacts: memoryCountR.count || 0,
      },

      analytics: {
        eventsThisWeek: analyticsCount || 0,
        dataPointsThisWeek: dataPointCount || 0,
      },

      summaries: {
        autoGenerated30d: autoSummaries,
        manualGenerated30d: manualSummaries,
      },

      support: {
        unreadContactMessages: contactMsgsR.count || 0,
      },

      infrastructure: {
        database: "supabase",
        hosting: "vercel",
        ai: "anthropic",
        auth: "clerk",
        memorySystem: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        stripeConnected: !!process.env.STRIPE_SECRET_KEY,
        cronSecret: !!process.env.CRON_SECRET,
        adminConfigured: !!process.env.ADMIN_USER_ID,
      },
    });
  } catch (e: any) {
    console.error("[Health] Error:", e?.message);
    return NextResponse.json({ status: "degraded", error: e?.message }, { status: 500 });
  }
}