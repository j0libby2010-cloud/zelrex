import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildWebsite } from "@/website/core/buildWebsite";
import { saveWebsite } from "@/website/core/saveWebsite";
import { randomUUID } from "crypto";
import { formatAssumptionsForChat } from "@/website/core/formatAssumptionsForChat";
import { SessionState } from "@/website/core/sessionState";
import { getSessionState } from "@/website/core/getSessionState";
import { updateAssumptionsFromMessage } from "@/website/core/updateAssumptionsFromMessage";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { runMarketEvaluation, wantsMarketEval } from "./marketEval";
import { generateHealthCheck } from "./healthMonitor";
import { generateWeeklySummary, wantsWeeklySummary } from "./weeklySummary";
import {
  BusinessProgress,
  createBusinessProgress,
  markMilestone,
  detectMilestonesInMessage,
  addRevenueReport,
  generateProgressSummary,
  generateShareData,
  addCommitments,
} from "./progressTracker";
import { kv } from "@vercel/kv";
import type { BrandTone } from "@/website/core/websiteTypes";
import { SurveyData } from "@/website/core/buildWebsite";

// ─── Anthropic client ───────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function getProgress(userId: string): Promise<BusinessProgress | null> {
  try {
    const raw = await kv.get<string>(`progress:${userId}`);
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  } catch {
    return null;
  }
}

async function saveProgress(progress: BusinessProgress): Promise<void> {
  try {
    await kv.set(`progress:${progress.userId}`, JSON.stringify(progress));
  } catch (e) {
    console.error("Failed to save progress:", e);
  }
}

// ─── Intent detection ───────────────────────────────────────────────
function wantsWebsite(message: string): boolean {
  return /\b(build|make|create|generate|launch)\b.*\b(website|site|page|link)\b/i.test(message);
}

function wantsBusiness(message: string): boolean {
  return /\b(build|make|create|launch|start)\b.*\b(business|company|offer|service)\b/i.test(message);
}

const ALLOWED_CATEGORIES = [
  "video editing", "video editor", "film editing", "motion graphics",
  "design", "graphic design", "brand design", "ui design", "ux design", "web design", "logo",
  "writing", "copywriting", "content writing", "ghostwriting", "blogging", "seo writing", "email marketing",
  "social media", "social media management", "content creation", "community management",
  "virtual assistant", "virtual assistance", "admin", "executive assistant",
  "coaching", "life coaching", "business coaching", "fitness coaching",
  "consulting", "strategy consulting", "business consulting",
  "agency", "creative agency", "design agency", "marketing agency",
  "freelance", "freelancer", "freelancing",
];

function isAllowedBusiness(businessType: string): boolean {
  const lower = businessType.toLowerCase().trim();
  return ALLOWED_CATEGORIES.some((cat) =>
    lower.includes(cat) || cat.includes(lower)
  );
}

function getBusinessRejectionMessage(businessType: string): string {
  return [
    "I appreciate the interest, but Zelrex is specifically designed for freelancers and service providers.",
    "",
    `"${businessType}" doesn't fall into the categories I support right now:`,
    "- **Video editing** — YouTube editors, motion graphics, film",
    "- **Design** — brand, graphic, UI/UX, web design",
    "- **Writing** — copywriting, content, ghostwriting, SEO",
    "- **Social media** — management, content creation, strategy",
    "- **Virtual assistance** — admin, operations, support",
    "- **Coaching** — business, life, fitness",
    "- **Consulting** — strategy, advisory",
    "- **Agencies** — creative, design, marketing",
    "",
    "If your work fits one of these categories, let me know and I'll help you build it. If not, Zelrex isn't the right tool for you right now — and I'd rather be honest than waste your time.",
  ].join("\n");
}

