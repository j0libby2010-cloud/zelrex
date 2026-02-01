import { WebsiteBranding } from "./websiteTypes";

export type BrandConfidence =
  | "reserved"
  | "confident"
  | "authoritative";

export interface BrandProfile {
  confidence: BrandConfidence;
  prefersMinimalism: boolean;
  emotionalTone: "logical" | "balanced" | "emotional";
}

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
