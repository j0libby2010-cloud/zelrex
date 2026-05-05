import { WebsiteBranding } from "./websiteTypes";

/**
 * v2 REWRITE: Multi-dimensional brand profiling.
 * 
 * Old version: tone → 5-outcome switch. Every user with same tone = same profile.
 * New version: considers tone + business type + style + font for richer inference.
 */

export type BrandConfidence = "reserved" | "confident" | "authoritative";
export type EmotionalTone = "logical" | "balanced" | "emotional";
export type VisualDensity = "minimal" | "balanced" | "rich";
export type Formality = "casual" | "professional" | "formal";

/**
 * Complete brand profile — used by themes, copy, and imagery.
 */
export interface BrandProfile {
  confidence: BrandConfidence;
  prefersMinimalism: boolean; // legacy field — still used
  emotionalTone: EmotionalTone;
  visualDensity: VisualDensity;
  formality: Formality;
  colorStrategy: "monochrome" | "accent-driven" | "warm" | "high-contrast";
}

/**
 * Ensures branding always exists.
 */
export function resolveBranding(
  branding?: WebsiteBranding
): WebsiteBranding {
  if (branding) return branding;

  return {
    name: "New Business",
    tagline: "Built with Zelrex",
    tone: "professional",
    primaryColor: "#2563eb",
  };
}

/**
 * Rich brand profile inference.
 * Considers tone (primary signal), font preference, color choice,
 * and tagline length as additional signals.
 */
export function inferBrandProfile(
  branding: WebsiteBranding,
  extras?: {
    businessType?: string;
    stylePreference?: string;
    fontPreference?: string;
    yearsInBusiness?: number;
  }
): BrandProfile {
  const tone = branding.tone;
  const bt = (extras?.businessType || "").toLowerCase();
  const style = extras?.stylePreference || "";
  const font = extras?.fontPreference || branding.fontStyle || "modern";
  const yrs = extras?.yearsInBusiness || 0;

  // Base profile from tone
  let profile: BrandProfile;
  switch (tone) {
    case "luxury":
      profile = {
        confidence: "authoritative",
        prefersMinimalism: true,
        emotionalTone: "balanced",
        visualDensity: "minimal",
        formality: "formal",
        colorStrategy: "monochrome",
      };
      break;

    case "authoritative":
      profile = {
        confidence: "authoritative",
        prefersMinimalism: true,
        emotionalTone: "logical",
        visualDensity: "balanced",
        formality: "professional",
        colorStrategy: "high-contrast",
      };
      break;

    case "technical":
      profile = {
        confidence: "confident",
        prefersMinimalism: true,
        emotionalTone: "logical",
        visualDensity: "balanced",
        formality: "professional",
        colorStrategy: "accent-driven",
      };
      break;

    case "friendly":
      profile = {
        confidence: "confident",
        prefersMinimalism: false,
        emotionalTone: "emotional",
        visualDensity: "rich",
        formality: "casual",
        colorStrategy: "warm",
      };
      break;

    case "minimal":
      profile = {
        confidence: "reserved",
        prefersMinimalism: true,
        emotionalTone: "logical",
        visualDensity: "minimal",
        formality: "professional",
        colorStrategy: "monochrome",
      };
      break;

    default: // professional
      profile = {
        confidence: "confident",
        prefersMinimalism: false,
        emotionalTone: "balanced",
        visualDensity: "balanced",
        formality: "professional",
        colorStrategy: "accent-driven",
      };
  }

  // ─── REFINEMENTS based on other signals ──────────────────────

  // Years in business shifts confidence upward
  if (yrs >= 10) {
    profile.confidence = "authoritative";
  } else if (yrs >= 5 && profile.confidence === "reserved") {
    profile.confidence = "confident";
  }

  // Business type adjustments
  if (/coach|therap|wellness/.test(bt)) {
    profile.emotionalTone = "emotional";
    profile.formality = "casual";
    profile.colorStrategy = "warm";
  }

  if (/consult|advis|strateg|executive/.test(bt)) {
    profile.formality = "professional";
    if (profile.confidence === "reserved") profile.confidence = "confident";
  }

  if (/agency|studio/.test(bt)) {
    profile.visualDensity = "balanced";
    if (profile.confidence !== "authoritative") profile.confidence = "confident";
  }

  if (/luxury|premium|high-ticket/.test(bt)) {
    profile.prefersMinimalism = true;
    profile.visualDensity = "minimal";
    profile.formality = "formal";
    profile.colorStrategy = "monochrome";
  }

  // Style preference refinements
  if (style === "minimal-elegant") {
    profile.prefersMinimalism = true;
    profile.visualDensity = "minimal";
  }
  if (style === "bold-colorful") {
    profile.prefersMinimalism = false;
    profile.visualDensity = "rich";
    profile.colorStrategy = "high-contrast";
  }
  if (style === "dark-premium") {
    profile.colorStrategy = "high-contrast";
    profile.visualDensity = profile.visualDensity === "rich" ? "balanced" : profile.visualDensity;
  }

  // Font preference refinements
  if (font === "editorial" || font === "luxury") {
    profile.formality = "formal";
    profile.visualDensity = "minimal";
  }
  if (font === "tech") {
    profile.emotionalTone = "logical";
    profile.colorStrategy = "accent-driven";
  }

  return profile;
}