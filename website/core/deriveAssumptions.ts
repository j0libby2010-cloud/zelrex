import { ZelrexWebsite } from "./websiteTypes";
import { inferBrandProfile } from "./brandIntelligence";

export interface ZelrexAssumptions {
  goals: string[];
  audience: string[];
  market: string[];
  rationale: string;
}

/**
 * Explicitly derives assumptions used by Zelrex.
 * These are NEVER shown on the website itself.
 * They are surfaced to the user for transparency and override.
 */
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
  const profile = inferBrandProfile(branding);

  const goals: string[] = [];
  const audience: string[] = [];
  const market: string[] = [];

  // ---- Goal assumptions ----
  goals.push(
    "Primary objective is to appear credible and convert reasonably well."
  );

  if (profile.confidence === "authoritative") {
    goals.push("User likely values decisive outcomes over exploration.");
  } else if (profile.emotionalTone === "emotional") {
    goals.push("User likely values connection and trust-building.");
  } else {
    goals.push("User likely values clarity and low-risk progress.");
  }

  // ---- Audience assumptions ----
  audience.push(
    "Visitors are unfamiliar with the business and need clear orientation."
  );

  if (profile.prefersMinimalism) {
    audience.push("Audience prefers concise information over dense detail.");
  } else {
    audience.push("Audience is open to explanation and storytelling.");
  }

  // ---- Market assumptions ----
  market.push(
    "Business operates in a competitive but legitimate market."
  );
  market.push(
    "Differentiation is based on clarity and positioning, not hype."
  );

  return {
    goals,
    audience,
    market,
    rationale:
      "These assumptions were made because explicit goals were not provided. They are conservative, low-risk defaults designed to avoid misleading claims while still enabling effective conversion.",
  };
}
