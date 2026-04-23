// website/core/buildWebsite.ts
//
// REWRITE: Properly accepts SurveyData and passes it through the full pipeline.
// Maps survey preferences to theme, layout, and copy generation.

import { ZelrexWebsite, BrandTone } from "./websiteTypes";
import { generateWebsiteCopy, SurveyData } from "./generateCopy";
import { selectTheme } from "./selectTheme";
import { inferBrandProfile } from "./brandIntelligence";
import { validateWebsite } from "./validateWebsite";
import { deriveAssumptions } from "./deriveAssumptions";
import { injectSEO, generateSitemap, generateRobotsTxt } from "@/lib/seo";
import { generateContactFormHtml } from "@/lib/websiteContactForm";

// Re-export SurveyData so route.ts can import from here
export type { SurveyData } from "./generateCopy";

export interface BusinessContext {
  businessType: string;
  audience: string;
  offer: string;
  pricing: string;
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

  // ── Derive context ────────────────────────────────────────────
  const businessContext: BusinessContext = input.surveyData
    ? {
        businessType: input.surveyData.businessType,
        audience: input.surveyData.targetAudience,
        offer: input.surveyData.mainService,
        pricing: input.surveyData.hasMultipleTiers
          ? `${input.surveyData.tiers.length} tiers`
          : input.surveyData.price,
      }
    : input.businessContext ?? {
        businessType: "service",
        audience: "professionals",
        offer: "consulting",
        pricing: "custom",
      };

  const assumptions = deriveAssumptions({ branding, businessContext });
  const profile = inferBrandProfile(branding);
  const theme = selectTheme(branding, profile, businessContext);

  // ── Resolve template from survey preferences ──────────────────
  const template = input.surveyData
    ? mapFontToTemplate(input.surveyData.fontPreference)
    : undefined;

  const id = input.id ?? "demo";

  // ── Generate copy via Claude (the big change) ─────────────────
  console.log("ZELREX BUILD: generating copy...");
  const copy = await generateWebsiteCopy({
    branding,
    assumptions,
    businessContext,
    surveyData: input.surveyData,
  });
  console.log("ZELREX BUILD: copy generated");

  // ── Build theme object for frontend ───────────────────────────
  // The frontend buildPreviewHtml uses these flat theme properties
  const isLight = input.surveyData?.stylePreference === "light-clean" || input.surveyData?.stylePreference === "minimal-elegant";
  const themeObj = isLight ? {
    name: "light",
    bg: "#FAFBFC",
    textPrimary: "#0F172A",
    textSecondary: "#64748B",
    accent: branding.primaryColor || "#4A90FF",
    surface: "#FFFFFF",
    border: "#E2E8F0",
  } : {
    name: typeof theme === "string" ? theme : (theme as any)?.name || "custom",
    bg: (theme as any)?.background || "#0a0a0a",
    textPrimary: (theme as any)?.textPrimary || "#ffffff",
    textSecondary: (theme as any)?.textSecondary || "rgba(255,255,255,0.6)",
    accent: branding.primaryColor || "#4A90FF",
    surface: (theme as any)?.surface || "#111111",
    border: (theme as any)?.border || "rgba(255,255,255,0.08)",
  };

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
    // Pass template choice through to frontend
    ...(template ? { template } : {}),
  } as any;

  // ── Inject SEO metadata ───────────────────────────────────────
  try {
    const seoData = {
      businessName: branding.name,
      tagline: branding.tagline || "",
      description: input.surveyData?.aboutBusiness || input.surveyData?.tagline || `${branding.name} — professional ${businessContext.businessType} services`,
      url: "", // Will be set after deploy — for now it's empty and gets filled by the frontend
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

  // ── RELIABILITY: Consistency check — make sure generated copy matches business type ──
  // Catches cases where Claude drifts and writes copy for the wrong business
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
    
    // Find the matching category
    const matchingCategory = Object.keys(expectedKeywords).find(cat => businessType.includes(cat));
    if (matchingCategory) {
      const keywords = expectedKeywords[matchingCategory];
      const heroText = JSON.stringify(website.copy?.home || {}).toLowerCase();
      const aboutText = JSON.stringify(website.copy?.about || {}).toLowerCase();
      const fullText = heroText + ' ' + aboutText;
      
      const matchCount = keywords.filter(kw => fullText.includes(kw)).length;
      // If fewer than 2 expected keywords appear, copy may have drifted
      if (matchCount < 2 && fullText.length > 100) {
        console.warn(`ZELREX BUILD: Copy consistency warning — business type "${businessType}" but only ${matchCount}/${keywords.length} expected keywords found in copy. Possible drift.`);
      }
    }
  } catch (e) {
    console.warn("ZELREX BUILD: consistency check warning:", e);
  }

  return website;
}