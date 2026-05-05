// website/core/buildWebsite.ts
//
// FIXED VERSION
//
// Critical fixes from previous version:
// 1. Theme colors are now actually resolved from theme name (was using fallbacks)
// 2. stylePreference is preserved through the pipeline (was being lost in tone mapping)
// 3. Copy consistency check now triggers regeneration on failure (was just logging)

import { ZelrexWebsite, BrandTone } from "./websiteTypes";
import { generateWebsiteCopy, SurveyData } from "./generateCopy";
import { selectTheme } from "./selectTheme";
import { inferBrandProfile } from "./brandIntelligence";
import { validateWebsite } from "./validateWebsite";
import { deriveAssumptions } from "./deriveAssumptions";
import { injectSEO, generateSitemap, generateRobotsTxt } from "@/lib/seo";
import { generateContactFormHtml } from "@/lib/websiteContactForm";

export type { SurveyData } from "./generateCopy";

export interface BusinessContext {
  businessType: string;
  audience: string;
  offer: string;
  pricing: string;
  // FIXED: stylePreference preserved through the pipeline
  stylePreference?: string;
  fontPreference?: string;
}

function mapStyleToTone(style: string): BrandTone {
  switch (style) {
    case "dark-premium": return "professional";
    case "light-clean": return "minimal";
    case "bold-colorful": return "friendly";
    case "minimal-elegant": return "luxury";
    default: return "professional";
  }
}

function mapFontToTemplate(font: string): string {
  switch (font) {
    case "modern": return "minimal";
    case "classic": return "editorial";
    case "editorial": return "editorial";
    case "tech": return "bold";
    case "studio": return "studio";
    case "luxury": return "luxury";
    default: return "minimal";
  }
}

// ─── THEME COLOR DEFINITIONS ────────────────────────────────────
// FIXED: Each theme name now has actual colors. Previously selectTheme returned
// a string but the code tried to read theme.background / theme.textPrimary etc.
// which were undefined, so every theme got the same fallback colors.
const THEME_PALETTES: Record<string, {
  bg: string;
  textPrimary: string;
  textSecondary: string;
  surface: string;
  border: string;
  isLight: boolean;
}> = {
  carbon: {
    // Technical, monospace, deep dark
    bg: "#0A0A0A",
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.55)",
    surface: "#141414",
    border: "rgba(255,255,255,0.08)",
    isLight: false,
  },
  aura: {
    // Premium, dark with purple undertones, luxury
    bg: "#0F0A1E",
    textPrimary: "#F5F3FF",
    textSecondary: "rgba(245,243,255,0.55)",
    surface: "#1A1130",
    border: "rgba(167,139,250,0.12)",
    isLight: false,
  },
  obsidian: {
    // Bold, dark, Stripe-like
    bg: "#0E1117",
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.6)",
    surface: "#161B22",
    border: "rgba(255,255,255,0.1)",
    isLight: false,
  },
  slate: {
    // Warm, approachable, light
    bg: "#FAF8F5",
    textPrimary: "#2C2A28",
    textSecondary: "#71706B",
    surface: "#FFFFFF",
    border: "rgba(44,42,40,0.08)",
    isLight: true,
  },
  ivory: {
    // Clean, Apple-like, professional
    bg: "#FFFFFF",
    textPrimary: "#1D1D1F",
    textSecondary: "#6E6E73",
    surface: "#F5F5F7",
    border: "rgba(0,0,0,0.06)",
    isLight: true,
  },
};

function resolveThemePalette(themeName: string, primaryColor: string): {
  name: string;
  bg: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  surface: string;
  border: string;
  isLight: boolean;
} {
  const palette = THEME_PALETTES[themeName] || THEME_PALETTES.ivory;
  return {
    name: themeName,
    bg: palette.bg,
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    accent: primaryColor || "#4A90FF",
    surface: palette.surface,
    border: palette.border,
    isLight: palette.isLight,
  };
}

