/**
 * ZELREX WEBSITE BUILDER — v3
 * 
 * This is the orchestrator. It takes survey data OR chat-extracted context,
 * runs it through the layout engine for visual variety, generates bespoke
 * copy via AI, and assembles a complete website object.
 * 
 * FLOW:
 *   Survey data / Chat context
 *     → detectBusinessCategory()     — what kind of freelancer
 *     → getLayoutProfile()           — visual layout for that category
 *     → selectTheme()                — color theme matching style preference
 *     → generateWebsiteCopy()        — AI-written copy with REAL data
 *     → assemble ZelrexWebsite       — complete website object
 *     → validateWebsite()            — catch missing/broken fields
 *     → return
 */

import { ZelrexWebsite } from "./websiteTypes";
import { generateWebsiteCopy } from "./generateCopy";
import { selectTheme } from "./selectTheme";
import { validateWebsite } from "./validateWebsite";
import {
  detectBusinessCategory,
  resolveLayout,
  applyLayoutToTheme,
  LayoutProfile,
} from "./layoutEngine";
import { inferBrandProfile } from "./brandIntelligence";
import { deriveAssumptions } from "./deriveAssumptions";

// ─── Input types ────────────────────────────────────────────────────

export interface BusinessContext {
  businessType: string;
  audience: string;
  offer: string;
  pricing: string;
}

export interface SurveyData {
  businessName: string;
  tagline: string;
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
  primaryColor: string;
  stylePreference: "dark-premium" | "light-clean" | "bold-colorful" | "minimal-elegant";
  fontPreference: "modern" | "classic" | "editorial" | "tech";
  email: string;
  phone: string;
  location: string;
  hours: string;
  socialLinks: Array<{ platform: string; url: string }>;
  calendlyUrl: string;
  aboutStory: string;
  uniqueSellingPoint: string;
  platformsLeavingFrom: string;
}

export interface BuildWebsiteInput {
  id?: string;
  branding?: ZelrexWebsite["branding"];
  businessContext?: BusinessContext;
  surveyData?: SurveyData;
}

// ─── Style → tone mapping ───────────────────────────────────────────

function mapStyleToTone(style?: string): ZelrexWebsite["branding"]["tone"] {
  switch (style) {
    case "dark-premium":    return "professional";
    case "light-clean":     return "minimal";
    case "bold-colorful":   return "friendly";
    case "minimal-elegant": return "luxury";
    default:                return "professional";
  }
}

// ─── Main builder ───────────────────────────────────────────────────

export async function buildWebsite(input: BuildWebsiteInput): Promise<ZelrexWebsite> {
  const survey = input.surveyData;
  const id = input.id ?? "demo";

  // ── 1. Resolve branding (survey data takes priority) ──────────
  const branding: ZelrexWebsite["branding"] = survey
    ? {
        name: survey.businessName || "My Business",
        tagline: survey.tagline || "",
        tone: mapStyleToTone(survey.stylePreference),
        primaryColor: survey.primaryColor || "#4A90FF",
      }
    : input.branding ?? {
        name: "New Business",
        tagline: "Built with Zelrex",
        tone: "professional",
        primaryColor: "#4F8CFF",
      };

  // ── 2. Build business context from survey or input ────────────
  const businessContext: BusinessContext = survey
    ? {
        businessType: survey.businessType,
        audience: survey.targetAudience,
        offer: survey.mainService || survey.serviceDescription,
        pricing: survey.hasMultipleTiers
          ? survey.tiers.map(t => `${t.name}: ${t.price}`).join(", ")
          : survey.price,
      }
    : input.businessContext ?? {
        businessType: "",
        audience: "",
        offer: "",
        pricing: "",
      };

  // ── 3. Detect category and get layout profile ─────────────────
  const category = detectBusinessCategory({
    businessType: businessContext.businessType,
    skills: businessContext.offer,
    audience: businessContext.audience,
  });

  const layout: LayoutProfile = resolveLayout({
    businessType: businessContext.businessType,
    skills: businessContext.offer,
    audience: businessContext.audience,
  });

  console.log(`ZELREX BUILD: category=${category}, hero=${layout.heroStyle}, theme=${layout.recommendedTheme}`);

  // ── 4. Select theme ───────────────────────────────────────────
  const profile = inferBrandProfile(branding);
  const theme = selectTheme(branding, profile, businessContext);
  const adjustedTheme = applyLayoutToTheme(theme, layout);

  // ── 5. Determine pages from layout profile ────────────────────
  // The layout engine decides which pages this business type needs.
  // Freelancers don't need a separate pricing page if pricing is on
  // the services/offer page.
  const pages: ZelrexWebsite["pages"] = (layout.pages.length > 0
    ? layout.pages
    : [
        { slug: "home", title: "Home", sections: layout.homeSections },
        { slug: "about", title: "About", sections: ["story", "values", "cta"] },
        { slug: "contact", title: "Contact", sections: ["methods", "next-steps", "cta"] },
      ]) as ZelrexWebsite["pages"];

  // ── 6. Generate bespoke copy ──────────────────────────────────
  const assumptions = deriveAssumptions({ branding, businessContext });
  const copy = await generateWebsiteCopy({
    branding,
    assumptions,
    businessContext,
  });

  // ── 7. Assemble website object ────────────────────────────────
  const website: ZelrexWebsite = {
    id,
    branding,
    theme: adjustedTheme,
    pages,
    copy,
    layout,        // <-- Layout profile now attached to the website
    assumptions,
    status: "preview",
    // Pass through business context for components to use
    businessContext: businessContext as any,
  };

  // ── 8. Validate ───────────────────────────────────────────────
  try {
    validateWebsite(website);
  } catch (err) {
    // Log but don't crash — a preview with minor issues is better
    // than no preview at all
    console.warn("ZELREX BUILD: validation warning:", err);
  }

  console.log(`ZELREX BUILD: complete. Pages: ${pages.map(p => p.slug).join(", ")}`);

  return website;
}
























































