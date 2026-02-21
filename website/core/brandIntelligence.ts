import { WebsiteBranding } from "./websiteTypes";

/**
 * High-level brand confidence expressed in the site.
 */
export type BrandConfidence =
  | "reserved"
  | "confident"
  | "authoritative";

/**
 * Derived brand behavior used by themes, copy, and imagery.
 */
export interface BrandProfile {
  confidence: BrandConfidence;
  prefersMinimalism: boolean;
  emotionalTone: "logical" | "balanced" | "emotional";
}

/**
 * Ensures branding always exists.
 * If the user did not provide branding, Zelrex creates it.
 */
export function resolveBranding(
  branding?: WebsiteBranding
): WebsiteBranding {
  if (branding) return branding;

  // v1 default branding (safe, professional, high-conversion)
  return {
    name: "New Business",
    tagline: "Built with Zelrex",
    tone: "professional",
    primaryColor: "#2563eb",
  };
}

/**
 * Infers deeper brand behavior from branding.
 * This is the single source of truth for brand personality.
 */
export function inferBrandProfile(
  branding: WebsiteBranding
): BrandProfile {
  switch (branding.tone) {
    case "luxury":
      return {
        confidence: "authoritative",
        prefersMinimalism: true,
        emotionalTone: "balanced",
      };

    case "authoritative":
      return {
        confidence: "authoritative",
        prefersMinimalism: true,
        emotionalTone: "logical",
      };

    case "technical":
      return {
        confidence: "confident",
        prefersMinimalism: true,
        emotionalTone: "logical",
      };

    case "friendly":
      return {
        confidence: "confident",
        prefersMinimalism: false,
        emotionalTone: "emotional",
      };

    default:
      return {
        confidence: "confident",
        prefersMinimalism: false,
        emotionalTone: "balanced",
      };
  }
}
