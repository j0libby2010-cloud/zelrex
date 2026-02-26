// website/core/generateCopy.ts
//
// REWRITE: Uses Claude to generate genuinely unique, business-specific website copy.
// The old version was 100% hardcoded templates — every site got identical text.
// Now each website gets bespoke copy written by Claude based on full survey data.

import Anthropic from "@anthropic-ai/sdk";
import { WebsiteCopy } from "./websiteCopy";
import { ZelrexWebsite } from "./websiteTypes";
import { ZelrexAssumptions } from "./deriveAssumptions";

// Re-export SurveyData so buildWebsite and route can import from one place
export interface SurveyData {
  businessName: string;
  tagline: string;
  businessType: string;
  targetAudience: string;
  mainService: string;
  serviceDescription: string;
  deliverables: string[];
  turnaround: string;
  pricingModel: "package" | "hourly" | "retainer" | "project";
  price: string;
  hasMultipleTiers: boolean;
  tiers: Array<{ name: string; price: string; features: string[] }>;
  guarantee: string;
  primaryColor: string;
  stylePreference: "dark-premium" | "light-clean" | "bold-colorful" | "minimal-elegant";
  fontPreference: "modern" | "classic" | "editorial" | "tech";
  email: string;
  phone: string;
  location: string;
  hours: string;
  socialLinks: { platform: string; url: string }[];
  calendlyUrl: string;
  aboutStory: string;
  uniqueSellingPoint: string;
  platformsLeavingFrom: string;
}

