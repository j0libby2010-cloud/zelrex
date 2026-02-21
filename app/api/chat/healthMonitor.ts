/**
 * ZELREX BUSINESS HEALTH MONITOR
 * 
 * This wraps around every chat response to detect warning signs and inject
 * accountability context when needed. It doesn't replace responses — it adds
 * a health check prefix when problems are detected.
 * 
 * Usage in route.ts:
 *   import { generateHealthCheck } from "./healthMonitor";
 *   
 *   // After getting the reply from Anthropic, before returning:
 *   const healthPrefix = generateHealthCheck(messages);
 *   const finalReply = healthPrefix ? healthPrefix + "\n\n---\n\n" + reply : reply;
 *   return NextResponse.json({ reply: finalReply });
 */

interface HealthSignal {
  type: "critical" | "warning" | "nudge";
  message: string;
}

export function generateHealthCheck(
  messages: Array<{ role: string; content: string }>
): string | null {
  const signals: HealthSignal[] = [];
  
  const userMsgs = messages.filter((m) => m.role === "user");
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  const allUserText = userMsgs.map((m) => m.content).join(" ").toLowerCase();
  const allAssistantText = assistantMsgs.map((m) => m.content).join(" ").toLowerCase();
  
  // ─── Time-based signals ──────────────────────────────────────
  
  const hasEvaluation = allAssistantText.includes("market evaluation") || 
                        allAssistantText.includes("weighted score") ||
                        allAssistantText.includes("validation plan");
  
  const hasWebsite = allAssistantText.includes("preview") && 
                     allAssistantText.includes("website") &&
                     (allAssistantText.includes("ready") || allAssistantText.includes("built"));
  
  const hasCommitments = allAssistantText.includes("your first 3 commitments") ||
                         allAssistantText.includes("commit to completing");
  
  // Count conversation turns to estimate time elapsed
  const turnCount = messages.length;
  
  // ─── Revenue signals ─────────────────────────────────────────
  
  const mentionsRevenue = allUserText.match(/\$\d+|\d+\s*dollars|\d+\s*per\s*month|revenue|income|made\s*money|first\s*sale|first\s*client|paying\s*customer/);
  const mentionsZeroRevenue = allUserText.match(/no\s*(sales|revenue|customers|clients|money)|haven.t\s*(made|earned|sold)|zero\s*(sales|revenue)|nothing\s*yet|\$0/);
  const mentionsCustomers = allUserText.match(/(\d+)\s*(clients?|customers?|bookings?|sales?)/);
  
  // ─── Activity signals ────────────────────────────────────────
  
  const mentionsTalkingToCustomers = allUserText.match(/talked\s*to|reached\s*out|contacted|emailed|called|dmed|messaged.*customer|messaged.*client|asked.*people/);
  const mentionsBuildingNotSelling = allUserText.match(/working\s*on\s*(the\s*)?(logo|brand|design|colors|font|layout|website\s*tweak)|perfecting|polishing|redesign/);
  const mentionsResearching = allUserText.match(/still\s*researching|looking\s*into|thinking\s*about|not\s*sure\s*yet|haven.t\s*decided|exploring/);
  const mentionsPricing = allUserText.match(/\$([\d.]+)/g);
  
  // ─── Emotional signals ───────────────────────────────────────
  
  const mentionsDiscouragement = allUserText.match(/giving\s*up|not\s*working|waste\s*of\s*time|frustrated|discouraged|losing\s*hope|should\s*i\s*quit|pointless/);
  const mentionsOverwhelm = allUserText.match(/overwhelmed|too\s*much|don.t\s*know\s*where\s*to\s*start|confused|lost|stuck/);
  
  // ─── Generate signals ────────────────────────────────────────
  
  // CRITICAL: Website built but no customer conversations
  if (hasWebsite && turnCount > 10 && !mentionsTalkingToCustomers) {
    signals.push({
      type: "critical",
      message: "You have a live website but haven't mentioned talking to any potential customers. This is the #1 reason businesses fail in the first month — building in silence. Before anything else: reach out to 5 people who match your target audience and ask them what they think of your offer. Not friends. Actual potential customers."
    });
  }
  
  // CRITICAL: Evaluation done, lots of turns, no launch
  if (hasEvaluation && turnCount > 16 && !hasWebsite && !allUserText.includes("build") && !allUserText.includes("launch")) {
    signals.push({
      type: "critical",
      message: "You ran a market evaluation a while ago but haven't moved to building yet. Every day you spend planning instead of launching is a day your competitors are selling. If you're ready, say 'build my website' and I'll create it now. If something is blocking you, tell me what it is."
    });
  }
  
  // WARNING: Spending time on branding instead of selling
  if (mentionsBuildingNotSelling && hasWebsite) {
    signals.push({
      type: "warning",
      message: "I notice you're working on design and branding. At this stage, that's procrastination disguised as productivity. Your website is already live. The only thing that matters right now is getting your first paying customer. Logos and color tweaks can wait until you have revenue."
    });
  }
  
  // WARNING: Still researching after evaluation
  if (mentionsResearching && hasEvaluation) {
    signals.push({
      type: "warning",
      message: "You're still in research mode, but I already gave you a structured evaluation with a validation plan. More research won't reduce your uncertainty — only real customer conversations will. Pick step 1 from your validation plan and do it today."
    });
  }
  
  // WARNING: Zero revenue after website is live (many turns in)
  if (hasWebsite && mentionsZeroRevenue && turnCount > 14) {
    signals.push({
      type: "warning",
      message: "You mentioned you haven't made any sales yet. That's normal early on, but we need to diagnose why. Tell me: (1) How many people have seen your offer? (2) How many conversations have you had with potential customers? (3) Has anyone said why they didn't buy? These three data points will tell us exactly what to fix."
    });
  }
  
  // WARNING: Pricing seems too low
  if (mentionsPricing && hasWebsite) {
    const prices = mentionsPricing.map((p) => parseFloat(p.replace("$", "")));
    const lowPrices = prices.filter((p) => p > 0 && p < 30);
    if (lowPrices.length > 0) {
      signals.push({
        type: "warning",
        message: `I see pricing around $${lowPrices[0]}. For most service-based businesses, pricing below $50 attracts low-quality clients who demand the most and pay the least. Consider: would you rather have 2 clients at $150 or 10 clients at $30? The first scenario gives you more money, less work, and better clients. If you're pricing low because you're nervous, that's understandable — but it's a mistake that gets harder to fix over time.`
      });
    }
  }
  
  // NUDGE: Commitments were given but not followed up on
  if (hasCommitments && turnCount > 8) {
    const lastUserMsg = userMsgs[userMsgs.length - 1]?.content.toLowerCase() || "";
    const isCheckingIn = lastUserMsg.match(/check.?in|update|how.?s.*going|weekly|did it|completed/);
    if (!isCheckingIn && !lastUserMsg.includes("commit") && !lastUserMsg.includes("done")) {
      signals.push({
        type: "nudge",
        message: "Quick check: I gave you 3 commitments to complete. Have you done them? Even partial progress counts — tell me where you are and I'll adjust the plan."
      });
    }
  }
  
  // NUDGE: Discouraged user — redirect to evidence
  if (mentionsDiscouragement) {
    signals.push({
      type: "nudge",
      message: "I hear that this feels hard. That's normal — the first 30 days are the hardest for every business. Before you make any big decisions, answer this: have you actually completed the validation plan I gave you? If not, you don't have enough data to decide whether this works. If yes, tell me the results and we'll make a clear-eyed decision about whether to continue, pivot, or stop."
    });
  }
  
  // NUDGE: Overwhelmed user — simplify
  if (mentionsOverwhelm) {
    signals.push({
      type: "nudge",
      message: "Forget everything else for a moment. Here's the only thing that matters this week: talk to one potential customer and ask them if they'd pay for what you're offering. That's it. One conversation. Everything else can wait."
    });
  }
  
  // ─── Build output ────────────────────────────────────────────
  
  if (signals.length === 0) return null;
  
  // Take the highest-priority signal (only show 1 per response to avoid overwhelm)
  const prioritized = signals.sort((a, b) => {
    const order = { critical: 0, warning: 1, nudge: 2 };
    return order[a.type] - order[b.type];
  });
  
  const signal = prioritized[0];
  
  const prefix = signal.type === "critical" 
    ? "⚠️ **Zelrex Health Check**"
    : signal.type === "warning"
    ? "📊 **Quick Check-In**"
    : "💡 **Before we continue**";
  
  return `${prefix}\n\n${signal.message}`;
}

/**
 * Extracts commitment status from conversation.
 * Returns any commitments Zelrex previously set and whether
 * the user has reported on them.
 */
export function extractCommitments(
  messages: Array<{ role: string; content: string }>
): Array<{ action: string; reported: boolean }> {
  const commitments: Array<{ action: string; reported: boolean }> = [];
  
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    
    // Look for numbered commitments in assistant messages
    const lines = m.content.split("\n");
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*\*\*(.+?)\*\*/);
      if (match && (m.content.includes("commitment") || m.content.includes("complete") || m.content.includes("by "))) {
        commitments.push({ action: match[1], reported: false });
      }
    }
  }
  
  // Check if user reported on any
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ").toLowerCase();
  for (const c of commitments) {
    const keywords = c.action.toLowerCase().split(" ").filter((w) => w.length > 4).slice(0, 3);
    if (keywords.some((k) => userText.includes(k))) {
      c.reported = true;
    }
  }
  
  return commitments;
}
