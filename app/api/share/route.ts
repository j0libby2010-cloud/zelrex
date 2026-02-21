import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { BusinessProgress, generateShareData } from "../chat/progressTracker";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("id");
  
  if (!userId) {
    return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
  }
  
  const raw = await kv.get<string>(`progress:${userId}`);
  if (!raw) {
    return NextResponse.json({ error: "No progress found" }, { status: 404 });
  }
  
  const progress: BusinessProgress = typeof raw === "string" ? JSON.parse(raw) : raw;
  const { canShare, shareCard } = generateShareData(progress);
  
  if (!canShare) {
    return NextResponse.json({ error: "Not enough progress to share yet" }, { status: 400 });
  }
  
  return NextResponse.json({ shareCard });
}