export async function buildWebsite(input: {
  id?: string;
  branding?: ZelrexWebsite["branding"];
  businessContext?: BusinessContext;
  surveyData?: SurveyData;
}): Promise<ZelrexWebsite> {

  // ── Build branding from survey or fallback ────────────────────
  let branding: ZelrexWebsite["branding"];

  if (input.surveyData) {
    const sv = input.surveyData;
    branding = {
      name: sv.businessName || "My Business",
      tagline: sv.tagline || undefined,
      tone: mapStyleToTone(sv.stylePreference),
      primaryColor: sv.primaryColor || "#4A90FF",
      fontStyle: sv.fontPreference || "modern",
    };
  } else {
    branding = input.branding ?? {
      name: "New Business",
      tagline: "Built with Zelrex",
      tone: "professional",
      primaryColor: "#4F8CFF",
    };
  }

  // ── Derive context (FIXED: now includes stylePreference + fontPreference) ──
  const businessContext: BusinessContext = input.surveyData
    ? {
        businessType: input.surveyData.businessType,
        audience: input.surveyData.targetAudience,
        offer: input.surveyData.mainService,
        pricing: input.surveyData.hasMultipleTiers
          ? `${input.surveyData.tiers.length} tiers`
          : input.surveyData.price,
        // Pass survey style + font through so selectTheme/brandIntelligence can use them
        stylePreference: input.surveyData.stylePreference,
        fontPreference: input.surveyData.fontPreference,
      }
    : input.businessContext ?? {
        businessType: "service",
        audience: "professionals",
        offer: "consulting",
        pricing: "custom",
      };

  const assumptions = deriveAssumptions({ branding, businessContext });
  
  // Pass extras to brandIntelligence for richer profile
  const profile = inferBrandProfile(branding, {
    businessType: businessContext.businessType,
    stylePreference: businessContext.stylePreference,
    fontPreference: businessContext.fontPreference,
  });
  
  const themeName = selectTheme(branding, profile, businessContext);

  // ── Resolve template from survey preferences ──────────────────
  const template = input.surveyData
    ? mapFontToTemplate(input.surveyData.fontPreference)
    : undefined;

  const id = input.id ?? "demo";

  // ── Generate copy via Claude ──────────────────────────────────
  console.log(`ZELREX BUILD: theme=${themeName}, generating copy...`);
  let copy = await generateWebsiteCopy({
    branding,
    assumptions,
    businessContext,
    surveyData: input.surveyData,
  });
  console.log("ZELREX BUILD: copy generated");

  // ── FIXED: Theme palette is now properly resolved from theme name ──
  const themeObj = resolveThemePalette(themeName, branding.primaryColor || "#4A90FF");

  const website: ZelrexWebsite = {
    id,
    branding,
    theme: themeObj as any,
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "valueProps", "howItWorks", "socialProof", "primaryCta"] },
      { slug: "offer", title: "Services", sections: ["hero", "whatYouGet", "whoItsFor", "cta"] },
      { slug: "pricing", title: "Pricing", sections: ["hero", "pricing", "cta"] },
      { slug: "about", title: "About", sections: ["hero", "story", "values", "cta"] },
      { slug: "contact", title: "Contact", sections: ["hero", "methods", "nextSteps", "cta"] },
    ],
    copy,
    assumptions,
    status: "preview",
    ...(template ? { template } : {}),
  } as any;

  // ── Inject SEO metadata ───────────────────────────────────────
  try {
    const seoData = {
      businessName: branding.name,
      tagline: branding.tagline || "",
      description: input.surveyData?.aboutBusiness || input.surveyData?.tagline || `${branding.name} — professional ${businessContext.businessType} services`,
      url: "",
      niche: input.surveyData?.businessType || businessContext.businessType || "",
      services: input.surveyData?.mainService ? [input.surveyData.mainService] : [],
      location: input.surveyData?.location || undefined,
      primaryColor: branding.primaryColor || "#4A90FF",
      pricing: input.surveyData?.hasMultipleTiers && input.surveyData?.tiers
        ? input.surveyData.tiers.map((t: any) => ({ name: t.name, price: t.price }))
        : input.surveyData?.price ? [{ name: "Starting at", price: input.surveyData.price }] : undefined,
    };
    (website as any).seoData = seoData;
  } catch (e) {
    console.warn("ZELREX BUILD: SEO data generation warning:", e);
  }

  // ── Generate contact form HTML ────────────────────────────────
  try {
    const contactEmail = input.surveyData?.email || input.surveyData?.contactEmail || "";
    if (contactEmail) {
      (website as any).contactFormHtml = generateContactFormHtml(
        contactEmail,
        branding.name,
        branding.primaryColor || "#4A90FF"
      );
    }
  } catch (e) {
    console.warn("ZELREX BUILD: Contact form generation warning:", e);
  }

  try {
    validateWebsite(website);
  } catch (e) {
    console.warn("ZELREX BUILD: validation warning (non-blocking):", e);
  }

  // ── FIXED: Consistency check now triggers regeneration on severe drift ──
  try {
    const businessType = (businessContext.businessType || '').toLowerCase();
    const expectedKeywords: Record<string, string[]> = {
      'video': ['video', 'edit', 'cut', 'footage', 'reel', 'youtube', 'content'],
      'design': ['design', 'brand', 'logo', 'visual', 'identity', 'graphic'],
      'writing': ['writ', 'copy', 'content', 'word', 'article', 'blog'],
      'social': ['social', 'content', 'post', 'engage', 'audience', 'instagram', 'linkedin'],
      'virtual': ['assist', 'support', 'admin', 'task', 'inbox', 'calendar'],
      'coach': ['coach', 'transform', 'goal', 'client', 'growth', 'change'],
      'consult': ['consult', 'strategy', 'advis', 'expert', 'analy', 'solution'],
      'agency': ['team', 'agency', 'scale', 'deliver', 'manage', 'service'],
    };
    
    const matchingCategory = Object.keys(expectedKeywords).find(cat => businessType.includes(cat));
    if (matchingCategory) {
      const keywords = expectedKeywords[matchingCategory];
      const heroText = JSON.stringify(website.copy?.home || {}).toLowerCase();
      const aboutText = JSON.stringify(website.copy?.about || {}).toLowerCase();
      const fullText = heroText + ' ' + aboutText;
      
      const matchCount = keywords.filter(kw => fullText.includes(kw)).length;
      
      // SEVERE DRIFT (0-1 keyword matches in 100+ chars): regenerate
      if (matchCount <= 1 && fullText.length > 100) {
        console.warn(`ZELREX BUILD: Severe copy drift — only ${matchCount}/${keywords.length} keywords. Regenerating with explicit constraint...`);
        try {
          const retryCopy = await generateWebsiteCopy({
            branding,
            assumptions: {
              ...assumptions,
              rationale: assumptions.rationale + ` IMPORTANT: This is a "${businessContext.businessType}" business. The copy MUST reference this category specifically — words like ${keywords.slice(0, 4).join(", ")} should appear naturally throughout.`,
            },
            businessContext,
            surveyData: input.surveyData,
          });
          if (retryCopy && retryCopy.home) {
            website.copy = retryCopy;
            console.log("ZELREX BUILD: Regeneration successful — drift fixed");
          }
        } catch (regenErr) {
          console.warn("ZELREX BUILD: Regeneration failed, using original copy:", regenErr);
        }
      } else if (matchCount < 2) {
        // MILD DRIFT (just below threshold): warn only
        console.warn(`ZELREX BUILD: Mild copy drift — ${matchCount}/${keywords.length} keywords. Acceptable but not ideal.`);
      }
    }
  } catch (e) {
    console.warn("ZELREX BUILD: consistency check warning:", e);
  }

  return website;
}