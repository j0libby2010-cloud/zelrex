import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rate limit: max 10 errors per user per minute
const errorBuckets = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, error, stack, componentStack, url: pageUrl, userAgent, timestamp } = body;

    if (!error) return NextResponse.json({ ok: true });

    // Rate limit
    const now = Date.now();
    const bucket = errorBuckets.get(userId || "anon");
    if (bucket && now < bucket.resetAt && bucket.count >= 10) {
      return NextResponse.json({ ok: true, throttled: true });
    }
    if (!bucket || now > bucket.resetAt) {
      errorBuckets.set(userId || "anon", { count: 1, resetAt: now + 60000 });
    } else {
      bucket.count++;
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) {
      console.error("[Error Log] Missing Supabase config");
      return NextResponse.json({ ok: false });
    }

    const supabase = createClient(sbUrl, sbKey);

    await supabase.from("error_logs").insert({
      user_id: userId || "anonymous",
      error_message: (error || "").slice(0, 500),
      stack_trace: (stack || "").slice(0, 2000),
      component_stack: (componentStack || "").slice(0, 1000),
      page_url: (pageUrl || "").slice(0, 500),
      user_agent: (userAgent || "").slice(0, 500),
      severity: "error",
      created_at: timestamp || new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Error Log] Failed:", e?.message);
    return NextResponse.json({ ok: false });
  }
}