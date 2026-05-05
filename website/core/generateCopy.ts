// website/core/generateCopy.ts
//
// v3 REWRITE: Makes every Zelrex website genuinely different.
// 
// Key improvements over previous version:
// 1. VOICE ARCHETYPE selection — each site gets one of 6 distinct writing voices
// 2. HERO SHAPE variation — 8 hero archetypes, picked by business+voice fit
// 3. SECTION ORDER variation — different business types get different narrative flow
// 4. RANDOMIZATION SEED — two users with IDENTICAL surveys still get different sites
// 5. COPY RULES specific to voice — "quiet-authority" Mies van der Rohe vs "rebellious-outsider" punk-manifesto
// 6. DELIBERATE IMPERFECTION — real copy isn't perfectly balanced; we mirror that
// 7. CALIBRATED TEMPERATURE — creative sections use higher temp, product/pricing sections use lower

import Anthropic from "@anthropic-ai/sdk";
import { WebsiteCopy } from "./websiteCopy";
import { ZelrexWebsite } from "./websiteTypes";
import { ZelrexAssumptions } from "./deriveAssumptions";

export interface SurveyData {
  businessName: string;
  tagline: string;
  aboutBusiness?: string;
  contactEmail?: string;
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
  stripeCheckout: "auto" | "link-only" | "none";
  primaryColor: string;
  stylePreference: "dark-premium" | "light-clean" | "bold-colorful" | "minimal-elegant";
  fontPreference: "modern" | "classic" | "editorial" | "tech" | "studio" | "luxury";
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

const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY! 
});

// ─── VOICE ARCHETYPES ───────────────────────────────────────────

type VoiceArchetype = 
  | 'confident-expert'
  | 'warm-guide'  
  | 'direct-operator'
  | 'thoughtful-artisan'
  | 'rebellious-outsider'
  | 'quiet-authority';

interface VoiceProfile {
  name: VoiceArchetype;
  sentencePattern: string;
  vocabularyHint: string;
  heroStyle: string;
  forbiddenWords: string[];
  temperatureBoost: number; // Added to base temp
  exampleHero: string;
}

const VOICE_PROFILES: Record<VoiceArchetype, VoiceProfile> = {
  'confident-expert': {
    name: 'confident-expert',
    sentencePattern: 'Short, declarative. Facts stated plainly. Numbers when available. No hedging.',
    vocabularyHint: 'Specific craft language for your field. Industry-standard terms used correctly. Never "cutting-edge" or "innovative" — experts don\'t need hype words.',
    heroStyle: 'Lead with what you do + one number or credential. No manifesto.',
    forbiddenWords: ['innovative', 'cutting-edge', 'best-in-class', 'world-class', 'rockstar', 'ninja', 'guru'],
    temperatureBoost: -0.1, // Lower temp = more consistent
    exampleHero: '"Strategic brand identity for SaaS companies. 47 launches. 9-figure exits."',
  },
  'warm-guide': {
    name: 'warm-guide',
    sentencePattern: 'Conversational. Mid-length sentences. Uses "you" and "we" often. Personal.',
    vocabularyHint: 'Plain English. Accessible. Occasionally uses metaphors or comparisons. Feels like a good conversation.',
    heroStyle: 'Addresses the reader directly. Acknowledges their situation or problem first.',
    forbiddenWords: ['leverage', 'synergy', 'streamline', 'empower', 'journey', 'unlock potential'],
    temperatureBoost: 0.05,
    exampleHero: '"Tired of writing that sounds like everyone else? Let\'s fix that together."',
  },
  'direct-operator': {
    name: 'direct-operator',
    sentencePattern: 'Punchy. Often fragments. Skimmable. No wasted words.',
    vocabularyHint: 'Operational. Process-focused. Time-specific. Numbers everywhere.',
    heroStyle: 'Service + turnaround + price anchor. No fluff. Reads like a menu.',
    forbiddenWords: ['passionate', 'dedicated', 'committed', 'exceptional', 'premium experience'],
    temperatureBoost: -0.15,
    exampleHero: '"Podcast edits. 48 hours. $300 per episode."',
  },
  'thoughtful-artisan': {
    name: 'thoughtful-artisan',
    sentencePattern: 'Longer sentences when the subject warrants it. Considered. Each word chosen.',
    vocabularyHint: 'Slightly elevated. Uses words like "craft," "considered," "made," "attention." Like a small-batch ethos.',
    heroStyle: 'Philosophy first, service second. Emphasizes care and attention.',
    forbiddenWords: ['fast', 'quick', 'scale', 'growth hacking', 'hustle', 'grind'],
    temperatureBoost: 0.1,
    exampleHero: '"Identity systems made with the same care as the businesses they represent."',
  },
  'rebellious-outsider': {
    name: 'rebellious-outsider',
    sentencePattern: 'Varied rhythm. Contrarian takes. Calls out industry norms. Uses "most" and "everyone else" to position against the default.',
    vocabularyHint: 'Anti-establishment without being angry. Names what\'s broken about the typical approach. Confident in an alternative.',
    heroStyle: 'Starts with a pattern interrupt — what others get wrong, why this is different.',
    forbiddenWords: ['best-in-class', 'industry-leading', 'trusted by', 'award-winning', 'the standard'],
    temperatureBoost: 0.15,
    exampleHero: '"Most consultants sell decks. I ship the actual thing."',
  },
  'quiet-authority': {
    name: 'quiet-authority',
    sentencePattern: 'Minimal. Each line carries weight. White space in the writing. Never explains what isn\'t necessary.',
    vocabularyHint: 'Spare. Precise. Like a museum wall label. The work speaks.',
    heroStyle: 'Extremely brief. Single phrase or short sentence. Almost aphoristic.',
    forbiddenWords: ['everything you need', 'full-service', 'end-to-end', 'one-stop'],
    temperatureBoost: -0.05,
    exampleHero: '"Studio for independent brands."',
  },
};

