/**
 * ZELREX COPY GENERATOR — v3
 * 
 * TWO PATHS:
 * 
 * 1. WITH SURVEY DATA (preferred):
 *    Builds copy directly from the user's answers. No AI call needed.
 *    Every price, deliverable, and contact method is REAL data the user typed.
 *    This is faster (~0ms vs ~8s), cheaper ($0 vs ~$0.15), and more accurate.
 * 
 * 2. WITHOUT SURVEY DATA (chat-only fallback):
 *    Calls Claude Sonnet to write bespoke copy from chat context.
 *    This is the original path. Still works, but produces less precise copy
 *    because it's inferring details from conversation fragments.
 * 
 * RULE: If survey data exists, ALWAYS use path 1. Never call the AI
 * when we already have the exact data we need.
 */

import Anthropic from "@anthropic-ai/sdk";
import { WebsiteCopy } from "./websiteCopy";
import { ZelrexWebsite } from "./websiteTypes";
import { BusinessContext, SurveyData } from "./buildWebsite";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Main entry point ───────────────────────────────────────────────

export async function generateWebsiteCopy(input: {
  branding: ZelrexWebsite["branding"];
  assumptions: any;
  businessContext?: BusinessContext;
  surveyData?: SurveyData;
}): Promise<WebsiteCopy> {
  const { branding, businessContext, surveyData } = input;

  // Path 1: Survey data exists — build copy directly from real data
  if (surveyData && surveyData.businessName) {
    console.log("ZELREX COPY: building from survey data (no AI call needed)");
    return buildCopyFromSurvey(branding, surveyData);
  }

  // Path 2: Chat context only — call AI for bespoke copy
  if (businessContext && businessContext.businessType) {
    try {
      console.log("ZELREX COPY: generating with AI from chat context");
      return await generateAICopy(branding, businessContext, input.assumptions);
    } catch (error) {
      console.error("ZELREX COPY: AI generation failed, using fallback", error);
    }
  }

  // Path 3: Nothing — basic defaults (should rarely happen)
  console.log("ZELREX COPY: using fallback defaults");
  return buildFallbackCopy(branding);
}

// ═════════════════════════════════════════════════════════════════════
// PATH 1: BUILD COPY FROM SURVEY DATA (PREFERRED)
// Every field comes from what the user actually typed.
// ═════════════════════════════════════════════════════════════════════

