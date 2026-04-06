// app/api/z/data/route.ts
// 
// API endpoint for data collection.
// Called by the frontend at key events (goal set, manual metric reports).
// Called by other routes after server-side events (market eval, website build).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectDataPoint, maybeAggregate, aggregateInsights, normalizeNiche, Niche } from "@/lib/dataCollector";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ─── Collect a single data point ───────────────
      case "collect": {
        const { userId, eventType, niche, data, subNiche, optedOut } = body;
        if (!userId || !eventType || !data) {
          return NextResponse.json({ error: "Missing userId, eventType, or data" }, { status: 400 });
        }
        await collectDataPoint(supabase, userId, eventType, niche, data, subNiche, optedOut);
        // Check if we should re-aggregate
        await maybeAggregate(supabase, niche);
        return NextResponse.json({ ok: true });
      }

      // ─── Force re-aggregation for a niche ──────────
      case "aggregate": {
        const { niche } = body;
        if (!niche) {
          return NextResponse.json({ error: "Missing niche" }, { status: 400 });
        }
        const normalized = normalizeNiche(niche);
        if (!normalized) {
          return NextResponse.json({ error: "Unknown niche" }, { status: 400 });
        }
        await aggregateInsights(supabase, normalized);
        return NextResponse.json({ ok: true, niche: normalized });
      }

      // ─── Get aggregate insights (for debugging/admin) ──
      case "insights": {
        const { niche } = body;
        const normalized = niche ? normalizeNiche(niche) : null;
        
        if (normalized) {
          const { data, error } = await supabase
            .from("zelrex_niche_insights")
            .select("*")
            .eq("niche", normalized)
            .is("sub_niche", null)
            .single();
          return NextResponse.json({ insights: data, error: error?.message });
        }

        // Return all niches
        const { data, error } = await supabase
          .from("zelrex_niche_insights")
          .select("*")
          .is("sub_niche", null)
          .order("sample_size", { ascending: false });
        return NextResponse.json({ insights: data, error: error?.message });
      }

      // ─── Check opt-out status and update ───────────
      case "opt-out": {
        const { userId, optOut } = body;
        if (!userId) {
          return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }
        // Update all existing data points for this user
        const { error } = await supabase
          .from("zelrex_data_points")
          .update({ opted_out: optOut !== false })
          .eq("user_id", userId);
        return NextResponse.json({ ok: true, opted_out: optOut !== false, error: error?.message });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[ZELREX DATA API] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}