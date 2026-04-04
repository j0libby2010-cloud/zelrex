import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from '@supabase/supabase-js';
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
import { validateOutput } from '@/lib/aiSafety';
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
import type { BrandTone } from "@/website/core/websiteTypes";
import { SurveyData } from "@/website/core/buildWebsite";

// ─── SAFE IMPORTS: Memory + v5 prompt (with fallback) ─────────────
// These are wrapped so that if the modules have issues, the route still loads.

let MemoryServiceClass: any = null;
let buildSystemPromptFn: ((ctx: any) => string) | null = null;
let ZELREX_TOOLS_IMPORTED: any[] | null = null;

try {
  const memoryModule = require('@/lib/memory');
  MemoryServiceClass = memoryModule.MemoryService;
  console.log('[ZELREX BOOT] MemoryService loaded');
} catch (e) {
  console.warn('[ZELREX BOOT] MemoryService failed to load — running without memory:', (e as Error).message);
}

try {
  const promptModule = require('@/lib/systemPrompt');
  buildSystemPromptFn = promptModule.buildSystemPrompt;
  ZELREX_TOOLS_IMPORTED = promptModule.ZELREX_TOOLS;
  console.log('[ZELREX BOOT] v5 system prompt loaded');
} catch (e) {
  console.warn('[ZELREX BOOT] v5 system prompt failed to load — falling back to v3:', (e as Error).message);
}

// ─── SAFE IMPORT: Vercel KV (with fallback) ──────────────────────
let kv: any = null;
try {
  const kvModule = require('@vercel/kv');
  kv = kvModule.kv;
  console.log('[ZELREX BOOT] Vercel KV loaded');
} catch (e) {
  console.warn('[ZELREX BOOT] Vercel KV not available — progress tracking disabled:', (e as Error).message);
}

// ─── Clients ─────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Only create memory service if the class loaded
const memoryService = MemoryServiceClass ? new MemoryServiceClass(supabase) : null;

// ─── Stripe service (safe load) ─────────────────────────────────
let stripeService: any = null;
try {
  const { StripeService: SC } = require('@/lib/stripe');
  stripeService = new SC(supabase);
  console.log('[ZELREX BOOT] StripeService loaded');
} catch (e) {
  console.warn('[ZELREX BOOT] StripeService not available:', (e as Error).message);
}

// ─── Progress helpers (safe with KV fallback) ────────────────────
async function getProgress(userId: string): Promise<BusinessProgress | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(`progress:${userId}`) as string | null;
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  } catch (e) {
    console.warn('[ZELREX] getProgress failed:', (e as Error).message);
    return null;
  }
}

async function saveProgress(progress: BusinessProgress): Promise<void> {
  if (!kv) return;
  try {
    await kv.set(`progress:${progress.userId}`, JSON.stringify(progress));
  } catch (e) {
    console.error("[ZELREX] saveProgress failed:", (e as Error).message);
  }
}

// ─── Intent detection ───────────────────────────────────────────
function wantsWebsite(message: string): boolean {
  return /\b(build|make|create|generate|launch)\b.*\b(website|site|page|link)\b/i.test(message);
}

function wantsBusiness(message: string): boolean {
  return /\b(build|make|create|launch|start)\b.*\b(business|company|offer|service)\b/i.test(message);
}