interface CopyInput {
  branding: ZelrexWebsite["branding"];
  assumptions?: ZelrexAssumptions;
  businessContext?: {
    businessType: string;
    audience: string;
    offer: string;
    pricing: string;
  };
  surveyData?: SurveyData;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── The prompt that makes every website unique ──────────────────────

function buildCopyPrompt(input: CopyInput): string {
  const sv = input.surveyData;
  const b = input.branding;
  const ctx = input.businessContext;

  // If we have survey data, use it extensively
  if (sv) {
    const tiersBlock = sv.hasMultipleTiers && sv.tiers.length > 0
      ? sv.tiers.map((t, i) => `  Tier ${i + 1}: "${t.name}" at ${t.price} — includes: ${t.features.filter(Boolean).join(", ")}`).join("\n")
      : `  Single price: ${sv.price} (${sv.pricingModel} model)`;

    const deliverablesBlock = sv.deliverables.filter(Boolean).join(", ");

    return `You are a world-class freelance copywriter. Write ALL website copy for this specific business. Every word must be written for THIS exact business — no generic templates, no filler.

BUSINESS PROFILE:
- Name: "${sv.businessName}"
- Tagline: "${sv.tagline || "(none provided — write one)"}"
- Service type: ${sv.businessType}
- Main service: "${sv.mainService}"
- What the client gets: "${sv.serviceDescription}"
- Specific deliverables: ${deliverablesBlock || "Not specified"}
- Turnaround: ${sv.turnaround || "Not specified"}
- Target audience: "${sv.targetAudience}"
- Unique selling point: "${sv.uniqueSellingPoint || "(none provided — infer one from the service)"}"
- Guarantee: "${sv.guarantee || "(none)"}"
- Leaving platforms: ${sv.platformsLeavingFrom || "Not specified"}

PRICING:
${tiersBlock}

ABOUT THE PERSON:
${sv.aboutStory || "No personal story provided — write a compelling 2-sentence origin story based on their service type and audience."}

BRAND VOICE:
- Style: ${sv.stylePreference} 
- Tone: ${b.tone}
- Font feel: ${sv.fontPreference}

COPYWRITING RULES — FOLLOW THESE EXACTLY:
1. Headlines must be specific to THIS business. Never "Welcome to [name]" or "What we offer". Instead, lead with the outcome or transformation. E.g., for a video editor: "Your content, edited to convert." For a designer: "Brand identity that closes deals."
2. Subheadlines expand the headline with one specific, concrete detail.
3. Value prop items must describe what THIS specific freelancer actually does — use their deliverables, not generic benefits.
4. "How it works" steps must describe THIS person's actual process, not a generic 3-step template.
5. "Who it's for" items must describe their ACTUAL target audience with specific, recognizable pain points.
6. Pricing must use their REAL prices and tier names. Never "$—" or placeholder prices.
7. The about story must feel personal and authentic. If they provided one, enhance it. If not, write something believable for their service type.
8. CTAs should use action verbs specific to the service: "Book your edit", "Start your rebrand", "Schedule a strategy call" — NOT "Get started" or "Learn more".
9. Contact section must feel inviting and specific to how this freelancer works.
10. NEVER use these words/phrases: "streamline", "leverage", "game-changer", "take your X to the next level", "in today's fast-paced", "comprehensive solution", "cutting-edge". Write like a human, not a chatbot.
11. Every section needs at least 3-4 items (value props, deliverables, features, etc.)
12. The entire site should feel like ONE coherent voice, not disconnected sections.

Return ONLY valid JSON matching this exact structure. No markdown, no backticks, no explanation.

{
  "home": {
    "hero": { "headline": "...", "subheadline": "..." },
    "valueProps": {
      "eyebrow": "...",
      "title": "...",
      "subtitle": "...",
      "items": [{ "title": "...", "description": "..." }, ...]
    },
    "howItWorks": {
      "eyebrow": "...",
      "title": "...",
      "subtitle": "...",
      "steps": [{ "title": "...", "description": "..." }, ...]
    },
    "socialProof": {
      "eyebrow": "...",
      "title": "...",
      "subtitle": "...",
      "items": [{ "label": "...", "value": "...", "detail": "..." }, ...]
    },
    "primaryCta": {
      "title": "...",
      "subtitle": "...",
      "cta": { "text": "...", "intent": "primary" }
    }
  },
  "offer": {
    "hero": { "headline": "...", "subheadline": "..." },
    "whatYouGet": {
      "eyebrow": "...",
      "title": "...",
      "subtitle": "...",
      "items": [{ "title": "...", "description": "..." }, ...]
    },
    "whoItsFor": {
      "eyebrow": "...",
      "title": "...",
      "subtitle": "...",
      "items": [{ "title": "...", "description": "..." }, ...]
    },
    "cta": {
      "title": "...",
      "subtitle": "...",
      "cta": { "text": "...", "intent": "primary" }
    }
  },
  "pricing": {
    "hero": { "headline": "...", "subheadline": "..." },
    "pricing": {
      "eyebrow": "...",
      "title": "...",
      "subtitle": "...",
      "tiers": [{ "name": "...", "price": "...", "note": "...", "features": ["..."], "highlighted": true/false }, ...]
    },
    "cta": {
      "title": "...",
      "subtitle": "...",
      "cta": { "text": "...", "intent": "primary" }
    }
  },
  "about": {
    "hero": { "headline": "...", "subheadline": "..." },
    "story": {
      "eyebrow": "...",
      "title": "...",
      "body": "..."
    },
    "values": {
      "eyebrow": "...",
      "title": "...",
      "items": [{ "title": "...", "description": "..." }, ...]
    },
    "cta": {
      "title": "...",
      "subtitle": "...",
      "cta": { "text": "...", "intent": "primary" }
    }
  },
  "contact": {
    "hero": { "headline": "...", "subheadline": "..." },
    "methods": {
      "eyebrow": "...",
      "title": "...",
      "subtitle": "...",
      "items": [{ "label": "...", "value": "...", "href": "..." }, ...]
    },
    "nextSteps": {
      "eyebrow": "...",
      "title": "...",
      "items": [{ "title": "...", "description": "..." }, ...]
    },
    "cta": {
      "title": "...",
      "subtitle": "...",
      "cta": { "text": "...", "intent": "primary" }
    }
  }
}`;
  }

  // Fallback: chat-only context (no survey)
  return `You are a world-class freelance copywriter. Write all website copy for this business.

Business: "${b.name}"
Tagline: "${b.tagline || ""}"
Tone: ${b.tone}
Type: ${ctx?.businessType || "freelance service"}
Audience: ${ctx?.audience || "professionals"}
Offer: ${ctx?.offer || "consulting"}
Pricing: ${ctx?.pricing || "custom"}

Write specific, unique copy. No generic templates. Lead with outcomes, not descriptions. Use action verbs for CTAs.

Return ONLY valid JSON in the exact structure shown above (home, offer, pricing, about, contact). No markdown.`;
}

// ─── Generate copy via Claude ────────────────────────────────────────

export async function generateWebsiteCopy(input: CopyInput): Promise<WebsiteCopy> {
  const prompt = buildCopyPrompt(input);

  try {
    console.log("ZELREX COPY: generating bespoke copy via Claude...");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      temperature: 0.7, // Higher temp = more creative, unique copy
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content?.[0]?.type === "text" ? response.content[0].text : "";
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();

    let copy: WebsiteCopy;
    try {
      copy = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("ZELREX COPY: JSON parse failed, attempting repair...");
      // Try to extract JSON from potential surrounding text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        copy = JSON.parse(jsonMatch[0]);
      } else {
        throw parseError;
      }
    }

    // Inject real contact methods from survey if available
    if (input.surveyData) {
      const sv = input.surveyData;
      const methods: Array<{ label: string; value: string; href?: string }> = [];
      if (sv.email) methods.push({ label: "Email", value: sv.email, href: `mailto:${sv.email}` });
      if (sv.phone) methods.push({ label: "Phone", value: sv.phone, href: `tel:${sv.phone.replace(/\D/g, "")}` });
      if (sv.calendlyUrl) methods.push({ label: "Book a call", value: "Schedule a time", href: sv.calendlyUrl });
      if (sv.location) methods.push({ label: "Location", value: sv.location });
      if (sv.hours) methods.push({ label: "Hours", value: sv.hours });

      if (methods.length > 0) {
        copy.contact.methods.items = methods;
      }

      // Ensure pricing uses real data
      if (sv.hasMultipleTiers && sv.tiers.length > 0) {
        const realTiers = sv.tiers
          .filter((t) => t.name && t.price)
          .map((t, i) => ({
            name: t.name,
            price: t.price,
            note: copy.pricing?.pricing?.tiers?.[i]?.note || "",
            features: t.features.filter(Boolean).length > 0 ? t.features.filter(Boolean) : copy.pricing?.pricing?.tiers?.[i]?.features || [],
            highlighted: i === Math.floor(sv.tiers.filter((t) => t.name && t.price).length / 2), // highlight middle tier
          }));
        if (realTiers.length > 0) {
          copy.pricing.pricing.tiers = realTiers;
        }
      } else if (sv.price) {
        // Single price — make sure it appears
        if (copy.pricing?.pricing?.tiers) {
          copy.pricing.pricing.tiers = copy.pricing.pricing.tiers.map((tier) => ({
            ...tier,
            price: tier.price.includes("$") ? tier.price : sv.price,
          }));
        }
      }
    }

    console.log("ZELREX COPY: bespoke copy generated successfully");
    return copy;

  } catch (error) {
    console.error("ZELREX COPY: Claude generation failed, using enhanced fallback", error);
    return buildFallbackCopy(input);
  }
}