function buildCopyFromSurvey(
  branding: ZelrexWebsite["branding"],
  s: SurveyData
): WebsiteCopy {
  const name = s.businessName || branding.name || "My Business";
  const deliverables = s.deliverables.filter(Boolean);
  const hasTiers = s.hasMultipleTiers && s.tiers.length > 0 && s.tiers[0].name;

  // Build pricing display string
  const priceDisplay = hasTiers
    ? s.tiers.map(t => t.name).join(" / ")
    : s.price || "Contact for pricing";

  // Build contact methods from real data
  const contactMethods: Array<{ label: string; value: string; href: string }> = [];
  if (s.email) {
    contactMethods.push({ label: "Email", value: s.email, href: `mailto:${s.email}` });
  }
  if (s.phone) {
    contactMethods.push({ label: "Phone", value: s.phone, href: `tel:${s.phone.replace(/\D/g, "")}` });
  }
  if (s.calendlyUrl) {
    contactMethods.push({ label: "Book a call", value: "Schedule online", href: s.calendlyUrl });
  }
  if (contactMethods.length === 0) {
    contactMethods.push({ label: "Get in touch", value: "Send a message", href: "#contact" });
  }

  // Build pricing tiers from real data
  const pricingTiers = hasTiers
    ? s.tiers.filter(t => t.name).map((tier, i) => ({
        name: tier.name,
        price: tier.price || "Contact",
        note: i === 0 ? "Best for getting started" : i === 1 ? "Most popular" : "For ongoing needs",
        features: tier.features.filter(Boolean),
        highlighted: i === 1 || (s.tiers.length === 1 && i === 0),
      }))
    : [{
        name: s.mainService || name,
        price: s.price || "Contact for pricing",
        note: s.turnaround ? `Delivered in ${s.turnaround}` : "Tailored to your needs",
        features: deliverables.length > 0
          ? deliverables
          : ["Full service delivery", "Clear scope and timeline", "Professional execution"],
        highlighted: true,
      }];

  // CTA text based on business type
  const ctaText = s.calendlyUrl
    ? "Book your call"
    : s.email
      ? "Get in touch"
      : "Get started";

  // Build the "why me vs platforms" angle if they're leaving Upwork/Fiverr
  const leavingPlatform = s.platformsLeavingFrom?.trim();

  return {
    home: {
      hero: {
        headline: s.uniqueSellingPoint || s.tagline || `${s.mainService} for ${s.targetAudience}`,
        subheadline: s.serviceDescription || s.tagline || `${name} helps ${s.targetAudience} with ${s.mainService}.`,
      },
      valueProps: {
        eyebrow: "Why " + name,
        title: leavingPlatform
          ? `Skip the ${leavingPlatform} fees. Work with me directly.`
          : `What makes ${name} different`,
        subtitle: s.uniqueSellingPoint || `Professional ${s.businessType} built around your needs.`,
        items: deliverables.length >= 3
          ? deliverables.slice(0, 6).map((d, i) => ({
              title: d,
              description: i === 0
                ? `Core deliverable included in every ${s.pricingModel === "package" ? "package" : "engagement"}.`
                : "Included as standard.",
            }))
          : [
              { title: s.mainService || "Expert service", description: s.serviceDescription || "Professional execution tailored to your needs." },
              { title: s.turnaround ? `${s.turnaround} delivery` : "Fast turnaround", description: "No unnecessary delays. Clear timelines from day one." },
              { title: "Direct communication", description: "Work with me directly. No middlemen, no platform fees, no surprises." },
            ],
      },
      howItWorks: {
        eyebrow: "Process",
        title: `How working with ${name} works`,
        subtitle: "A clear process from first contact to final delivery.",
        steps: [
          { title: "Share your brief", description: s.calendlyUrl ? "Book a call or send me the details of what you need." : "Tell me what you need and I'll confirm if it's a good fit." },
          { title: "I get to work", description: `I'll deliver ${s.mainService || "your project"} ${s.turnaround ? `within ${s.turnaround}` : "on the agreed timeline"}.` },
          { title: "Review and launch", description: s.guarantee || "Review the work, request any adjustments, and launch with confidence." },
        ],
      },
      socialProof: {
        eyebrow: "The approach",
        title: "Built on results, not promises",
        subtitle: "Clear deliverables. Direct communication. No platform overhead.",
        items: [
          { label: "Delivery", value: s.turnaround || "Fast", detail: "clear timelines, no surprises" },
          { label: "Pricing", value: s.pricingModel === "hourly" ? "Hourly" : s.pricingModel === "retainer" ? "Monthly" : "Fixed", detail: "transparent, no hidden fees" },
          { label: "Communication", value: "Direct", detail: "work with me, not a middleman" },
        ],
      },
      primaryCta: {
        title: `Ready to start your ${s.businessType || "project"}?`,
        subtitle: s.guarantee || "No commitment required. Let's talk about what you need.",
        cta: { text: ctaText, urgencyLine: undefined, intent: "primary" },
      },
    },

    offer: {
      hero: {
        headline: s.mainService || `${s.businessType} services`,
        subheadline: s.serviceDescription || `Professional ${s.businessType} for ${s.targetAudience}.`,
      },
      whatYouGet: {
        eyebrow: "What's included",
        title: "Everything you get",
        subtitle: "Clear deliverables. No mystery, no hidden scope.",
        items: deliverables.length > 0
          ? deliverables.map(d => ({ title: d, description: "Included as standard in every engagement." }))
          : [
              { title: s.mainService || "Core service", description: "The primary deliverable tailored to your needs." },
              { title: "Revisions", description: "Adjustments until you're satisfied with the result." },
              { title: "Direct support", description: "Communicate with me directly throughout the process." },
            ],
      },
      whoItsFor: {
        eyebrow: "Fit check",
        title: "This is for you if…",
        subtitle: "I work best with people who value quality and clear communication.",
        items: [
          { title: `You need professional ${s.businessType}`, description: `You know what you want and you're ready to invest in quality ${s.businessType}.` },
          { title: "You value direct relationships", description: leavingPlatform ? `You're tired of ${leavingPlatform} fees and want to work directly with the person doing the work.` : "You want to work with the person doing the work, not a sales team." },
          { title: "You respect timelines", description: `I deliver on time. I expect the same respect for the process in return.` },
        ],
      },
      cta: {
        title: "Let's work together",
        subtitle: s.guarantee || "Start with a conversation. No pressure.",
        cta: { text: ctaText, urgencyLine: undefined, intent: "primary" },
      },
    },

    pricing: {
      hero: {
        headline: "Pricing",
        subheadline: s.pricingModel === "project"
          ? "Every project is scoped individually. Here's what to expect."
          : "Transparent pricing. No hidden fees.",
      },
      pricing: {
        eyebrow: "Investment",
        title: hasTiers ? "Choose your level" : "Simple pricing",
        subtitle: s.guarantee
          ? `${s.guarantee}`
          : "Clear scope. Clear price. No surprises.",
        tiers: pricingTiers,
      },
      cta: {
        title: "Ready to get started?",
        subtitle: "Reach out and I'll confirm availability.",
        cta: { text: ctaText, intent: "primary" },
      },
    },

    about: {
      hero: {
        headline: `About ${name}`,
        subheadline: s.aboutStory
          ? s.aboutStory.split(".")[0] + "."
          : `Professional ${s.businessType} built on experience and direct relationships.`,
      },
      story: {
        eyebrow: "The story",
        title: `Why ${name} exists`,
        body: s.aboutStory || `${name} was built to deliver professional ${s.businessType} without the overhead of platforms or agencies. ${s.uniqueSellingPoint || `I work directly with ${s.targetAudience} to deliver clear, measurable results.`}`,
      },
      values: {
        eyebrow: "Principles",
        title: "What I optimize for",
        items: [
          { title: "Quality over volume", description: "I take on a limited number of projects to give each one the attention it deserves." },
          { title: "Clear communication", description: "You'll always know where your project stands. No guessing." },
          { title: "Results that matter", description: `Every ${s.businessType} deliverable is designed to produce a real outcome, not just look good.` },
        ],
      },
      cta: {
        title: `Want to work with ${name}?`,
        subtitle: "Start with a conversation.",
        cta: { text: ctaText, intent: "primary" },
      },
    },

    contact: {
      hero: {
        headline: "Get in touch",
        subheadline: s.hours
          ? `Available ${s.hours}. ${s.location ? `Based in ${s.location}.` : ""}`
          : s.location
            ? `Based in ${s.location}. Available for remote work worldwide.`
            : "I respond within 24 hours.",
      },
      methods: {
        eyebrow: "Contact",
        title: "How to reach me",
        subtitle: "Pick whichever works best for you.",
        items: contactMethods,
      },
      nextSteps: {
        eyebrow: "What happens next",
        title: "After you reach out",
        items: [
          { title: "I'll respond within 24 hours", description: "With questions or a confirmation that I can help." },
          { title: "We'll scope the work", description: `I'll send you a clear proposal with deliverables, timeline${s.pricingModel === "project" ? ", and a fixed price" : ""}.` },
          { title: "Work begins", description: `Once confirmed, I start immediately. ${s.turnaround ? `Expect delivery in ${s.turnaround}.` : ""}` },
        ],
      },
      cta: {
        title: "Let's start",
        subtitle: "One message is all it takes.",
        cta: { text: ctaText, intent: "primary" },
      },
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// PATH 2: AI COPY GENERATION (CHAT-ONLY FALLBACK)
// Used when building from conversation context without survey.
// ═════════════════════════════════════════════════════════════════════

async function generateAICopy(
  branding: ZelrexWebsite["branding"],
  ctx: BusinessContext,
  assumptions: any
): Promise<WebsiteCopy> {
  const prompt = `You are a world-class freelancer website copywriter. Write all the copy for a freelance service website.

BUSINESS DETAILS:
- Business name: ${branding.name}
- Business type: ${ctx.businessType} (this is a freelancer/service provider)
- Target audience: ${ctx.audience}
- Core offer: ${ctx.offer}
- Pricing: ${ctx.pricing}
- Brand tone: ${branding.tone}
- Tagline: ${branding.tagline || "none provided"}

CRITICAL RULES:
- This is a FREELANCER website. Write as "I" not "we" unless it's an agency.
- Every headline must be specific to THIS business, not generic
- No fake claims, no "10,000 customers", no unverifiable stats
- No exclamation marks, no hype words like "revolutionary" or "game-changing"
- CTAs must be concrete: "Book your call", "Send your brief", not "Learn more"
- Pricing must show "${ctx.pricing}" exactly — never "$X" or placeholders
- Keep descriptions concise — 1-2 sentences max per item
- The tone should be "${branding.tone}" throughout
- The "who it's for" section must EXCLUDE people who aren't a fit

Return ONLY a valid JSON object matching this exact structure (no markdown, no backticks):

{
  "home": {
    "hero": {
      "headline": "specific headline — not 'Welcome to [name]'",
      "subheadline": "one sentence explaining what this freelancer does and for whom"
    },
    "valueProps": {
      "eyebrow": "2-3 word label",
      "title": "why this person specifically is worth hiring",
      "subtitle": "one sentence",
      "items": [
        { "title": "benefit 1", "description": "1-2 sentences" },
        { "title": "benefit 2", "description": "1-2 sentences" },
        { "title": "benefit 3", "description": "1-2 sentences" }
      ]
    },
    "howItWorks": {
      "eyebrow": "Process",
      "title": "how working together works",
      "subtitle": "one sentence",
      "steps": [
        { "title": "step 1", "description": "what happens" },
        { "title": "step 2", "description": "what happens" },
        { "title": "step 3", "description": "what happens" }
      ]
    },
    "socialProof": {
      "eyebrow": "The approach",
      "title": "proof of quality — focus on process, not fake metrics",
      "subtitle": "one sentence",
      "items": [
        { "label": "label", "value": "value", "detail": "context" },
        { "label": "label", "value": "value", "detail": "context" },
        { "label": "label", "value": "value", "detail": "context" }
      ]
    },
    "primaryCta": {
      "title": "action headline",
      "subtitle": "friction reducer",
      "cta": { "text": "specific CTA text", "urgencyLine": null, "intent": "primary" }
    }
  },
  "offer": {
    "hero": { "headline": "offer headline", "subheadline": "one sentence" },
    "whatYouGet": {
      "eyebrow": "Included",
      "title": "what you get",
      "subtitle": "one sentence",
      "items": [
        { "title": "deliverable 1", "description": "what this is" },
        { "title": "deliverable 2", "description": "what this is" },
        { "title": "deliverable 3", "description": "what this is" }
      ]
    },
    "whoItsFor": {
      "eyebrow": "Fit",
      "title": "who this is for — must exclude people",
      "subtitle": "one sentence",
      "items": [
        { "title": "trait 1", "description": "why" },
        { "title": "trait 2", "description": "why" },
        { "title": "trait 3", "description": "why" }
      ]
    },
    "cta": { "title": "offer CTA", "subtitle": "one sentence", "cta": { "text": "CTA text", "urgencyLine": null, "intent": "primary" } }
  },
  "pricing": {
    "hero": { "headline": "Pricing", "subheadline": "pricing subtitle" },
    "pricing": {
      "eyebrow": "Investment",
      "title": "pricing title",
      "subtitle": "one sentence",
      "tiers": [{
        "name": "tier name",
        "price": "${ctx.pricing}",
        "note": "what this is best for",
        "features": ["feature 1", "feature 2", "feature 3", "feature 4"],
        "highlighted": true
      }]
    },
    "cta": { "title": "CTA", "subtitle": "one sentence", "cta": { "text": "CTA text", "intent": "primary" } }
  },
  "about": {
    "hero": { "headline": "About ${branding.name}", "subheadline": "subtitle" },
    "story": { "eyebrow": "The story", "title": "why this exists", "body": "2-3 sentences. No fake founder story." },
    "values": {
      "eyebrow": "Principles",
      "title": "what I optimize for",
      "items": [
        { "title": "value 1", "description": "one sentence" },
        { "title": "value 2", "description": "one sentence" },
        { "title": "value 3", "description": "one sentence" }
      ]
    },
    "cta": { "title": "CTA", "subtitle": "one sentence", "cta": { "text": "CTA text", "intent": "primary" } }
  },
  "contact": {
    "hero": { "headline": "Get in touch", "subheadline": "contact subtitle" },
    "methods": {
      "eyebrow": "Contact",
      "title": "How to reach me",
      "subtitle": "one sentence",
      "items": [
        { "label": "Email", "value": "hello@yourdomain.com", "href": "mailto:hello@yourdomain.com" },
        { "label": "Booking", "value": "Schedule a call", "href": "#booking" }
      ]
    },
    "nextSteps": {
      "eyebrow": "What happens next",
      "title": "after you reach out",
      "items": [
        { "title": "step 1", "description": "what happens" },
        { "title": "step 2", "description": "what happens" },
        { "title": "step 3", "description": "what happens" }
      ]
    },
    "cta": { "title": "CTA", "subtitle": "one sentence", "cta": { "text": "CTA text", "intent": "primary" } }
  }
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    temperature: 0.6,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content?.[0]?.type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned) as WebsiteCopy;

  if (!parsed.home?.hero?.headline || !parsed.offer?.hero?.headline) {
    throw new Error("AI copy missing required fields");
  }

  return parsed;
}

// ═════════════════════════════════════════════════════════════════════
// PATH 3: FALLBACK DEFAULTS (EMERGENCY ONLY)
// ═════════════════════════════════════════════════════════════════════

function buildFallbackCopy(branding: ZelrexWebsite["branding"]): WebsiteCopy {
  const name = branding.name || "My Business";
  return {
    home: {
      hero: {
        headline: `${name}: professional results, direct relationship.`,
        subheadline: branding.tagline || "Quality work. Clear timelines. No platform overhead.",
      },
      valueProps: {
        eyebrow: "Why " + name,
        title: "Work directly with the person doing the work",
        subtitle: "No middlemen. No platform fees. Just clear deliverables and honest communication.",
        items: [
          { title: "Direct communication", description: "Talk to the person doing the work, not a project manager." },
          { title: "Clear deliverables", description: "You'll know exactly what you're getting before we start." },
          { title: "Fast turnaround", description: "No bureaucracy means faster delivery." },
        ],
      },
      howItWorks: {
        eyebrow: "Process",
        title: "How it works",
        subtitle: "A simple process from start to finish.",
        steps: [
          { title: "Share your brief", description: "Tell me what you need." },
          { title: "I deliver the work", description: "Professional execution on your timeline." },
          { title: "Review and refine", description: "Adjustments until you're satisfied." },
        ],
      },
      socialProof: {
        eyebrow: "The approach",
        title: "Built on clarity and quality",
        subtitle: "Every project starts with clear expectations.",
        items: [
          { label: "Delivery", value: "On time", detail: "every time" },
          { label: "Pricing", value: "Transparent", detail: "no hidden fees" },
          { label: "Quality", value: "Professional", detail: "built to last" },
        ],
      },
      primaryCta: {
        title: "Ready to start?",
        subtitle: "No commitment required.",
        cta: { text: "Get in touch", intent: "primary" },
      },
    },
    offer: {
      hero: { headline: "What I offer", subheadline: "Clear deliverables, professional execution." },
      whatYouGet: {
        eyebrow: "Included", title: "What you get", subtitle: "Everything included.",
        items: [
          { title: "Core service", description: "The primary deliverable." },
          { title: "Revisions", description: "Until you're satisfied." },
          { title: "Direct support", description: "Communicate with me directly." },
        ],
      },
      whoItsFor: {
        eyebrow: "Fit", title: "Who this is for", subtitle: "Best for people who value quality.",
        items: [
          { title: "You need professional work", description: "Not a DIY template." },
          { title: "You value direct relationships", description: "No middlemen." },
          { title: "You respect timelines", description: "Mutual professionalism." },
        ],
      },
      cta: { title: "Let's work together", subtitle: "Start with a conversation.", cta: { text: "Get in touch", intent: "primary" } },
    },
    pricing: {
      hero: { headline: "Pricing", subheadline: "Transparent. No surprises." },
      pricing: {
        eyebrow: "Investment", title: "Simple pricing", subtitle: "Clear scope, clear price.",
        tiers: [{ name: name, price: "Contact for pricing", note: "Tailored to your needs", features: ["Full service", "Clear timeline", "Professional quality"], highlighted: true }],
      },
      cta: { title: "Get started", subtitle: "Reach out to discuss.", cta: { text: "Get in touch", intent: "primary" } },
    },
    about: {
      hero: { headline: `About ${name}`, subheadline: "Professional quality. Direct relationships." },
      story: { eyebrow: "The story", title: `Why ${name} exists`, body: `${name} was built to deliver professional work without the overhead of platforms or agencies.` },
      values: {
        eyebrow: "Principles", title: "What I optimize for",
        items: [
          { title: "Quality", description: "Every deliverable meets a professional standard." },
          { title: "Clarity", description: "You'll always know where things stand." },
          { title: "Results", description: "Work that produces real outcomes." },
        ],
      },
      cta: { title: `Work with ${name}`, subtitle: "Start with a conversation.", cta: { text: "Get in touch", intent: "primary" } },
    },
    contact: {
      hero: { headline: "Get in touch", subheadline: "I respond within 24 hours." },
      methods: {
        eyebrow: "Contact", title: "How to reach me", subtitle: "Pick what works best.",
        items: [{ label: "Email", value: "hello@yourdomain.com", href: "mailto:hello@yourdomain.com" }],
      },
      nextSteps: {
        eyebrow: "What happens next", title: "After you reach out",
        items: [
          { title: "I'll respond within 24 hours", description: "With questions or confirmation." },
          { title: "We scope the work", description: "Clear deliverables, clear timeline." },
          { title: "Work begins", description: "On time, as described." },
        ],
      },
      cta: { title: "Start the conversation", subtitle: "One message is enough.", cta: { text: "Send a message", intent: "primary" } },
    },
  };
}