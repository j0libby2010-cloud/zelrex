// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// Runs daily at 7am UTC — checks for market disruptions relevant to each active user's niche
// Add to vercel.json: { "path": "/api/z/market-alert/cron", "schedule": "0 7 * * *" }

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !apiKey) return NextResponse.json({ error: "Missing config" }, { status: 500 });

  const supabase = createClient(url, key);
  const anthropic = new Anthropic({ apiKey });

  // Get active users with their niches (from user_memory or chat context)
  const { data: memories } = await supabase
    .from("user_memory")
    .select("user_id, fact_key, fact_value")
    .in("fact_key", ["niche", "industry", "service", "business_type"])
    .limit(200);

  if (!memories?.length) return NextResponse.json({ message: "No users with niche data", alerted: 0 });

  // Group by user, deduplicate
  const userNiches = new Map<string, string>();
  for (const m of memories) {
    if (m.fact_value && !userNiches.has(m.user_id)) {
      userNiches.set(m.user_id, m.fact_value);
    }
  }

  // Group users by niche to avoid duplicate searches
  const nicheUsers = new Map<string, string[]>();
  for (const [userId, niche] of userNiches) {
    const normalized = niche.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const existing = nicheUsers.get(normalized) || [];
    existing.push(userId);
    nicheUsers.set(normalized, existing);
  }

  let alerted = 0;
  const errors: string[] = [];

  for (const [niche, userIds] of nicheUsers) {
    try {
      // Use Claude with web search to find disruptions
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
        messages: [{
          role: "user",
          content: `Search for major recent changes (last 7 days) in the "${niche}" freelancing market. Look for:
- New AI tools that could affect freelancers in this space
- Major platform policy changes (Upwork, Fiverr, etc)
- Industry shifts or new regulations
- Pricing trend changes
- New competitors or market entrants

If you find something genuinely significant that a freelancer should know about, respond with JSON:
{"alert": true, "title": "Short headline", "summary": "2-3 sentence summary of what changed and why it matters", "urgency": "high|medium|low", "action": "One specific thing the freelancer should do"}

If nothing significant happened this week, respond:
{"alert": false}

Only flag genuinely impactful changes — not routine news. JSON only, no markdown.`,
        }],
      });

      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
      }

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        const result = JSON.parse(jsonMatch[0]);

        if (result.alert && result.title) {
          // Store alert for each user in this niche
          for (const userId of userIds) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "market_disruption",
              title: result.title,
              message: `📊 Market alert: ${result.summary}\n\n→ ${result.action}`,
              urgency: result.urgency || "medium",
              read: false,
            });
            alerted++;
          }
        }
      } catch {}
    } catch (e: any) {
      errors.push(`${niche}: ${e?.message || "unknown"}`);
    }
  }

  return NextResponse.json({
    message: `Checked ${nicheUsers.size} niches, sent ${alerted} alerts`,
    alerted,
    niches: nicheUsers.size,
    errors: errors.length > 0 ? errors : undefined,
  });
}