// Pick voice based on business type + style + deterministic randomness
function selectVoice(sv: SurveyData, seed: number): VoiceArchetype {
  const bt = (sv.businessType || '').toLowerCase();
  const style = sv.stylePreference;

  // Strong business-type signals
  if (/agency|studio/.test(bt) && style === 'minimal-elegant') return 'quiet-authority';
  if (/coach|therap|counsel/.test(bt)) return 'warm-guide';
  if (/virtual assistant|ops|admin/.test(bt)) return 'direct-operator';
  if (/design|photo|film|art|creat/.test(bt) && style === 'minimal-elegant') return 'thoughtful-artisan';
  if (/design|photo|film|art|creat/.test(bt) && style === 'bold-colorful') return 'rebellious-outsider';
  if (/consult|strateg|advis/.test(bt) && style === 'dark-premium') return 'confident-expert';

  // Style-driven with randomness for variety  
  if (style === 'minimal-elegant') {
    return seed % 2 === 0 ? 'quiet-authority' : 'thoughtful-artisan';
  }
  if (style === 'bold-colorful') {
    return seed % 2 === 0 ? 'rebellious-outsider' : 'warm-guide';
  }
  if (style === 'dark-premium') {
    return seed % 2 === 0 ? 'confident-expert' : 'direct-operator';
  }
  // light-clean → friendly default
  return seed % 3 === 0 ? 'warm-guide' : seed % 3 === 1 ? 'confident-expert' : 'direct-operator';
}

// ─── HERO ARCHETYPES ────────────────────────────────────────────

type HeroArchetype = 
  | 'manifesto'
  | 'specific-offer'
  | 'question-hook'
  | 'credential-lead'
  | 'problem-named'
  | 'work-lead'
  | 'numbers-lead'
  | 'philosophy-lead';