// ─── Fallback: survey-aware template (better than old hardcoded version) ──

function buildFallbackCopy(input: CopyInput): WebsiteCopy {
  const b = input.branding;
  const sv = input.surveyData;
  const ctx = input.businessContext;
  const name = b.name;
  const service = sv?.mainService || ctx?.offer || "our service";
  const audience = sv?.targetAudience || ctx?.audience || "our clients";
  const tagline = b.tagline || sv?.tagline || `Professional ${sv?.businessType || "services"}`;

  return {
    home: {
      hero: {
        headline: sv?.uniqueSellingPoint || `${name}: ${service} that delivers.`,
        subheadline: tagline,
      },
      valueProps: {
        eyebrow: "Why " + name,
        title: `What makes ${name} different`,
        subtitle: `Built for ${audience}.`,
        items: sv?.deliverables?.filter(Boolean).map((d) => ({
          title: d,
          description: `Included in every ${sv?.pricingModel || "project"}.`,
        })) || [
          { title: service, description: `Tailored for ${audience}.` },
          { title: "Fast turnaround", description: sv?.turnaround ? `Delivered in ${sv.turnaround}.` : "Quick delivery without cutting corners." },
          { title: "Direct communication", description: "Work directly with me — no middlemen, no delays." },
        ],
      },
      howItWorks: {
        eyebrow: "Process",
        title: `How ${name} works`,
        subtitle: "A clear, repeatable process from start to finish.",
        steps: [
          { title: "Tell me what you need", description: `Share your goals and I'll scope the ${sv?.pricingModel || "project"}.` },
          { title: "I get to work", description: sv?.serviceDescription || `I deliver ${service} tailored to your needs.` },
          { title: "You review and launch", description: sv?.turnaround ? `Typical turnaround: ${sv.turnaround}. Revisions included.` : "Quick review, easy revisions, fast delivery." },
        ],
      },
      socialProof: {
        eyebrow: "Results",
        title: "Built for real outcomes",
        subtitle: `${name} is designed around what actually matters.`,
        items: [
          { label: "Turnaround", value: sv?.turnaround || "Fast", detail: "from brief to delivery" },
          { label: "Communication", value: "Direct", detail: "no account managers in between" },
          { label: "Quality", value: "Premium", detail: sv?.guarantee || "satisfaction guaranteed" },
        ],
      },
      primaryCta: {
        title: `Ready to get started with ${name}?`,
        subtitle: `${audience} — this is built for you.`,
        cta: { text: sv?.calendlyUrl ? "Book a call" : "Get in touch", intent: "primary" },
      },
    },
    offer: {
      hero: {
        headline: sv?.mainService || "What I offer",
        subheadline: sv?.serviceDescription || `Professional ${sv?.businessType || "services"} for ${audience}.`,
      },
      whatYouGet: {
        eyebrow: "Deliverables",
        title: "What's included",
        subtitle: sv?.serviceDescription || "",
        items: sv?.deliverables?.filter(Boolean).map((d) => ({
          title: d,
          description: `Part of the ${sv?.mainService || "package"}.`,
        })) || [
          { title: service, description: `Customized for ${audience}.` },
        ],
      },
      whoItsFor: {
        eyebrow: "Ideal client",
        title: "Is this for you?",
        subtitle: `${name} works best with ${audience}.`,
        items: [
          { title: audience, description: `If this sounds like you, we're a great fit.` },
          { title: "You value quality", description: "You want work that represents your brand well." },
          { title: "You want a partner, not a vendor", description: "Direct collaboration, honest feedback, real results." },
        ],
      },
      cta: {
        title: "Let's talk about your project",
        subtitle: sv?.guarantee || "No commitment — just a conversation about what you need.",
        cta: { text: sv?.calendlyUrl ? "Book a call" : "Reach out", intent: "primary" },
      },
    },
    pricing: {
      hero: {
        headline: "Pricing",
        subheadline: "Transparent pricing. No surprises.",
      },
      pricing: {
        eyebrow: "Investment",
        title: "Simple, clear pricing",
        subtitle: sv?.pricingModel === "hourly" ? "Billed by the hour." : sv?.pricingModel === "retainer" ? "Monthly retainer." : "Fixed-price packages.",
        tiers: sv?.hasMultipleTiers && sv.tiers.length > 0
          ? sv.tiers.filter((t) => t.name && t.price).map((t, i, arr) => ({
              name: t.name,
              price: t.price,
              note: "",
              features: t.features.filter(Boolean),
              highlighted: i === Math.floor(arr.length / 2),
            }))
          : [{ name: sv?.mainService || service, price: sv?.price || "Custom", note: "", features: sv?.deliverables?.filter(Boolean) || ["Custom scope"], highlighted: true }],
      },
      cta: {
        title: "Questions about pricing?",
        subtitle: "Happy to walk you through the options.",
        cta: { text: "Get in touch", intent: "primary" },
      },
    },
    about: {
      hero: {
        headline: `About ${name}`,
        subheadline: tagline,
      },
      story: {
        eyebrow: "My story",
        title: `The person behind ${name}`,
        body: sv?.aboutStory || `${name} was built to serve ${audience} with premium ${sv?.businessType || "services"}. Every project is handled personally with the care and attention it deserves.`,
      },
      values: {
        eyebrow: "Values",
        title: "How I work",
        items: [
          { title: "Quality over quantity", description: "I take on a limited number of clients to give each one my full attention." },
          { title: "Clear communication", description: "You'll always know where your project stands." },
          { title: "Results-driven", description: `Everything I do is designed to get you real outcomes.` },
        ],
      },
      cta: {
        title: `Want to work with ${name}?`,
        subtitle: "Let's start a conversation.",
        cta: { text: "Get in touch", intent: "primary" },
      },
    },
    contact: {
      hero: {
        headline: "Get in touch",
        subheadline: `Let's talk about how ${name} can help.`,
      },
      methods: {
        eyebrow: "Contact",
        title: "Reach out",
        subtitle: "Pick whatever works best for you.",
        items: [
          ...(sv?.email ? [{ label: "Email", value: sv.email, href: `mailto:${sv.email}` }] : []),
          ...(sv?.phone ? [{ label: "Phone", value: sv.phone, href: `tel:${sv.phone.replace(/\D/g, "")}` }] : []),
          ...(sv?.calendlyUrl ? [{ label: "Book a call", value: "Schedule a time", href: sv.calendlyUrl }] : []),
          ...(sv?.location ? [{ label: "Location", value: sv.location }] : []),
          ...(sv?.hours ? [{ label: "Hours", value: sv.hours }] : []),
        ],
      },
      nextSteps: {
        eyebrow: "What happens next",
        title: "How it starts",
        items: [
          { title: "You reach out", description: "Send a message or book a call." },
          { title: "We scope the work", description: `I'll learn about your needs and put together a clear plan.` },
          { title: "We get started", description: sv?.turnaround ? `Typical turnaround: ${sv.turnaround}.` : "Fast, focused execution." },
        ],
      },
      cta: {
        title: "Ready?",
        subtitle: "One message is all it takes.",
        cta: { text: sv?.calendlyUrl ? "Book a call" : "Send a message", intent: "primary" },
      },
    },
  };
}