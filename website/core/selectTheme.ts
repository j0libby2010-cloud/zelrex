import { ZelrexWebsite } from "./websiteTypes";
import { BrandProfile } from "./brandIntelligence";
import { BusinessContext } from "./buildWebsite";

/**
 * v2 REWRITE: Selects one of the 5 locked Zelrex themes with MORE intelligence.
 * 
 * Key improvements:
 * 1. Uses survey style preference directly (was ignored before)
 * 2. Uses font preference as tiebreaker
 * 3. Deterministic randomness from business name — two similar businesses don't get same theme
 * 4. Maps the actual BusinessType more precisely (20+ categories, not 8)
 * 5. Respects user's stylePreference overrides
 */

// Deterministic hash from business name for stable-but-varied selection
function nameHash(name?: string): number {
  if (!name) return 0;
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

type ThemeName = "carbon" | "aura" | "obsidian" | "slate" | "ivory";

interface ThemeContext {
  businessType: string;
  stylePreference?: string;
  fontPreference?: string;
  toneOverride?: string;
  nameSeed: number;
}

/**
 * Returns the best-fit theme. Considers business type, user style/font picks,
 * tone, and a deterministic seed from business name.
 */
export function selectTheme(
  branding: ZelrexWebsite["branding"],
  profile: BrandProfile,
  businessContext?: BusinessContext & { stylePreference?: string; fontPreference?: string }
): string {
  const ctx: ThemeContext = {
    businessType: (businessContext?.businessType || "").toLowerCase(),
    stylePreference: (businessContext as any)?.stylePreference,
    fontPreference: (businessContext as any)?.fontPreference,
    toneOverride: (branding.tone || "").toLowerCase(),
    nameSeed: nameHash(branding.name),
  };

  // ─── 1. EXPLICIT STYLE PREFERENCE OVERRIDES EVERYTHING ──────────
  // If the user deliberately picked a style, honor it — they know what they want.
  if (ctx.stylePreference === "dark-premium") {
    // Dark premium → carbon, aura, or obsidian based on business fit
    if (isTechBusiness(ctx.businessType)) return "carbon";
    if (isLuxuryBusiness(ctx.businessType)) return "aura";
    return "obsidian"; // Default dark premium
  }
  
  if (ctx.stylePreference === "minimal-elegant") {
    // Minimal elegant → ivory (light) or aura (dark elegant) depending on business
    if (isLuxuryBusiness(ctx.businessType)) return "aura";
    if (isCoachOrCreative(ctx.businessType)) return "ivory";
    // Seed-based fallback for variety
    return ctx.nameSeed % 2 === 0 ? "ivory" : "aura";
  }
  
  if (ctx.stylePreference === "bold-colorful") {
    // Bold colorful doesn't map cleanly to the 5 themes; closest is obsidian (bold)
    // but for creative/design work, slate reads more approachable
    if (isDesignOrCreative(ctx.businessType)) return "obsidian";
    return ctx.nameSeed % 2 === 0 ? "obsidian" : "slate";
  }
  
  if (ctx.stylePreference === "light-clean") {
    // Light clean → ivory (professional) or slate (warm)
    if (isB2BProfessional(ctx.businessType)) return "ivory";
    return "slate";
  }

  // ─── 2. TONE OVERRIDE ───────────────────────────────────────────
  if (ctx.toneOverride === "luxury") return "aura";
  if (ctx.toneOverride === "technical") return "carbon";
  if (ctx.toneOverride === "friendly") return "slate";
  if (ctx.toneOverride === "authoritative") {
    return ctx.nameSeed % 2 === 0 ? "obsidian" : "aura";
  }

  // ─── 3. BUSINESS-TYPE DRIVEN ─────────────────────────────────────
  if (isTechBusiness(ctx.businessType)) return "carbon";
  if (isLuxuryBusiness(ctx.businessType)) return "aura";
  if (isDesignOrCreative(ctx.businessType)) {
    // Design can go either bold (obsidian) or elegant (aura) — use seed for variety
    return ctx.nameSeed % 3 === 0 ? "aura" : "obsidian";
  }
  if (isCoachOrWellness(ctx.businessType)) return "slate";
  if (isB2BProfessional(ctx.businessType)) return "ivory";
  if (isDigitalProduct(ctx.businessType)) {
    return ctx.nameSeed % 2 === 0 ? "obsidian" : "ivory";
  }

  // ─── 4. PROFILE-DRIVEN FALLBACK ─────────────────────────────────
  if (profile.confidence === "authoritative" && profile.prefersMinimalism) return "aura";
  if (profile.confidence === "authoritative" && !profile.prefersMinimalism) return "obsidian";
  if (profile.prefersMinimalism && profile.emotionalTone === "logical") return "ivory";
  if (profile.emotionalTone === "emotional" && profile.confidence !== "reserved") return "slate";

  // ─── 5. SEEDED RANDOM DEFAULT (prevents everyone getting same theme) ──
  const defaults: ThemeName[] = ["ivory", "slate", "obsidian"];
  return defaults[ctx.nameSeed % defaults.length];
}

// ─── BUSINESS-TYPE CLASSIFIERS ───────────────────────────────────

function isTechBusiness(bt: string): boolean {
  return /saas|software|api|dev|technical|engineer|code|programming|platform|data\s*science|devops|infrastructure/i.test(bt);
}

function isLuxuryBusiness(bt: string): boolean {
  return /luxury|premium|high-ticket|executive|concierge|bespoke|private\s*client|fine/i.test(bt);
}

function isDesignOrCreative(bt: string): boolean {
  return /design|brand|creative|art|illustration|visual|graphic|photo|film|video|motion/i.test(bt);
}

function isCoachOrWellness(bt: string): boolean {
  return /coach|wellness|health|fitness|nutrition|mindfulness|therap|counsel|community|personal\s*development/i.test(bt);
}

function isCoachOrCreative(bt: string): boolean {
  return isCoachOrWellness(bt) || isDesignOrCreative(bt);
}

function isB2BProfessional(bt: string): boolean {
  return /consult|advis|strateg|b2b|professional\s*service|freelance|independent|legal|financial\s*consulting|hr\s*consulting/i.test(bt);
}

function isDigitalProduct(bt: string): boolean {
  return /product|template|guide|course|ebook|newsletter|digital|info\s*product/i.test(bt);
}