function wantsStripeConnect(message: string): boolean {
  return /\b(connect|setup|link|add|enable)\b.*\b(stripe|payment|checkout|pay)\b/i.test(message);
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

// ─── Extract business context from conversation ─────────────────
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

// ─── Fallback market evaluation (no web search) ─────────────────
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

// ─── Main API handler ───────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const surveyData = body.surveyData;
    const responseStyle: string = body.responseStyle || "direct";
    const attachments: any[] = body.attachments || [];
    const currentTime: string = body.currentTime || new Date().toISOString();
    const userGoal: { text: string; target: string; deadline: string } | undefined = body.userGoal;
    const businessProfile: { niche?: string; experience?: string; timezone?: string } | undefined = body.businessProfile;
    const permissions: { autoExtractClients?: boolean; autoSuggestInvoices?: boolean } | undefined = body.permissions;
    const language: string = body.language || "en";
    const recentNotifications: any[] = body.recentNotifications || [];

    // Communication style modifier
    const responseStyles: Record<string, string> = {
      direct: "Respond concisely and directly. Get to the point fast.",
      detailed: "Provide thorough, detailed explanations with examples and step-by-step guidance.",
      coaching: "Respond like a mentor. Ask guiding questions. Help the user think through decisions.",
    };
    let styleInstruction = `\n\nCOMMUNICATION STYLE: ${responseStyles[responseStyle] || responseStyles.direct}`;

    // Language instruction
    if (language && language !== "en") {
      const langNames: Record<string, string> = { es: "Spanish", fr: "French", de: "German", pt: "Portuguese", ja: "Japanese", zh: "Chinese", ko: "Korean", ar: "Arabic", hi: "Hindi" };
      styleInstruction += `\n\nRESPOND IN: ${langNames[language] || language}. Always respond in this language unless the user explicitly asks otherwise.`;
    }

    // Inject current time so Zelrex is always aware
    styleInstruction += `\n\nCURRENT DATE AND TIME: ${currentTime}`;

    // Inject user goal so every recommendation aligns with it
    if (userGoal?.text) {
      styleInstruction += `\n\nUSER'S GOAL: "${userGoal.text}"`;
      if (userGoal.target) styleInstruction += ` | Revenue target: ${userGoal.target}`;
      if (userGoal.deadline) styleInstruction += ` | Deadline: ${userGoal.deadline}`;
      styleInstruction += `\nEvery recommendation, suggestion, and analysis you give should be evaluated against this goal. If something doesn't move the user closer to this goal, say so. Track their progress toward this goal.`;
    }

    // Inject business profile so Zelrex calibrates advice
    if (businessProfile?.niche || businessProfile?.experience) {
      styleInstruction += `\n\nUSER'S BUSINESS PROFILE:`;
      if (businessProfile.niche) styleInstruction += ` Niche: ${businessProfile.niche}.`;
      if (businessProfile.experience) styleInstruction += ` Experience: ${businessProfile.experience}.`;
      if (businessProfile.timezone) styleInstruction += ` Timezone: ${businessProfile.timezone}.`;
      styleInstruction += `\nCalibrate your advice complexity and examples to their experience level. Reference their niche when giving specific recommendations.`;
    }

    // Inject recent notifications so Zelrex has context on what it's already told the user
    if (recentNotifications.length > 0) {
      styleInstruction += `\n\nRECENT NOTIFICATIONS SENT TO USER: ${recentNotifications.map(n => `"${n.text}"`).join("; ")}`;
      styleInstruction += `\nYou are aware of these notifications. Don't repeat the same advice. If the user asks about something a notification mentioned, reference it naturally.`;
    }

    const sessionState: SessionState = getSessionState(messages);

    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m: any) => m.role === "user");

    const userText =
      lastUserMessage && typeof lastUserMessage.content === "string"
        ? lastUserMessage.content
        : "";

    console.log(`[ZELREX] Processing message: "${userText.substring(0, 80)}..." | Memory: ${memoryService ? 'ON' : 'OFF'} | v5 prompt: ${buildSystemPromptFn ? 'ON' : 'OFF'} | KV: ${kv ? 'ON' : 'OFF'}`);

    // ─── Assumption update flow ──────────────────────────────
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

    // Get or create user progress
    const userId = body.userId || "anonymous";
    let progress = await getProgress(userId);

    // ─── Stripe Connect ──────────────────────────────────────
    if (wantsStripeConnect(userText) && stripeService) {
      try {
        const status = await stripeService.getAccountStatus(userId);

        if (status.connected && status.chargesEnabled) {
          return NextResponse.json({
            reply: "Your Stripe account is already connected and ready to accept payments. When I build your website, checkout links will be added to your pricing tiers automatically.",
            sessionState,
          });
        }

        const userEmail = body.userEmail || "user@example.com";
        const businessName = body.businessName || "";

        const { onboardingUrl } = await stripeService.createConnectedAccount(
          userId,
          userEmail,
          businessName,
          `${process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai'}/api/stripe/callback?user_id=${userId}`
        );

        if (onboardingUrl) {
          return NextResponse.json({
            reply: `Let's connect your Stripe account. This takes about 2 minutes — Stripe will ask for your basic info and bank details.\n\n**[Click here to connect Stripe](${onboardingUrl})**\n\nOnce you're done, come back here and I'll set everything up.`,
            stripeOnboardingUrl: onboardingUrl,
            sessionState,
          });
        }
      } catch (e) {
        console.error("[ZELREX] Stripe connect error:", e);
        return NextResponse.json({
          reply: "Something went wrong setting up Stripe. Try again in a moment.",
          sessionState,
        });
      }
    }

    // ─── Market Evaluation ───────────────────────────────────
    if (lastUserMessage && wantsMarketEval(lastUserMessage.content)) {
      console.log('[ZELREX] Market evaluation triggered');
      const mentionedBusiness = extractBusinessTypeFromText(userText);
      if (mentionedBusiness && !isAllowedBusiness(mentionedBusiness)) {
        return NextResponse.json({
          reply: getBusinessRejectionMessage(mentionedBusiness),
          sessionState,
        });
      }

      try {
        const { reply, evaluationRecord } = await runMarketEvaluation(messages);

        if (!progress) {
          progress = createBusinessProgress(userId, "other");
        }
        progress = markMilestone(progress, "evaluation");
        await saveProgress(progress);

        return NextResponse.json({ reply });
      } catch (evalError) {
        console.error('[ZELREX] Market evaluation failed, trying fallback:', evalError);
        try {
          const fallbackReply = await runMarketEvalFallback(messages, sessionState);
          return NextResponse.json({ reply: fallbackReply });
        } catch (fallbackError) {
          console.error('[ZELREX] Fallback evaluation also failed:', fallbackError);
          return NextResponse.json({
            reply: "I wasn't able to complete the market evaluation right now. Can you tell me more about your situation and I'll work with what I know?",
            sessionState,
          });
        }
      }
    }

    // ─── Weekly Summary ──────────────────────────────────────
    if (lastUserMessage && wantsWeeklySummary(lastUserMessage.content)) {
      console.log('[ZELREX] Weekly summary triggered');
      try {
        const reply = await generateWeeklySummary(messages, progress);
        return NextResponse.json({ reply });
      } catch (e) {
        console.error('[ZELREX] Weekly summary failed:', e);
      }
    }

    // ─── Milestone Detection (runs on every message) ─────────
    if (progress && lastUserMessage) {
      try {
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
      } catch (e) {
        console.warn('[ZELREX] Milestone detection failed (non-fatal):', (e as Error).message);
      }
    }

    // ─── Website generation flow ─────────────────────────────
    if (wantsWebsite(userText) || wantsBusiness(userText) || body.action === "buildWebsite") {
      const siteId = randomUUID();
      console.log("[ZELREX] Entering website build path");

      const surveyInput: SurveyData | undefined = body.surveyData;
      const stripePreference = surveyInput?.stripeCheckout || "none";

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

      // ─── STRIPE CHECK: If user wants checkout, verify Stripe is connected BEFORE building ───
      console.log(`[ZELREX] Stripe check: preference=${stripePreference}, stripeService=${!!stripeService}, userId=${userId}`);
      if (stripePreference !== "none" && stripeService && userId !== "anonymous") {
        try {
          const stripeStatus = await stripeService.getAccountStatus(userId);

          if (!stripeStatus.connected || !stripeStatus.chargesEnabled) {
            // User wants Stripe but hasn't connected yet — send them to onboard FIRST
            console.log("[ZELREX] User wants Stripe but not connected — sending onboarding link");
            const userEmail = body.userEmail || "user@example.com";
            const businessName = surveyInput?.businessName || "";
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai';

            const { onboardingUrl } = await stripeService.createConnectedAccount(
              userId,
              userEmail,
              businessName,
              `${baseUrl}/api/stripe/callback?user_id=${userId}`
            );

            if (onboardingUrl) {
              return NextResponse.json({
                reply: [
                  "Before I build your website, let's connect your Stripe account so I can add live payment buttons to your pricing tiers.",
                  "",
                  "This takes about 2 minutes — Stripe will ask for your basic info and bank details. Zelrex never touches your money — payments go directly from your clients to your bank account.",
                  "",
                  `**[Connect your Stripe account](${onboardingUrl})**`,
                  "",
                  "Once you're done, come back here and say **build my website** — I'll have everything saved and ready to go.",
                ].join("\n"),
                stripeOnboardingUrl: onboardingUrl,
                // Save the survey data so it persists — the user won't have to fill it out again
                pendingSurveyData: surveyInput,
                sessionState,
              });
            }
          }
        } catch (stripeCheckError) {
          console.error("[ZELREX] Stripe pre-check failed (non-fatal, proceeding with build):", stripeCheckError);
          // Don't block the website build — just continue without Stripe
        }
      }

      // ─── BUILD THE WEBSITE ─────────────────────────────────────
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
      try { await saveWebsite(website); } catch (e) { console.warn("ZELREX: saveWebsite skipped:", (e as Error).message); }

      // ─── STRIPE: Create checkout + inject into website (if connected) ────
      let stripeCheckoutUrls: Record<string, string> = {};
      let stripeMessage = "";

      if (stripePreference !== "none" && stripeService && userId !== "anonymous") {
        try {
          const stripeStatus = await stripeService.getAccountStatus(userId);

          if (stripeStatus.connected && stripeStatus.chargesEnabled) {
            console.log("[ZELREX] Stripe connected — creating products from pricing tiers");

            const copyTiers = website.copy?.pricing?.pricing?.tiers;

            if (copyTiers && copyTiers.length > 0) {
              const offerForStripe = {
                offer_name: website.branding.name || "Service",
                business_name: website.branding.name,
                target_audience: website.copy?.offer?.whoItsFor?.subtitle || "",
                pricing_tiers: copyTiers.map((t: any) => ({
                  tier: t.name,
                  price: t.price,
                  description: t.features?.join(", ") || t.note || t.name,
                })),
                included: website.copy?.offer?.whatYouGet?.items?.map((i: any) => i.title).join(", ") || "",
                turnaround: "",
              };

              const products = await stripeService.createProductsFromOffer(userId, offerForStripe);

              if (products.length > 0) {
                stripeCheckoutUrls = await stripeService.createPaymentLinks(userId);
                console.log(`[ZELREX] Created ${products.length} products, ${Object.keys(stripeCheckoutUrls).length} payment links`);

                if (stripePreference === "auto") {
                  (website as any).stripeCheckoutUrls = stripeCheckoutUrls;
                  (website as any).stripeConnected = true;
                  stripeMessage = "\n\nYour Stripe checkout is live. Each pricing tier on your site now has a real payment button — when clients click it, they go straight to Stripe checkout. Money goes directly to your bank account.";
                } else {
                  stripeMessage = "\n\nYour Stripe payment links are ready. I've included them below — share them directly with clients or add them wherever you like.";
                }
              }
            }
          } else if (stripeStatus.connected && !stripeStatus.chargesEnabled) {
            stripeMessage = "\n\nYour Stripe account is connected but not fully verified yet. Once Stripe finishes verifying your account, say **build my website** again and I'll add the checkout buttons.";
          }
          // If not connected at this point, they either chose "none" or the pre-check
          // already sent them to onboard. No message needed.
        } catch (stripeError) {
          console.error("[ZELREX] Stripe integration failed (non-fatal):", stripeError);
          stripeMessage = "\n\nI wasn't able to set up payments automatically this time. You can try again later — just say **connect Stripe**.";
        }
      }

      const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

      // Build checkout links message for chat
      let checkoutLinksMessage = "";
      if (Object.keys(stripeCheckoutUrls).length > 0) {
        const linkLines = Object.entries(stripeCheckoutUrls).map(
          ([tier, url]) => `- **${tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, ' ')}**: ${url}`
        );
        checkoutLinksMessage = `\n\nYour direct payment links (share these anywhere):\n${linkLines.join("\n")}`;
      }

      return NextResponse.json({
        reply: [
          `Your website is ready: **${website.branding.name}**`,
          "",
          "Press **Preview** to see it live.",
          "",
          "Everything on the site — pricing, deliverables, contact info — comes from what you told me. No placeholders.",
          stripeMessage,
          checkoutLinksMessage,
          "",
          "Tell me what to change, or say **deploy** when you're ready to put it on your domain.",
        ].filter(Boolean).join("\n"),
        previewUrl: "__blob__",
        websiteData: website,
        assumptions: website.assumptions,
        stripeCheckoutUrls: Object.keys(stripeCheckoutUrls).length > 0 ? stripeCheckoutUrls : undefined,
        sessionState: {
          ...sessionState,
          decisions: {
            ...sessionState.decisions,
            websiteId: website.id,
          },
        },
      });
    }

    // ─── Normal conversation flow ────────────────────────────
    const chatId = body.chatId || "unknown";

    // STRATEGY: Try v5 (memory + dynamic prompt + tools) first.
    // If anything in v5 fails, fall back to v3 (static prompt, no tools).

    // --- ATTEMPT 1: v5 with memory + tools ---
    if (memoryService && buildSystemPromptFn && ZELREX_TOOLS_IMPORTED) {
      try {
        console.log('[ZELREX] Using v5 path (memory + dynamic prompt + tools)');

        // 1. Load user memory
        const userContext = await memoryService.loadFullContext(userId);
        console.log(`[ZELREX] Memory loaded: ${userContext.memory?.length || 0} facts, stage ${userContext.progressStage}`);

        // 2. Build dynamic prompt with explicit memory transparency
        let memoryTransparency = "";
        if (userContext.memory?.length > 0) {
          const factsList = userContext.memory.map((f: any) => typeof f === "string" ? f : f.fact || f.text || JSON.stringify(f)).join("\n- ");
          memoryTransparency = `\n\nMEMORY STATUS: Active. You have ${userContext.memory.length} stored facts about this user:\n- ${factsList}\n\nIMPORTANT: These are the ONLY things you know about this user from previous conversations. If asked about anything NOT in this list, say "I don't have that in my memory — can you remind me?" Do NOT guess or infer unstated facts.`;
        } else {
          memoryTransparency = `\n\nMEMORY STATUS: No stored facts for this user yet. You are starting fresh. Do NOT pretend to know things about the user that they haven't told you in THIS conversation. If they reference a previous conversation, say "I don't have context from our previous conversations yet. Can you catch me up?"`;
        }
        if (userContext.milestones?.length > 0) {
          memoryTransparency += `\n\nMILESTONES REACHED: ${userContext.milestones.map((m: any) => typeof m === "string" ? m : m.stage || m.name || JSON.stringify(m)).join(", ")}`;
        }
        if (userContext.commitments?.length > 0) {
          const pendingCommitments = userContext.commitments.filter((c: any) => c.status === "pending" || !c.status);
          if (pendingCommitments.length > 0) {
            memoryTransparency += `\n\nOPEN COMMITMENTS (follow up on these): ${pendingCommitments.map((c: any) => c.action || c.text || JSON.stringify(c)).join("; ")}`;
          }
        }
        const dynamicSystemPrompt = buildSystemPromptFn(userContext) + styleInstruction + memoryTransparency;

        // Long conversation rule reminder — re-inject critical rules when conversation gets long
        const conversationLength = messages.length;
        let ruleReminder = "";
        if (conversationLength > 40) {
          ruleReminder = `\n\n⚠️ LONG CONVERSATION REMINDER — Re-read these rules before responding:
1. NEVER fabricate data. Tag all claims: [SEARCHED], [ESTIMATED], or [PATTERN].
2. NEVER present uncertain information as fact. Say "I'm estimating" or "I don't know."
3. NEVER pretend to remember what you don't. Check your MEMORY STATUS above.
4. Revenue projections are SCENARIOS, not predictions. Include disclaimer.
5. You do NOT have web search in this conversation. Only market evaluations use search.
6. If you're unsure about ANYTHING, say so.`;
        }

        // Confidence self-rating instruction
        const confidenceInstruction = `\n\nCONFIDENCE SELF-RATING: When your response contains business advice, pricing recommendations, market claims, revenue projections, or strategic recommendations, end your response with a confidence line in this exact format:
📊 *Confidence: [HIGH/MEDIUM/LOW] — [one sentence explaining why]*
HIGH = based on searched data or well-established patterns you're very sure about
MEDIUM = based on reasonable inference or training knowledge but not verified
LOW = you're guessing or working with very limited information
Do NOT include this for casual conversation, simple questions, or greetings. Only for substantive business guidance.`;

        const fullSystemPrompt = dynamicSystemPrompt + ruleReminder + confidenceInstruction;

        // 3. Call Claude with tools in a loop
        let currentMessages: any[] = messages.map((m: any, idx: number) => {
          // Check if this is the last user message and has attachments
          const isLastUser = m.role === "user" && idx === messages.length - 1;
          if (isLastUser && attachments.length > 0) {
            const content: any[] = [];
            // Add images first
            for (const att of attachments) {
              if (att.kind === "image" && att.data) {
                const base64Data = att.data.split(",")[1] || att.data;
                const mediaType = att.type || "image/png";
                content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
              }
            }
            // Then add the text
            content.push({ type: "text", text: m.content });
            return { role: "user" as const, content };
          }
          return {
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          };
        });
        let finalResponse: any = null;
        let loops = 0;

        while (loops < 5) {
          loops++;
          console.log(`[ZELREX] Claude call loop ${loops}`);

          // Dynamically adjust thinking budget based on message complexity
          const lastMsg = currentMessages[currentMessages.length - 1];
          const msgText = typeof lastMsg?.content === "string" ? lastMsg.content : (lastMsg?.content?.find?.((b: any) => b.type === "text")?.text || "");
          const isComplexQuery = /pric|revenue|market|evaluat|compet|strateg|contract|proposal|offer|should i|how much|how viable/i.test(msgText);
          const thinkingBudget = isComplexQuery ? 12000 : 6000;

          const response = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 16000,
            temperature: 1,
            thinking: {
              type: "enabled",
              budget_tokens: thinkingBudget,
            },
            system: fullSystemPrompt,
            messages: currentMessages,
            tools: ZELREX_TOOLS_IMPORTED as any,
          });

          const toolCalls = response.content.filter((b: any) => b.type === 'tool_use');

          // If no tool calls or end_turn, we're done
          if (toolCalls.length === 0 || response.stop_reason === 'end_turn') {
            finalResponse = response;
            break;
          }

          // Handle tool calls
          currentMessages.push({ role: 'assistant', content: response.content });
          const toolResults: any[] = [];

          for (const tool of toolCalls as any[]) {
            let result = '';
            const input = tool.input as any;

            try {
              switch (tool.name) {
                case 'save_memory':
                  await memoryService.setFacts(userId, input.facts, chatId);
                  result = `Saved ${input.facts.length} facts.`;
                  break;
                case 'reach_milestone':
                  await memoryService.reachMilestone(userId, input.stage, input.evidence, chatId);
                  result = `Milestone ${input.stage} recorded.`;
                  break;
                case 'create_commitments':
                  await memoryService.createCommitments(userId, input.commitments, input.week_number, chatId);
                  result = `Created ${input.commitments.length} commitments.`;
                  break;
                case 'resolve_commitment':
                  await memoryService.resolveCommitment(input.commitment_id, input.status, input.outcome_note, chatId);
                  result = `Commitment resolved.`;
                  break;
                case 'save_offer':
                  await memoryService.saveOffer(userId, input, chatId);
                  result = `Offer saved.`;
                  break;
                default:
                  result = 'Unknown tool.';
              }
            } catch (toolError) {
              console.error(`[ZELREX] Tool "${tool.name}" failed:`, toolError);
              result = `Tool execution failed: ${(toolError as Error).message}. Continue without this data.`;
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: result,
            });
          }

          currentMessages.push({ role: 'user', content: toolResults });
        }

        // 4. Extract text
        const reply = finalResponse
          ? finalResponse.content
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('')
          : "Tell me what outcome you want to reach.";

        // Output validation via shared utility
        let finalReply = validateOutput(reply, {
          checkFinancial: true,
          checkContract: true,
          checkGuarantee: true,
          checkCompetitor: true,
        });

        // CRM auto-extraction: detect client/project mentions — strict patterns, false positive filtering
        let crmSuggestion = "";
        if (permissions?.autoExtractClients !== false) {
          try {
            const lastUser = messages[messages.length - 1]?.content || "";
            const clientMentionMatch = lastUser.match(/(?:my\s+client|client\s+named?|(?:finished|completed|delivered|invoiced?|billed?)\s+(?:work\s+)?(?:for|to))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
            const companyMatch = lastUser.match(/(?:my\s+client|client\s+named?|(?:finished|completed|delivered|invoiced?|billed?)\s+(?:work\s+)?(?:for|to))\s+([A-Z][A-Za-z]+(?:\s+(?:Inc|LLC|Co|Corp|Ltd|Studio|Agency|Design|Media|Group))?)/);
            const invoiceMatch = lastUser.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
            const nameMatch = clientMentionMatch || companyMatch;
            // Filter out common false positives
            const falsePositives = ["Building", "Working", "Making", "Creating", "Starting", "Getting", "Going", "Looking", "Thinking", "Trying", "Using", "Having", "Being", "Doing", "Taking", "Coming", "Seeing", "Wanting", "Needing", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Zelrex", "Stripe", "Google", "Facebook", "Instagram", "YouTube", "LinkedIn", "Twitter"];
            const detectedName = nameMatch?.[1]?.trim();
            if (detectedName && !falsePositives.includes(detectedName.split(" ")[0])) {
              if (invoiceMatch && permissions?.autoSuggestInvoices !== false) {
                crmSuggestion = `\n\n---\n*I noticed you mentioned working with **${detectedName}** and an amount of **$${invoiceMatch[1]}**. Would you like me to add them to your Client Manager and draft an invoice? (You can also do this manually in the Clients tab.)*`;
              } else {
                crmSuggestion = `\n\n---\n*I noticed you mentioned **${detectedName}**. Would you like me to add them to your Client Manager? (You can also do this manually in the Clients tab.)*`;
              }
            }
          } catch {}
        }

        return NextResponse.json({ reply: finalReply + crmSuggestion, sessionState, memoryActive: true });

      } catch (v5Error) {
        // v5 failed — log the SPECIFIC error and fall through to v3
        console.error('[ZELREX] v5 path FAILED. Falling back to v3. Error:', v5Error);
        console.error('[ZELREX] v5 error name:', (v5Error as Error).name);
        console.error('[ZELREX] v5 error message:', (v5Error as Error).message);
        if ((v5Error as any).status) console.error('[ZELREX] v5 API status:', (v5Error as any).status);
        if ((v5Error as any).error) console.error('[ZELREX] v5 API error body:', JSON.stringify((v5Error as any).error));
      }
    }

    // --- ATTEMPT 2: v3 fallback (static prompt, no tools, no memory) ---
    console.log('[ZELREX] Using v3 fallback path (static prompt, no tools)');
    try {
      const currentMessages = messages.map((m: any, idx: number) => {
        const isLastUser = m.role === "user" && idx === messages.length - 1;
        if (isLastUser && attachments.length > 0) {
          const content: any[] = [];
          for (const att of attachments) {
            if (att.kind === "image" && att.data) {
              const base64Data = att.data.split(",")[1] || att.data;
              const mediaType = att.type || "image/png";
              content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
            }
          }
          content.push({ type: "text", text: m.content });
          return { role: "user" as const, content };
        }
        return {
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        };
      });

      // v3 still gets extended thinking and memory warning
      const v3MemoryWarning = `\n\nMEMORY STATUS: DEGRADED. The memory system is temporarily unavailable. You have NO stored facts about this user beyond what is in this conversation. Be extra careful to NOT assume you know things about the user. Ask if unsure.`;

      // Long conversation reminder + confidence rating for v3 too
      let v3RuleReminder = "";
      if (messages.length > 40) {
        v3RuleReminder = `\n\n⚠️ LONG CONVERSATION REMINDER:
1. NEVER fabricate data. Tag all claims: [SEARCHED], [ESTIMATED], or [PATTERN].
2. NEVER present uncertain information as fact.
3. Revenue projections are SCENARIOS, not predictions.
4. You do NOT have web search. Only market evaluations use search.
5. If unsure, say so.`;
      }
      const v3ConfidenceInstruction = `\n\nCONFIDENCE SELF-RATING: When your response contains business advice, pricing, market claims, or strategic recommendations, end with:
📊 *Confidence: [HIGH/MEDIUM/LOW] — [one sentence why]*
Only for substantive guidance, not casual chat.`;

      const v3FullPrompt = SYSTEM_PROMPT + styleInstruction + v3MemoryWarning + v3RuleReminder + v3ConfidenceInstruction;

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        temperature: 1,
        thinking: {
          type: "enabled",
          budget_tokens: 6000,
        },
        system: v3FullPrompt,
        messages: currentMessages,
      });

      const reply = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

      // Output validation via shared utility
      let finalReply = validateOutput(reply, {
        checkFinancial: true,
        checkContract: true,
        checkGuarantee: true,
        checkCompetitor: true,
      });

      return NextResponse.json({ reply: finalReply, sessionState, memoryActive: false });

    } catch (v3Error) {
      console.error('[ZELREX] v3 fallback ALSO FAILED:', v3Error);
      console.error('[ZELREX] v3 error name:', (v3Error as Error).name);
      console.error('[ZELREX] v3 error message:', (v3Error as Error).message);
      if ((v3Error as any).status) console.error('[ZELREX] v3 API status:', (v3Error as any).status);
      if ((v3Error as any).error) console.error('[ZELREX] v3 API error body:', JSON.stringify((v3Error as any).error));

      // Last resort: return a helpful error with diagnostic info
      return NextResponse.json(
        {
          reply: "Something didn't load correctly on my side. Try again in a moment.",
          _debug: process.env.NODE_ENV === 'development' ? {
            error: (v3Error as Error).message,
            apiStatus: (v3Error as any).status,
          } : undefined,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    // Outermost catch — something failed before we even got to Claude
    console.error("[ZELREX] CRITICAL pre-Claude error:", error);
    console.error("[ZELREX] Error type:", (error as Error).constructor?.name);
    console.error("[ZELREX] Error message:", (error as Error).message);
    console.error("[ZELREX] Stack:", (error as Error).stack);

    return NextResponse.json(
      {
        reply: "Something didn't load correctly on my side. Try again in a moment.",
        _debug: process.env.NODE_ENV === 'development' ? {
          error: (error as Error).message,
          stack: (error as Error).stack,
        } : undefined,
      },
      { status: 500 }
    );
  }
}