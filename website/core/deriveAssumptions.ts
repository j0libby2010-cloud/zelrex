import { ZelrexWebsite } from "./websiteTypes";
import { inferBrandProfile } from "./brandIntelligence";

/**
 * v2 REWRITE: Specific assumptions, not generic boilerplate.
 * 
 * Old version returned the same 3 goal/audience/market statements for every business.
 * New version produces genuinely business-specific assumptions the user can actually
 * disagree with — because vague assumptions can't be disagreed with.
 */

export interface ZelrexAssumptions {
  goals: string[];
  audience: string[];
  market: string[];
  rationale: string;
}

export function deriveAssumptions(
  website: Pick<ZelrexWebsite, "branding"> & {
    businessContext?: {
      businessType?: string;
      audience?: string;
      offer?: string;
      pricing?: string;
    };
  }
): ZelrexAssumptions {
  const branding = website.branding;
  const ctx = website.businessContext;
  const bt = (ctx?.businessType || "").toLowerCase();
  const audience = ctx?.audience || "";
  const offer = ctx?.offer || "";
  const pricing = ctx?.pricing || "";
  const name = branding.name || "this business";

  const profile = inferBrandProfile(branding, {
    businessType: ctx?.businessType,
  });

  const goals: string[] = [];
  const audienceAssumptions: string[] = [];
  const market: string[] = [];

  // ─── GOAL ASSUMPTIONS — business-type specific ─────────────────

  if (/consult|advis|strateg/.test(bt)) {
    goals.push("Primary goal is booking qualified discovery calls — not self-serve checkout.");
    goals.push(`${name} likely values long-term client relationships over transactional work.`);
    goals.push("Credibility matters more than conversion optimization — visitors need to trust the expertise.");
  } else if (/coach|therap|wellness/.test(bt)) {
    goals.push("Primary goal is helping visitors see themselves in the transformation described.");
    goals.push(`${name} likely converts through trust-building, not pressure or urgency.`);
    goals.push("The site needs to feel like the beginning of a relationship, not a sales funnel.");
  } else if (/design|photo|video|creat/.test(bt)) {
    goals.push("Primary goal is showcasing the work itself — copy supports the portfolio.");
    goals.push(`${name}'s aesthetic taste should be immediately visible, not just described.`);
    goals.push("Clients buying creative work often decide based on feel before logic.");
  } else if (/saas|software|api|dev|technical/.test(bt)) {
    goals.push("Primary goal is being taken seriously by technical buyers who scan fast.");
    goals.push(`${name} needs to demonstrate competence without explaining too much.`);
    goals.push("Technical audiences prefer specificity over benefits language.");
  } else if (/virtual|admin|ops|assistant/.test(bt)) {
    goals.push("Primary goal is making the value prop crystal clear within 5 seconds.");
    goals.push(`${name} competes on reliability and time-saved, not uniqueness.`);
    goals.push("Most VA buyers are comparison-shopping — the site needs to be the easy pick.");
  } else if (/agency|studio/.test(bt)) {
    goals.push("Primary goal is positioning as a selective studio, not an available vendor.");
    goals.push(`${name} likely wins on portfolio + approach, not price or capacity.`);
    goals.push("Agency/studio buyers want to feel like they're choosing, not being sold to.");
  } else {
    // Generic but still more specific than the old version
    goals.push(`Primary goal is turning visitors into qualified inquiries for ${offer || "the service"}.`);
    goals.push(`${name} likely values signal-to-noise ratio over breadth of content.`);
    goals.push("Visitors decide whether to inquire within about 15 seconds — the hero carries the weight.");
  }

  // ─── AUDIENCE ASSUMPTIONS — use actual audience data ────────────

  if (audience) {
    audienceAssumptions.push(`Visitors are likely "${audience}" — or someone looking for a ${offer || "service"} provider on their behalf.`);
    
    // Targeting-specific
    if (/b2b|saas|startup|founder|ceo|cto/.test(audience.toLowerCase())) {
      audienceAssumptions.push("Audience is time-poor and skims. Hero must work in 5 seconds or less.");
      audienceAssumptions.push("Audience likely evaluates 2-3 options before choosing — specificity beats generic claims.");
    } else if (/small\s*business|local|owner/.test(audience.toLowerCase())) {
      audienceAssumptions.push("Audience values trust and direct communication over polish.");
      audienceAssumptions.push("Audience often reaches out by phone or form — make those easy to find.");
    } else if (/creator|influencer|podcaster|youtuber/.test(audience.toLowerCase())) {
      audienceAssumptions.push("Audience cares about speed and responsiveness more than price.");
      audienceAssumptions.push("Audience likely discovered this via Twitter/X, YouTube, or a referral — assume some familiarity.");
    } else {
      audienceAssumptions.push("Audience may be unfamiliar with freelance engagement — the page should orient them.");
    }
  } else {
    audienceAssumptions.push("Specific audience wasn't provided — copy is written for generic professional buyers.");
    audienceAssumptions.push("Without a named audience, messaging defaults to broadly applicable value — less sharp than ideal.");
  }

  // Confidence-level adjustment
  if (profile.confidence === "authoritative") {
    audienceAssumptions.push("Tone assumes an audience that wants decisive answers — no hedging or over-explanation.");
  }
  if (profile.emotionalTone === "emotional") {
    audienceAssumptions.push("Tone assumes an audience that connects through story and empathy before logic.");
  }

  // ─── MARKET ASSUMPTIONS — specific to category + pricing ────────

  if (pricing) {
    const priceNum = extractPriceNumber(pricing);
    if (priceNum !== null) {
      if (priceNum >= 5000) {
        market.push(`At ${pricing}, this is positioned in the premium tier of ${bt || "freelance services"}.`);
        market.push("Buyers at this price point expect extensive trust signals — years, clients, outcomes.");
      } else if (priceNum >= 1000) {
        market.push(`At ${pricing}, this is mid-market — above platform rates, below agency rates.`);
        market.push("Buyers at this price point compare 3-5 options before deciding.");
      } else {
        market.push(`At ${pricing}, this is entry-level pricing — expect high volume, low commitment buyers.`);
        market.push("Below $1,000 per engagement, buyers decide quickly and expect fast delivery.");
      }
    } else {
      market.push(`Pricing "${pricing}" is harder to anchor against competitor benchmarks.`);
    }
  }

  if (/saas|startup|vc|tech/.test(audience.toLowerCase())) {
    market.push("Tech-adjacent markets move fast — messaging needs to feel current, not evergreen-generic.");
  } else if (/local|brick\s*and\s*mortar|small\s*business/.test(audience.toLowerCase())) {
    market.push("Local/small business markets value longevity and references — assume risk-averse buyers.");
  } else {
    market.push(`The ${bt || "freelance service"} market has many options — differentiation must be clear within the hero.`);
  }

  if (profile.prefersMinimalism) {
    market.push("Aesthetic choice of minimalism signals premium positioning — copy should match (less is more).");
  }

  return {
    goals,
    audience: audienceAssumptions,
    market,
    rationale:
      "These assumptions were derived from the business type, target audience, pricing, and tone. " +
      "They are inferences — the user knows their market better than Zelrex does. " +
      "Any assumption here that doesn't match reality should be corrected before launch.",
  };
}

// Extract a numeric price from strings like "$5,000", "$2k-5k", "From $1,500"
function extractPriceNumber(pricing: string): number | null {
  const match = pricing.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K)?/);
  if (!match) return null;
  let num = parseFloat(match[1].replace(/,/g, ""));
  if (match[2]) num *= 1000;
  return isNaN(num) ? null : num;
}