function extractBusinessTypeFromText(text: string): string {
  const patterns = [
    /(?:build|start|launch|create|make)\s+(?:a|an|my)\s+(.+?)(?:\s+business|\s+company|\s+website|\s+site|$)/i,
    /(?:want to|looking to|trying to)\s+(?:build|start|launch|sell)\s+(.+?)(?:\s+business|\s+company|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function mapStyleToTone(style: string): BrandTone {
  switch (style) {
    case "dark-premium":
      return "professional";
    case "light-clean":
      return "minimal";
    case "bold-colorful":
      return "friendly";
    case "minimal-elegant":
      return "luxury";
    default:
      return "professional";
  }
}

// ─── Extract business context from conversation ─────────────────────
interface BusinessContext {
  name: string;
  tagline: string;
  tone: "professional" | "luxury" | "friendly" | "authoritative" | "minimal" | "technical";
  primaryColor: string;
  businessType: string;
  audience: string;
  offer: string;
  pricing: string;
}

async function extractBusinessContext(
  messages: Array<{ role: string; content: string }>,
  sessionState: SessionState
): Promise<BusinessContext> {
  const extractionPrompt = `You are a JSON extraction tool. Read this conversation and extract the business details discussed.

Return ONLY valid JSON with these fields (use best inference from conversation, use reasonable defaults if not discussed):
{
  "name": "business name discussed or a clear, professional name based on the service",
  "tagline": "one-line value proposition based on the offer discussed",
  "tone": "one of: professional, luxury, friendly, authoritative, minimal, technical",
  "primaryColor": "hex color that fits the business type (e.g. #1a1a2e for professional services, #2d6a4f for health/wellness, #7c3aed for luxury/premium, #0891b2 for tech/SaaS, #dc2626 for bold/agency)",
  "businessType": "e.g. consulting, coaching, digital product, agency, freelance service, SaaS",
  "audience": "who the target customer is",
  "offer": "what is being sold / delivered",
  "pricing": "price point discussed or reasonable market-rate estimate with explicit note if estimated"
}

Conversation:
${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}

Session context:
${JSON.stringify(sessionState, null, 2)}

Return ONLY the JSON object. No markdown, no explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      messages: [{ role: "user", content: extractionPrompt }],
    });

    const text =
      response.content?.[0]?.type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("ZELREX: context extraction failed, using defaults", error);
    return {
      name: sessionState.assumptions?.goals?.[0] ?? "New Business",
      tagline: "Built for results",
      tone: "professional",
      primaryColor: "#4F8CFF",
      businessType: "service",
      audience: sessionState.assumptions?.audience?.[0] ?? "professionals",
      offer: "consulting",
      pricing: "TBD",
    };
  }
}

// ─── Fallback market evaluation (no web search) ─────────────────────
// Used when the API plan doesn't support web search. Still valuable
// because Claude has extensive business knowledge from training data.

async function runMarketEvalFallback(
  messages: Array<{ role: string; content: string }>,
  sessionState: any
): Promise<string> {
  const userContext = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fallbackPrompt = `You are Zelrex's market evaluation engine.

TODAY'S DATE: ${today}

NOTE: Web search is not available for this evaluation. You must:
- Use your training knowledge (through early 2025)
- Label EVERY market size, growth rate, and pricing claim with "[AI estimate — verify independently]"
- Be more conservative in all projections since you cannot verify current data
- Recommend the user verify key numbers before committing

CONVERSATION CONTEXT:
${userContext}

SESSION STATE:
${JSON.stringify(sessionState, null, 2)}

Follow the same evaluation methodology as a full market evaluation:
1. Analyze the user's specific situation
2. Score 3 opportunities across 6 dimensions
3. Project revenue with confidence levels
4. Create a validation plan matched to their timeline
5. List risks with mitigation strategies
6. List anti-patterns to avoid

## ZELREX MARKET EVALUATION
*Analysis date: ${today}*
*Data source: AI knowledge base (training data through early 2025). Web verification recommended for all market data.*

[Complete the full evaluation structure]

RULES:
- Label ALL numbers as estimates from training data
- Be 20% more conservative than you think is right
- The validation plan MUST match the user's timeline
- Be specific to THIS user, not generic`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 6000,
    temperature: 0.2,
    messages: [{ role: "user", content: fallbackPrompt }],
  });

  const text =
    response.content?.[0]?.type === "text"
      ? response.content[0].text
      : "Market evaluation could not be completed. Please try again.";

  return text;
}
// ─── Main API handler ───────────────────────────────────────────────
// ─── Main API handler ───────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const surveyData = body.surveyData;

    const sessionState: SessionState = getSessionState(messages);

    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m: any) => m.role === "user");

    const userText =
      lastUserMessage && typeof lastUserMessage.content === "string"
        ? lastUserMessage.content
        : "";

    // ─── Assumption update flow ───────────────────────────────────
    const assumptionUpdate = updateAssumptionsFromMessage(
      userText,
      sessionState
    );

    if (
      assumptionUpdate &&
      assumptionUpdate.updated &&
      sessionState.decisions?.websiteId
    ) {
      return NextResponse.json({
        message: [
          "Got it — I've updated my assumptions.",
          "",
          ...assumptionUpdate.summary.map((s: string) => `- ${s}`),
          "",
          "I can regenerate the site with these changes whenever you want.",
        ].join("\n"),
        sessionState,
      });
    }

    // Get or create user progress (use a session ID or auth ID)
    const userId = body.userId || "anonymous";
    let progress = await getProgress(userId);

    // ─── Market Evaluation ────────────────────────────────
    if (lastUserMessage && wantsMarketEval(lastUserMessage.content)) {
      const mentionedBusiness = extractBusinessTypeFromText(userText);
      if (mentionedBusiness && !isAllowedBusiness(mentionedBusiness)) {
        return NextResponse.json({
          reply: getBusinessRejectionMessage(mentionedBusiness),
          sessionState,
        });
      }
      const { reply, evaluationRecord } = await runMarketEvaluation(messages);

      // Mark milestone + create progress if needed
      if (!progress) {
        progress = createBusinessProgress(userId, "other");
      }
      progress = markMilestone(progress, "evaluation");
      await saveProgress(progress);

      return NextResponse.json({ reply });
    }

    // ─── Weekly Summary ───────────────────────────────────
    if (lastUserMessage && wantsWeeklySummary(lastUserMessage.content)) {
      const reply = await generateWeeklySummary(messages, progress);
      return NextResponse.json({ reply });
    }

    // ─── Milestone Detection (runs on every message) ──────
    if (progress && lastUserMessage) {
      const detected = detectMilestonesInMessage(lastUserMessage.content, progress);

      for (const key of detected.milestonesReached) {
        progress = markMilestone(progress, key);
      }

      if (detected.revenueDetected !== null) {
        progress = addRevenueReport(
          progress,
          detected.revenueDetected,
          detected.clientsDetected || 1
        );
      }

      if (detected.milestonesReached.length > 0 || detected.revenueDetected) {
        await saveProgress(progress);
      }
    }

    // ─── Website generation flow ──────────────────────────────────
    // Two paths:
    // A) Survey data provided (from frontend survey overlay) — preferred
    // B) Chat-only (extract context from conversation) — fallback

    if (wantsWebsite(userText) || wantsBusiness(userText) || body.action === "buildWebsite") {
      const siteId = randomUUID();
      console.log("ZELREX: entering website build path");

      const surveyInput: SurveyData | undefined = body.surveyData;

      let businessType = "";
      if (surveyInput) {
        businessType = surveyInput.businessType;
      } else {
        const context = await extractBusinessContext(messages, sessionState);
        businessType = context.businessType;
      }

      if (businessType && !isAllowedBusiness(businessType)) {
        return NextResponse.json({
          reply: getBusinessRejectionMessage(businessType),
          sessionState,
        });
      }

      let website;
      try {
        if (surveyInput) {
          console.log("ZELREX: building from survey data");
          website = await buildWebsite({
            id: siteId,
            surveyData: surveyInput,
          });
        } else {
          console.log("ZELREX: building from chat context");
          const context = await extractBusinessContext(messages, sessionState);
          website = await buildWebsite({
            id: siteId,
            branding: {
              name: context.name,
              tagline: context.tagline,
              tone: context.tone,
              primaryColor: context.primaryColor,
            },
            businessContext: {
              businessType: context.businessType,
              audience: context.audience,
              offer: context.offer,
              pricing: context.pricing,
            },
          });
        }
      } catch (error) {
        console.error("ZELREX: website build failed", error);
        return NextResponse.json(
          {
            reply: "Something went wrong building your website. Let me try again — can you tell me your business name and what service you offer?",
            sessionState,
          },
          { status: 500 }
        );
      }

      console.log("ZELREX: website build completed", website.id);
      await saveWebsite(website);

      const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

      return NextResponse.json({
        reply: [
          `Your website is ready: **${website.branding.name}**`,
          "",
          "Press **Preview** to see it live.",
          "",
          "Everything on the site — pricing, deliverables, contact info — comes from what you told me. No placeholders.",
          "",
          "Tell me what to change, or say **deploy** when you're ready to put it on your domain.",
        ].join("\n"),
        previewUrl: "__blob__",
        websiteData: website,
        assumptions: website.assumptions,
        sessionState: {
          ...sessionState,
          decisions: {
            ...sessionState.decisions,
            websiteId: website.id,
          },
        },
      });
    }

    // ─── Normal conversation flow ─────────────────────────────────
    const anthropicMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: [
        {
          type: "text" as const,
          text: m.content,
        },
      ],
    }));

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
      max_tokens: 4096,
      temperature: 0.4,
    });

    const reply =
      response.content?.[0]?.type === "text"
        ? response.content[0].text
        : "Tell me what outcome you want to reach.";

    // Before returning the normal chat reply, check business health
    const healthPrefix = generateHealthCheck(messages);
    const finalReply = healthPrefix
      ? healthPrefix + "\n\n---\n\n" + reply
      : reply;

    return NextResponse.json({ reply: finalReply, sessionState });
  } catch (error) {
    console.error("Zelrex API error FULL:", error);

    return NextResponse.json(
      {
        reply:
          "Something didn't load correctly on my side. Try again in a moment.",
      },
      { status: 500 }
    );
  }
}