import { ZelrexWebsite } from "./websiteTypes";
import { BrandProfile } from "./brandIntelligence";
import { BusinessContext } from "./buildWebsite";

/**
 * Selects one of the 5 locked Zelrex themes based on brand profile
 * AND business context. This ensures different business types get
 * different visual treatments even if the tone is the same.
 */
export function selectTheme(
  branding: ZelrexWebsite["branding"],
  profile: BrandProfile,
  businessContext?: BusinessContext
): string {
  const tone = branding.tone?.toLowerCase?.() ?? "professional";
  const bizType = businessContext?.businessType?.toLowerCase() ?? "";

  // ─── Business-type driven selection ─────────────────────────────
  // This layer runs first so different businesses get different themes
  // even when they all default to "professional" tone.

  // Technical / dev / SaaS / API businesses → Carbon (monospace, dark, technical)
  if (
    bizType.includes("saas") ||
    bizType.includes("software") ||
    bizType.includes("api") ||
    bizType.includes("dev") ||
    bizType.includes("tech") ||
    tone === "technical"
  ) {
    return "carbon";
  }

  // Luxury / premium / high-ticket coaching → Aura (dark purple, premium)
  if (
    bizType.includes("luxury") ||
    bizType.includes("premium") ||
    bizType.includes("high-ticket") ||
    bizType.includes("executive") ||
    tone === "luxury"
  ) {
    return "aura";
  }

  // Agencies / design / creative → Obsidian (bold, dark, Stripe-like)
  if (
    bizType.includes("agency") ||
    bizType.includes("design") ||
    bizType.includes("creative") ||
    bizType.includes("brand")
  ) {
    return "obsidian";
  }

  // Coaching / wellness / friendly / community → Slate (warm, approachable, light)
  if (
    bizType.includes("coach") ||
    bizType.includes("wellness") ||
    bizType.includes("health") ||
    bizType.includes("fitness") ||
    bizType.includes("community") ||
    bizType.includes("personal") ||
    tone === "friendly"
  ) {
    return "slate";
  }

  // Consulting / professional services / B2B → Ivory (clean, Apple-like)
  if (
    bizType.includes("consult") ||
    bizType.includes("advisory") ||
    bizType.includes("service") ||
    bizType.includes("freelance") ||
    bizType.includes("b2b")
  ) {
    return "ivory";
  }

  // Digital products / templates / guides → Obsidian (bold, conversion-focused)
  if (
    bizType.includes("product") ||
    bizType.includes("template") ||
    bizType.includes("guide") ||
    bizType.includes("course")
  ) {
    return "obsidian";
  }

  // ─── Tone-driven fallback ───────────────────────────────────────
  if (profile.confidence === "authoritative" && profile.prefersMinimalism) {
    return "aura";
  }
  if (profile.confidence === "authoritative" && !profile.prefersMinimalism) {
    return "obsidian";
  }
  if (profile.prefersMinimalism && profile.emotionalTone === "logical") {
    return "ivory";
  }
  if (profile.emotionalTone === "emotional" && profile.confidence !== "reserved") {
    return "slate";
  }

  return "ivory";
}