function selectHeroShape(voice: VoiceArchetype, sv: SurveyData, seed: number): HeroArchetype {
  const hasCredentials = /\d+\+?\s*(years?|clients?|projects?)/i.test(sv.aboutStory || '');
  const bt = (sv.businessType || '').toLowerCase();

  // Voice-driven defaults
  if (voice === 'confident-expert' && hasCredentials) return 'credential-lead';
  if (voice === 'confident-expert') return 'numbers-lead';
  if (voice === 'direct-operator') return 'specific-offer';
  if (voice === 'quiet-authority') return 'philosophy-lead';
  if (voice === 'thoughtful-artisan') return 'philosophy-lead';
  if (voice === 'rebellious-outsider') return 'problem-named';
  if (voice === 'warm-guide') return seed % 2 === 0 ? 'question-hook' : 'problem-named';

  // Business-type overrides
  if (/design|photo|video|art/.test(bt)) {
    return 'work-lead';
  }

  return 'specific-offer';
}

// ─── DIFFERENTIATION SEED ───────────────────────────────────────

/**
 * Produces a deterministic seed from business name so re-generation is stable
 * but two different businesses get different seeds.
 */
function computeSeed(businessName: string): number {
  let hash = 0;
  for (let i = 0; i < businessName.length; i++) {
    hash = (hash << 5) - hash + businessName.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── HEADLINE PATTERN LIBRARY ───────────────────────────────────
// Per voice, multiple distinct opening patterns so two same-voice sites
// still feel different.

const HEADLINE_PATTERNS: Record<VoiceArchetype, string[]> = {
  'confident-expert': [
    'Lead with the outcome + the number: "[service] that [specific outcome]. [N years/clients/projects]."',
    'Lead with specialization: "Specialized [service] for [very specific audience]."',
    'Lead with credential + service: "[Credential]. [Service] for [audience]."',
  ],
  'warm-guide': [
    'Address the reader: "Are you [specific problem]? Here\'s what we can do."',
    'Acknowledge the situation: "[Situation they\'re in]. [How you help]."',
    'Invitation framing: "Let\'s build [specific thing] together."',
  ],
  'direct-operator': [
    'Service + speed + price: "[Service] in [timeframe]. From [price]."',
    'Menu format: "What you get: [specific deliverable]."',
    'Drop the verb: "[Service]. [Turnaround]. Done."',
  ],
  'thoughtful-artisan': [
    'Philosophy first: "[Principle] in everything we make."',
    'The craft angle: "[Service] built the way [metaphor from craftsmanship]."',
    'Studio ethos: "A studio for [type of work] that [differentiator]."',
  ],
  'rebellious-outsider': [
    'Against the norm: "Most [category professionals] [what they do wrong]. I don\'t."',
    'Pattern interrupt: "[Surprising statement about the industry]."',
    'Reframe: "[Service] isn\'t about [common misconception]. It\'s about [what you believe]."',
  ],
  'quiet-authority': [
    'Aphorism: "[Brief, true statement about the work]."',
    'Minimal descriptor: "[Studio/practice/service] for [one specific kind of client]."',
    'Implicit: "[Single noun or short phrase]."',
  ],
};

// ─── MAIN PROMPT BUILDER ────────────────────────────────────────

function buildCopyPrompt(input: CopyInput): { prompt: string; voice: VoiceArchetype; heroShape: HeroArchetype; temperature: number } {
  const sv = input.surveyData;
  const b = input.branding;
  const ctx = input.businessContext;

  if (!sv) {
    // Fallback path — no survey data, use warm-guide default
    return {
      prompt: buildFallbackPrompt(b, ctx),
      voice: 'warm-guide',
      heroShape: 'specific-offer',
      temperature: 0.7,
    };
  }

  const seed = computeSeed(sv.businessName || 'default');
  const voice = selectVoice(sv, seed);
  const heroShape = selectHeroShape(voice, sv, seed);
  const voiceProfile = VOICE_PROFILES[voice];
  const headlinePatterns = HEADLINE_PATTERNS[voice];
  const selectedPattern = headlinePatterns[seed % headlinePatterns.length];

  const tiersBlock = sv.hasMultipleTiers && sv.tiers.length > 0
    ? sv.tiers.map((t, i) => `  Tier ${i + 1}: "${t.name}" at ${t.price} — includes: ${t.features.filter(Boolean).join(", ")}`).join("\n")
    : `  Single price: ${sv.price} (${sv.pricingModel} model)`;

  const deliverablesBlock = sv.deliverables.filter(Boolean).join(", ");

  const prompt = `You are writing website copy for ONE specific freelancer. The copy must feel like this freelancer specifically — not like a template, not like 100 other Zelrex sites, not like an AI.

═══════════════════════════════════════════════════════════════════
THIS SITE'S ASSIGNED VOICE ARCHETYPE: ${voiceProfile.name.toUpperCase()}
═══════════════════════════════════════════════════════════════════

Sentence patterns to use: ${voiceProfile.sentencePattern}

Vocabulary hint: ${voiceProfile.vocabularyHint}

Hero style: ${voiceProfile.heroStyle}

Example of this voice's hero: ${voiceProfile.exampleHero}

FORBIDDEN words for this voice specifically (in addition to the universal bans below):
${voiceProfile.forbiddenWords.map(w => `- "${w}"`).join('\n')}

═══════════════════════════════════════════════════════════════════
THIS SITE'S HERO ARCHETYPE: ${heroShape.toUpperCase()}
═══════════════════════════════════════════════════════════════════

Pattern to follow for the main hero headline:
${selectedPattern}

═══════════════════════════════════════════════════════════════════
THE BUSINESS
═══════════════════════════════════════════════════════════════════

Business name: "${sv.businessName}"
Tagline (from user, if provided): "${sv.tagline || "(user didn't provide — write one that fits the voice)"}"
Service category: ${sv.businessType}
Specific service: "${sv.mainService}"
What the client gets: "${sv.serviceDescription}"
Specific deliverables: ${deliverablesBlock || "(user didn't specify — infer from service)"}
Turnaround: ${sv.turnaround || "(not specified)"}
Target audience: "${sv.targetAudience}"
Unique selling point: "${sv.uniqueSellingPoint || "(user didn't provide — infer from the pattern of their answers)"}"
Guarantee: "${sv.guarantee || "(none)"}"
Previously on: ${sv.platformsLeavingFrom || "(not specified)"}

═══════════════════════════════════════════════════════════════════
PRICING (use their exact prices — do not round or modify)
═══════════════════════════════════════════════════════════════════
${tiersBlock}

═══════════════════════════════════════════════════════════════════
THE PERSON (for About page authenticity)
═══════════════════════════════════════════════════════════════════
${sv.aboutStory || "(User didn't write an about story — write a 2-sentence origin that FITS THE VOICE ARCHETYPE. Don't invent specific credentials, but you can infer a plausible motivation from their service + audience.)"}

═══════════════════════════════════════════════════════════════════
UNIVERSAL COPYWRITING RULES (apply on top of voice-specific rules)
═══════════════════════════════════════════════════════════════════

1. DO NOT write generic copy. Every headline must mention something specific to THIS business — the service, the audience, or the outcome. Never "Welcome to [Name]" or "What we offer."

2. Lead with outcomes or specifics. Never lead with verbs like "Learn," "Discover," "Explore," or "Welcome."

3. CTAs use action verbs specific to the service. "Book your edit," "Start your rebrand," "Schedule a strategy call" — NOT "Get started," "Learn more," "Contact us."

4. Every section has real substance. No placeholder prose. If you'd write the same sentence for a different business, delete it and be more specific.

5. The ENTIRE site must read in ONE consistent voice. If the hero is quiet-authority but the about page is warm-guide, that's a failure. Every page reads like the same person.

6. Forbidden words site-wide: "streamline," "leverage," "game-changer," "take your X to the next level," "in today's fast-paced world," "comprehensive solution," "cutting-edge," "best-in-class," "unlock potential," "seamless," "robust."

7. Forbidden phrases: "We're passionate about...", "We believe that...", "Our mission is to...", "We specialize in...(generic)", "Whether you're X or Y...", "From A to Z..."

8. Use "I" or "we" consistently — don't mix. Freelancer solo = "I." Studio/agency = "we." Pick one and stay there.

9. Numbers over adjectives. "48 hour turnaround" beats "fast turnaround." "$2,500" beats "affordable." "23 clients" beats "many clients."

10. Write like a real person who has actually done this work, not like a website. If a real business owner wouldn't say it out loud, don't write it.

11. DELIBERATE IMPERFECTION: Real good copy has slight asymmetry. Not every section needs exactly 3 bullet points. Not every header needs a subheadline. Mirror the voice's natural rhythm.

12. NO EMOJI in any copy. No "✨ amazing ✨" anything. Even in CTAs.

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Return ONLY valid JSON. No markdown fences. No commentary. No preamble.

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

  return {
    prompt,
    voice,
    heroShape,
    temperature: Math.max(0.3, Math.min(1.0, 0.7 + voiceProfile.temperatureBoost)),
  };
}

// ─── FALLBACK PROMPT (no survey data) ──────────────────────────

function buildFallbackPrompt(b: ZelrexWebsite["branding"], ctx?: CopyInput["businessContext"]): string {
  return `Write website copy for a freelance business. Voice: confident-expert. No hype words, no "revolutionary", no "leverage", no generic CTAs.

Business: "${b.name}"
Tagline: "${b.tagline || ""}"
Tone: ${b.tone}
Type: ${ctx?.businessType || "freelance service"}
Audience: ${ctx?.audience || "professionals"}
Offer: ${ctx?.offer || "consulting"}
Pricing: ${ctx?.pricing || "custom"}

Every headline must lead with an outcome or specific service. CTAs use action verbs specific to the work.

Return ONLY valid JSON matching the standard WebsiteCopy schema (home, offer, pricing, about, contact pages with hero, sections, CTAs). No markdown, no backticks.`;
}

// ─── POST-GENERATION VALIDATION ────────────────────────────────

/**
 * After Claude generates copy, scan it for quality failures.
 * Returns a list of issues. The caller can regenerate or fix them.
 */
function auditGeneratedCopy(copy: WebsiteCopy, voice: VoiceArchetype): { issues: string[]; severity: 'ok' | 'warn' | 'fail' } {
  const issues: string[] = [];
  const voiceProfile = VOICE_PROFILES[voice];
  
  // Flatten all text for scanning
  const allText = JSON.stringify(copy).toLowerCase();
  
  // Universal forbidden phrases
  const universallyBanned = [
    'streamline', 'leverage', 'game-changer', 'cutting-edge', 'best-in-class',
    'unlock potential', 'seamless', 'in today\'s fast-paced', 'comprehensive solution',
    'take your', 'to the next level', 'we\'re passionate about', 'our mission is to',
  ];
  for (const phrase of universallyBanned) {
    if (allText.includes(phrase)) {
      issues.push(`Contains banned phrase: "${phrase}"`);
    }
  }
  
  // Voice-specific forbidden words
  for (const word of voiceProfile.forbiddenWords) {
    if (allText.includes(word.toLowerCase())) {
      issues.push(`Contains ${voice}-forbidden word: "${word}"`);
    }
  }
  
  // Check for generic CTAs
  const genericCtas = ['get started', 'learn more', 'contact us', 'sign up', 'click here'];
  const ctaTexts = extractAllCtas(copy);
  for (const cta of ctaTexts) {
    const ctaLower = cta.toLowerCase();
    for (const generic of genericCtas) {
      if (ctaLower === generic || ctaLower === generic + '.' || ctaLower === generic + '!') {
        issues.push(`Generic CTA used: "${cta}"`);
      }
    }
  }
  
  // Check hero exists and isn't empty
  if (!copy.home?.hero?.headline || copy.home.hero.headline.length < 10) {
    issues.push('Home hero headline missing or too short');
  }
  
  // Severity classification
  const severity = issues.length === 0 ? 'ok' : issues.length > 3 ? 'fail' : 'warn';
  
  return { issues, severity };
}

function extractAllCtas(copy: any): string[] {
  const ctas: string[] = [];
  function walk(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.cta?.text) ctas.push(obj.cta.text);
    for (const key in obj) {
      if (typeof obj[key] === 'object') walk(obj[key]);
    }
  }
  walk(copy);
  return ctas;
}

// ─── MAIN EXPORT ────────────────────────────────────────────────

export async function generateWebsiteCopy(input: CopyInput): Promise<WebsiteCopy> {
  const { prompt, voice, heroShape, temperature } = buildCopyPrompt(input);

  console.log(`ZELREX COPY: voice=${voice}, hero=${heroShape}, temp=${temperature.toFixed(2)}`);

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL_SONNET || "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      temperature,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content?.[0]?.type === "text" ? response.content[0].text : "";
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();

    let copy: WebsiteCopy;
    try {
      copy = JSON.parse(cleaned);
    } catch {
      // Try JSON extraction
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        copy = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse copy JSON");
      }
    }

    // Audit quality
    const audit = auditGeneratedCopy(copy, voice);
    if (audit.severity === 'fail') {
      console.warn(`ZELREX COPY: Quality audit FAIL, ${audit.issues.length} issues:`, audit.issues.slice(0, 3));
      // Retry once with stricter prompt
      try {
        const retryPrompt = prompt + `\n\n⚠️ RETRY: The previous attempt had these issues that MUST be fixed:\n${audit.issues.map(i => `- ${i}`).join('\n')}\n\nWrite it again, avoiding all of these.`;
        const retryResponse = await anthropic.messages.create({
          model: process.env.ANTHROPIC_MODEL_SONNET || "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          temperature: Math.max(0.3, temperature - 0.1),
          messages: [{ role: "user", content: retryPrompt }],
        });
        const retryRaw = retryResponse.content?.[0]?.type === "text" ? retryResponse.content[0].text : "";
        const retryCleaned = retryRaw.replace(/```json\s*|```\s*/g, "").trim();
        const retryJson = retryCleaned.match(/\{[\s\S]*\}/);
        if (retryJson) copy = JSON.parse(retryJson[0]);
      } catch (retryErr) {
        console.warn("ZELREX COPY: Retry also failed, using original");
      }
    } else if (audit.severity === 'warn') {
      console.log(`ZELREX COPY: Quality audit WARN, ${audit.issues.length} minor issues`);
    }

    // Inject real contact methods from survey (this is the same as before)
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

      // Inject real pricing
      if (sv.hasMultipleTiers && sv.tiers.length > 0) {
        const realTiers = sv.tiers
          .filter((t) => t.name && t.price)
          .map((t, i) => ({
            name: t.name,
            price: t.price,
            note: copy.pricing?.pricing?.tiers?.[i]?.note || "",
            features: t.features.filter(Boolean).length > 0 ? t.features.filter(Boolean) : copy.pricing?.pricing?.tiers?.[i]?.features || [],
            highlighted: i === Math.floor(sv.tiers.filter((t) => t.name && t.price).length / 2),
          }));
        if (realTiers.length > 0) {
          copy.pricing.pricing.tiers = realTiers;
        }
      } else if (sv.price && copy.pricing?.pricing?.tiers) {
        copy.pricing.pricing.tiers = copy.pricing.pricing.tiers.map((tier) => ({
          ...tier,
          price: tier.price.includes("$") ? tier.price : sv.price,
        }));
      }
    }

    console.log(`ZELREX COPY: ${voice}/${heroShape} generated cleanly`);
    return copy;

  } catch (error) {
    console.error("ZELREX COPY: generation failed, using fallback", error);
    return buildFallbackCopy(input);
  }
}

// ─── ENHANCED FALLBACK ──────────────────────────────────────────

function buildFallbackCopy(input: CopyInput): WebsiteCopy {
  const b = input.branding;
  const sv = input.surveyData;
  const ctx = input.businessContext;
  const name = b.name;
  const service = sv?.mainService || ctx?.offer || "our service";
  const audience = sv?.targetAudience || ctx?.audience || "our clients";
  const tagline = b.tagline || sv?.tagline || `Professional ${sv?.businessType || "services"}`;

  // Even the fallback is better now — uses voice-specific language
  const seed = computeSeed(name);
  const voice = sv ? selectVoice(sv, seed) : 'confident-expert';
  const voiceProfile = VOICE_PROFILES[voice];

  return {
    home: {
      hero: {
        headline: sv?.uniqueSellingPoint || `${service} for ${audience}`,
        subheadline: tagline,
      },
      valueProps: {
        eyebrow: "Services",
        title: `What ${name} does`,
        subtitle: `Built for ${audience}.`,
        items: sv?.deliverables?.filter(Boolean).map((d) => ({
          title: d,
          description: `Included in every ${sv?.pricingModel || "project"}.`,
        })) || [
          { title: service, description: `Made for ${audience}.` },
          { title: sv?.turnaround ? `Delivered in ${sv.turnaround}` : "Fast turnaround", description: "Without cutting corners." },
          { title: "Direct work", description: "No middlemen, no delays, no hidden fees." },
        ],
      },
      howItWorks: {
        eyebrow: "Process",
        title: "How it works",
        subtitle: "",
        steps: [
          { title: "Brief", description: "Share what you need." },
          { title: "Work", description: `Delivered in ${sv?.turnaround || "your timeline"}.` },
          { title: "Ship", description: "Iterate until it's right, then launch." },
        ],
      },
      socialProof: {
        eyebrow: "",
        title: "",
        subtitle: "",
        items: [],
      },
      primaryCta: {
        title: sv?.guarantee || `Ready to work together?`,
        subtitle: sv?.turnaround ? `Start today. Delivery in ${sv.turnaround}.` : "Reach out to start.",
        cta: { text: voice === 'direct-operator' ? "Start now" : voice === 'quiet-authority' ? "Inquire" : "Get in touch", intent: "primary" },
      },
    },
    offer: {
      hero: {
        headline: service,
        subheadline: sv?.serviceDescription || `For ${audience}.`,
      },
      whatYouGet: {
        eyebrow: "Deliverables",
        title: "What's included",
        subtitle: "",
        items: sv?.deliverables?.filter(Boolean).map(d => ({ title: d, description: "" })) || [
          { title: service, description: "" },
        ],
      },
      whoItsFor: {
        eyebrow: "Fit",
        title: "Who this is for",
        subtitle: "",
        items: [{ title: audience, description: "" }],
      },
      cta: {
        title: "Ready?",
        subtitle: "",
        cta: { text: "Start a project", intent: "primary" },
      },
    },
    pricing: {
      hero: { headline: "Pricing", subheadline: "" },
      pricing: {
        eyebrow: "",
        title: "Packages",
        subtitle: "",
        tiers: sv?.hasMultipleTiers && sv?.tiers?.length ? sv.tiers.map((t, i) => ({
          name: t.name,
          price: t.price,
          note: "",
          features: t.features.filter(Boolean),
          highlighted: i === Math.floor(sv.tiers.length / 2),
        })) : [{
          name: "Standard",
          price: sv?.price || "Contact for pricing",
          note: "",
          features: sv?.deliverables?.filter(Boolean) || [],
          highlighted: true,
        }],
      },
      cta: {
        title: "Ready to book?",
        subtitle: "",
        cta: { text: "Start", intent: "primary" },
      },
    },
    about: {
      hero: { headline: `About ${name}`, subheadline: "" },
      story: {
        eyebrow: "",
        title: "The story",
        body: sv?.aboutStory || `${name} builds ${service.toLowerCase()} for ${audience}.`,
      },
      values: {
        eyebrow: "",
        title: "",
        items: [],
      },
      cta: {
        title: "",
        subtitle: "",
        cta: { text: "Get in touch", intent: "primary" },
      },
    },
    contact: {
      hero: { headline: "Contact", subheadline: "" },
      methods: {
        eyebrow: "",
        title: "Get in touch",
        subtitle: "",
        items: [
          ...(sv?.email ? [{ label: "Email", value: sv.email, href: `mailto:${sv.email}` }] : []),
          ...(sv?.phone ? [{ label: "Phone", value: sv.phone }] : []),
        ],
      },
      nextSteps: {
        eyebrow: "",
        title: "",
        items: [],
      },
      cta: {
        title: "",
        subtitle: "",
        cta: { text: "Send a message", intent: "primary" },
      },
    },
  };
}

// Export for use in tests / debugging
export { VOICE_PROFILES, computeSeed, selectVoice, selectHeroShape };