import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/z/notifications?userId=xxx — fetch unread server-side notifications
// POST /api/z/notifications — mark notifications as read

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ notifications: [] });

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) return NextResponse.json({ notifications: [] });

  const supabase = createClient(sbUrl, sbKey);

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ notifications: data || [] });
}

export async function POST(req: Request) {
  const { userId, notificationId, action } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) return NextResponse.json({ error: "Config error" }, { status: 500 });

  const supabase = createClient(sbUrl, sbKey);

  if (action === "mark-read" && notificationId) {
    await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
  } else if (action === "mark-all-read") {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  }

  return NextResponse.json({ ok: true });
}