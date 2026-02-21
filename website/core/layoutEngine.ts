/**
 * ZELREX LAYOUT ENGINE v2 — NARROWED TO SERVICE BUSINESSES
 * 
 * Supports 5 core categories + 3 adjacent:
 *   Core:     video-editing, design, writing, social-media, virtual-assistance
 *   Adjacent: coaching, consulting, agency
 * 
 * Each produces a unique layout profile controlling:
 *   - Hero style (split, centered, stacked, editorial, bold)
 *   - Section order
 *   - Component variants
 *   - Spacing and density
 *   - Visual personality
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type BusinessCategory = 
  | "video-editing"
  | "design"
  | "writing"
  | "social-media"
  | "virtual-assistance"
  | "coaching"
  | "consulting"
  | "agency"
  | "default";

export type HeroStyle = "split" | "centered" | "stacked" | "editorial" | "bold";
export type Density = "spacious" | "balanced" | "compact";

export interface LayoutProfile {
  category: BusinessCategory;
  heroStyle: HeroStyle;
  density: Density;
  recommendedTheme: "obsidian" | "ivory" | "carbon" | "aura" | "slate";
  
  homeSections: string[];
  sectionVariants: Record<string, string>;
  pages: Array<{ slug: string; title: string; sections: string[] }>;
  
  headlineScale: number;
  bodyScale: number;
  spacingMultiplier: number;
  
  useGradients: boolean;
  useGlassEffects: boolean;
  accentIntensity: "subtle" | "moderate" | "bold";
  cardStyle: "flat" | "elevated" | "glass" | "bordered";
  ctaStyle: "pill" | "rounded" | "sharp" | "ghost";
  
  showTestimonials: boolean;
  showPortfolio: boolean;
  showProcess: boolean;
  showFaq: boolean;
  showStats: boolean;
  
  // Freelancer-specific
  showPlatformComparison: boolean;  // "Why work with me directly vs through Upwork"
  showCaseStudies: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════════

export function detectBusinessCategory(context: {
  businessType?: string;
  skills?: string;
  audience?: string;
  offer?: string;
}): BusinessCategory {
  const all = `${context.businessType || ""} ${context.skills || ""} ${context.audience || ""} ${context.offer || ""}`.toLowerCase();
  
  if (all.match(/video\s*edit|youtube.*edit|film\s*edit|motion\s*graphic|after\s*effect|premiere|davinci/)) return "video-editing";
  if (all.match(/graphic\s*design|brand\s*(design|identity)|logo|ui\s*\/?\s*ux|web\s*design|figma|illustration/)) return "design";
  if (all.match(/copywr|content\s*writ|ghost\s*writ|blog\s*writ|email\s*market|seo\s*writ|technical\s*writ/)) return "writing";
  if (all.match(/social\s*media|instagram|tiktok|content\s*(plan|creat|manag)|community\s*manag/)) return "social-media";
  if (all.match(/virtual\s*assist|admin|project\s*manag|bookkeep|data\s*entry|customer\s*support|executive\s*assist/)) return "virtual-assistance";
  if (all.match(/coach|mentor|transformation|mindset|wellness|fitness|life\s*coach|business\s*coach/)) return "coaching";
  if (all.match(/consult|strateg|advisory|fractional|cfo|cmo|cto/)) return "consulting";
  if (all.match(/agency|agencies|full.service|team.*of|we\s+(offer|provide|deliver)/)) return "agency";
  
  return "default";
}

// ═══════════════════════════════════════════════════════════════════════
// LAYOUT PROFILES
// ═══════════════════════════════════════════════════════════════════════

const layouts: Record<BusinessCategory, Omit<LayoutProfile, "category">> = {

  "video-editing": {
    heroStyle: "split",
    density: "balanced",
    recommendedTheme: "obsidian",
    homeSections: ["hero", "portfolio-preview", "services", "how-it-works", "pricing-preview", "testimonials", "cta"],
    sectionVariants: { services: "cards", "how-it-works": "list", testimonials: "featured" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "portfolio-preview", "services", "how-it-works", "pricing-preview", "testimonials", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "deliverables", "turnaround", "who-its-for", "platform-comparison", "cta"] },
      { slug: "about", title: "About", sections: ["story", "process", "tools", "credibility"] },
      { slug: "contact", title: "Start a Project", sections: ["contact-form", "booking", "response-time", "final-cta"] },
    ],
    headlineScale: 1.0, bodyScale: 1.0, spacingMultiplier: 1.0,
    useGradients: true, useGlassEffects: false, accentIntensity: "moderate",
    cardStyle: "elevated", ctaStyle: "rounded",
    showTestimonials: true, showPortfolio: true, showProcess: true, showFaq: false, showStats: false,
    showPlatformComparison: true, showCaseStudies: true,
  },

  "design": {
    heroStyle: "editorial",
    density: "spacious",
    recommendedTheme: "obsidian",
    homeSections: ["hero", "portfolio", "services", "about-preview", "testimonials", "cta"],
    sectionVariants: { portfolio: "grid", services: "minimal", testimonials: "featured" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "portfolio", "services", "about-preview", "testimonials", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "capabilities", "deliverables", "platform-comparison", "cta"] },
      { slug: "about", title: "About", sections: ["story", "philosophy", "tools", "press"] },
      { slug: "contact", title: "Hire Me", sections: ["contact-form", "booking", "availability"] },
    ],
    headlineScale: 1.3, bodyScale: 1.05, spacingMultiplier: 1.4,
    useGradients: false, useGlassEffects: false, accentIntensity: "subtle",
    cardStyle: "flat", ctaStyle: "ghost",
    showTestimonials: true, showPortfolio: true, showProcess: false, showFaq: false, showStats: false,
    showPlatformComparison: true, showCaseStudies: true,
  },

  "writing": {
    heroStyle: "split",
    density: "balanced",
    recommendedTheme: "ivory",
    homeSections: ["hero", "services", "samples", "how-it-works", "testimonials", "pricing-preview", "cta"],
    sectionVariants: { services: "list", samples: "cards", "how-it-works": "alternating" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "services", "samples", "how-it-works", "testimonials", "pricing-preview", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "deliverables", "industries", "platform-comparison", "cta"] },
      { slug: "about", title: "About", sections: ["story", "expertise", "publications", "credibility"] },
      { slug: "contact", title: "Get a Quote", sections: ["contact-form", "turnaround", "final-cta"] },
    ],
    headlineScale: 1.05, bodyScale: 1.0, spacingMultiplier: 1.0,
    useGradients: false, useGlassEffects: false, accentIntensity: "moderate",
    cardStyle: "bordered", ctaStyle: "rounded",
    showTestimonials: true, showPortfolio: false, showProcess: true, showFaq: true, showStats: false,
    showPlatformComparison: true, showCaseStudies: true,
  },

  "social-media": {
    heroStyle: "stacked",
    density: "compact",
    recommendedTheme: "obsidian",
    homeSections: ["hero", "results", "services", "platforms", "how-it-works", "testimonials", "cta"],
    sectionVariants: { results: "grid", services: "cards", platforms: "grid" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "results", "services", "platforms", "how-it-works", "testimonials", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "packages", "deliverables", "platform-comparison", "cta"] },
      { slug: "about", title: "About", sections: ["story", "results-showcase", "tools", "credibility"] },
      { slug: "contact", title: "Book a Call", sections: ["booking-hero", "what-to-expect", "final-cta"] },
    ],
    headlineScale: 1.05, bodyScale: 0.95, spacingMultiplier: 0.9,
    useGradients: true, useGlassEffects: true, accentIntensity: "bold",
    cardStyle: "glass", ctaStyle: "pill",
    showTestimonials: true, showPortfolio: false, showProcess: true, showFaq: false, showStats: true,
    showPlatformComparison: true, showCaseStudies: true,
  },

  "virtual-assistance": {
    heroStyle: "split",
    density: "balanced",
    recommendedTheme: "slate",
    homeSections: ["hero", "services", "how-it-works", "trust-signals", "testimonials", "pricing-preview", "cta"],
    sectionVariants: { services: "cards", "how-it-works": "list", "trust-signals": "grid" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "services", "how-it-works", "trust-signals", "testimonials", "pricing-preview", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "capabilities", "tools-used", "platform-comparison", "cta"] },
      { slug: "about", title: "About", sections: ["story", "experience", "certifications", "credibility"] },
      { slug: "contact", title: "Get Started", sections: ["contact-form", "response-time", "onboarding", "final-cta"] },
    ],
    headlineScale: 0.95, bodyScale: 1.0, spacingMultiplier: 0.95,
    useGradients: false, useGlassEffects: false, accentIntensity: "subtle",
    cardStyle: "bordered", ctaStyle: "sharp",
    showTestimonials: true, showPortfolio: false, showProcess: true, showFaq: true, showStats: false,
    showPlatformComparison: true, showCaseStudies: false,
  },

  "coaching": {
    heroStyle: "centered",
    density: "spacious",
    recommendedTheme: "aura",
    homeSections: ["hero", "transformation", "testimonials", "about-preview", "how-it-works", "pricing-preview", "cta"],
    sectionVariants: { transformation: "alternating", testimonials: "cards", "how-it-works": "list" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "transformation", "testimonials", "about-preview", "how-it-works", "pricing-preview", "cta"] },
      { slug: "offer", title: "Programs", sections: ["program-hero", "what-you-get", "who-its-for", "who-its-not-for", "guarantee", "cta"] },
      { slug: "about", title: "About", sections: ["story", "philosophy", "credentials", "personal"] },
      { slug: "contact", title: "Book a Call", sections: ["booking-hero", "what-to-expect", "final-cta"] },
    ],
    headlineScale: 1.2, bodyScale: 1.05, spacingMultiplier: 1.3,
    useGradients: true, useGlassEffects: false, accentIntensity: "subtle",
    cardStyle: "bordered", ctaStyle: "pill",
    showTestimonials: true, showPortfolio: false, showProcess: true, showFaq: true, showStats: false,
    showPlatformComparison: false, showCaseStudies: false,
  },

  "consulting": {
    heroStyle: "split",
    density: "balanced",
    recommendedTheme: "slate",
    homeSections: ["hero", "credibility", "services", "case-results", "process", "cta"],
    sectionVariants: { services: "list", "case-results": "cards", process: "alternating" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "credibility", "services", "case-results", "process", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "methodology", "deliverables", "who-its-for", "cta"] },
      { slug: "about", title: "About", sections: ["credentials", "experience", "approach", "publications"] },
      { slug: "contact", title: "Contact", sections: ["contact-form", "booking", "response-time"] },
    ],
    headlineScale: 0.95, bodyScale: 1.0, spacingMultiplier: 0.95,
    useGradients: false, useGlassEffects: false, accentIntensity: "subtle",
    cardStyle: "flat", ctaStyle: "sharp",
    showTestimonials: false, showPortfolio: false, showProcess: true, showFaq: true, showStats: true,
    showPlatformComparison: false, showCaseStudies: true,
  },

  "agency": {
    heroStyle: "bold",
    density: "balanced",
    recommendedTheme: "obsidian",
    homeSections: ["hero", "clients", "services", "case-studies", "process", "team-preview", "cta"],
    sectionVariants: { services: "grid", "case-studies": "featured", process: "list" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "clients", "services", "case-studies", "process", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "capabilities", "approach", "deliverables", "cta"] },
      { slug: "about", title: "About", sections: ["mission", "team", "values", "credibility"] },
      { slug: "contact", title: "Contact", sections: ["contact-form", "booking", "offices"] },
    ],
    headlineScale: 1.15, bodyScale: 1.0, spacingMultiplier: 1.1,
    useGradients: true, useGlassEffects: true, accentIntensity: "bold",
    cardStyle: "glass", ctaStyle: "pill",
    showTestimonials: false, showPortfolio: true, showProcess: true, showFaq: true, showStats: true,
    showPlatformComparison: false, showCaseStudies: true,
  },

  "default": {
    heroStyle: "split",
    density: "balanced",
    recommendedTheme: "obsidian",
    homeSections: ["hero", "services", "how-it-works", "testimonials", "pricing-preview", "cta"],
    sectionVariants: { services: "cards", "how-it-works": "alternating" },
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "services", "how-it-works", "testimonials", "pricing-preview", "cta"] },
      { slug: "offer", title: "Services", sections: ["service-hero", "deliverables", "who-its-for", "platform-comparison", "cta"] },
      { slug: "about", title: "About", sections: ["story", "process", "credibility"] },
      { slug: "contact", title: "Contact", sections: ["contact-form", "booking", "final-cta"] },
    ],
    headlineScale: 1.0, bodyScale: 1.0, spacingMultiplier: 1.0,
    useGradients: true, useGlassEffects: false, accentIntensity: "moderate",
    cardStyle: "elevated", ctaStyle: "rounded",
    showTestimonials: true, showPortfolio: false, showProcess: true, showFaq: true, showStats: false,
    showPlatformComparison: true, showCaseStudies: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

export function resolveLayout(context: {
  businessType?: string;
  skills?: string;
  audience?: string;
  offer?: string;
}): LayoutProfile {
  const category = detectBusinessCategory(context);
  return { category, ...layouts[category] };
}

export function applyLayoutToTheme(theme: any, layout: LayoutProfile): any {
  return {
    ...theme,
    heroTitleSize: Math.round(theme.heroTitleSize * layout.headlineScale),
    heroSubtitleSize: Math.round(theme.heroSubtitleSize * layout.bodyScale),
    sectionGap: Math.round(theme.sectionGap * layout.spacingMultiplier),
    pagePadding: Math.round(theme.pagePadding * layout.spacingMultiplier),
    _layout: {
      heroStyle: layout.heroStyle,
      density: layout.density,
      cardStyle: layout.cardStyle,
      ctaStyle: layout.ctaStyle,
      useGradients: layout.useGradients,
      useGlassEffects: layout.useGlassEffects,
      accentIntensity: layout.accentIntensity,
    },
  };
}