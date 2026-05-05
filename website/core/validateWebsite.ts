// website/core/validateWebsite.ts
//
// FIXED VERSION
//
// Critical fixes:
// 1. Validates copy structure depth (matches generateCopy.ts schema)
// 2. Validates contact methods exist (otherwise contact page is useless)
// 3. Returns issues array instead of throwing — caller can decide what to do
// 4. Severity levels — fatal vs warnings
// 5. Backward-compatible legacy throwing version exported as validateWebsiteOrThrow

import { ZelrexWebsite } from "./websiteTypes";

const REQUIRED_PAGES: ZelrexWebsite["pages"][number]["slug"][] = [
  "home",
  "about",
  "contact",
];

const ALLOWED_TONES = [
  "professional",
  "luxury",
  "friendly",
  "authoritative",
  "minimal",
  "technical",
];

export interface ValidationIssue {
  severity: "fatal" | "warning";
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  hasFatal: boolean;
  issues: ValidationIssue[];
}

/**
 * Returns detailed validation result instead of throwing.
 * Caller decides whether to block deployment based on issues.
 */
export function checkWebsite(website: ZelrexWebsite): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  // ─── BASIC SHAPE CHECKS ─────────────────────────────
  if (!website) {
    issues.push({ severity: "fatal", field: "website", message: "Website object is missing entirely" });
    return { valid: false, hasFatal: true, issues };
  }
  
  if (!website.id) {
    issues.push({ severity: "fatal", field: "id", message: "Website is missing id" });
  }
  if (!website.branding) {
    issues.push({ severity: "fatal", field: "branding", message: "Website is missing branding" });
  }
  if (!website.theme) {
    issues.push({ severity: "fatal", field: "theme", message: "Website is missing theme" });
  }
  if (!Array.isArray(website.pages) || website.pages.length === 0) {
    issues.push({ severity: "fatal", field: "pages", message: "Website has no pages" });
  }
  if (!website.copy) {
    issues.push({ severity: "fatal", field: "copy", message: "Website is missing copy" });
  }
  
  // If basic shape is broken, return early — deeper checks will throw
  if (issues.some(i => i.severity === "fatal")) {
    return { valid: false, hasFatal: true, issues };
  }
  
  // ─── BRANDING CHECKS ─────────────────────────────
  const branding = website.branding;
  
  if (!branding.name || branding.name.trim().length === 0) {
    issues.push({ severity: "fatal", field: "branding.name", message: "Business name is required" });
  }
  if (branding.name && branding.name.length > 200) {
    issues.push({ severity: "warning", field: "branding.name", message: "Business name unusually long, may not display well" });
  }
  if (!branding.tone || !ALLOWED_TONES.includes(branding.tone)) {
    issues.push({ severity: "fatal", field: "branding.tone", message: `Invalid tone: ${branding.tone}` });
  }
  if (!branding.primaryColor || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(branding.primaryColor)) {
    issues.push({ severity: "warning", field: "branding.primaryColor", message: "Primary color is missing or invalid hex format" });
  }
  
  // ─── PAGE CHECKS ─────────────────────────────
  const slugs = website.pages.map((p) => p.slug);
  
  for (const required of REQUIRED_PAGES) {
    if (!slugs.includes(required)) {
      issues.push({ severity: "fatal", field: "pages", message: `Missing required page: ${required}` });
    }
  }
  
  for (const page of website.pages) {
    if (!page.slug || !page.title) {
      issues.push({ severity: "fatal", field: `pages.${page.slug || "?"}`, message: "Page is missing slug or title" });
      continue;
    }
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      issues.push({ severity: "warning", field: `pages.${page.slug}.sections`, message: `Page "${page.slug}" has no sections defined` });
    }
  }
  
  // ─── COPY DEEP STRUCTURE CHECKS ─────────────────────────────
  // Verify the copy structure matches what generateCopy.ts produces
  const copy = website.copy as any;
  
  // Home page must have hero
  if (!copy.home) {
    issues.push({ severity: "fatal", field: "copy.home", message: "Home page copy is missing" });
  } else {
    if (!copy.home.hero?.headline || copy.home.hero.headline.length < 3) {
      issues.push({ severity: "fatal", field: "copy.home.hero.headline", message: "Home hero headline is missing or too short" });
    }
    if (copy.home.hero?.headline && copy.home.hero.headline.length > 200) {
      issues.push({ severity: "warning", field: "copy.home.hero.headline", message: "Hero headline unusually long" });
    }
  }
  
  // About page must have story body
  if (!copy.about) {
    issues.push({ severity: "fatal", field: "copy.about", message: "About page copy is missing" });
  } else {
    if (!copy.about.hero?.headline) {
      issues.push({ severity: "warning", field: "copy.about.hero.headline", message: "About page is missing hero headline" });
    }
    if (!copy.about.story?.body && !copy.about.story?.title) {
      issues.push({ severity: "warning", field: "copy.about.story", message: "About page is missing story content" });
    }
  }
  
  // Contact page must have at least one contact method
  if (!copy.contact) {
    issues.push({ severity: "fatal", field: "copy.contact", message: "Contact page copy is missing" });
  } else {
    const methodsExist = Array.isArray(copy.contact.methods?.items) && copy.contact.methods.items.length > 0;
    if (!methodsExist) {
      issues.push({ 
        severity: "warning", 
        field: "copy.contact.methods.items", 
        message: "Contact page has no contact methods. Visitors can't reach the freelancer." 
      });
    } else {
      // Verify at least one method has a usable value
      const hasUsableMethod = copy.contact.methods.items.some((item: any) => 
        item.value && typeof item.value === "string" && item.value.length > 2
      );
      if (!hasUsableMethod) {
        issues.push({ 
          severity: "warning", 
          field: "copy.contact.methods.items", 
          message: "All contact methods appear empty or invalid" 
        });
      }
    }
  }
  
  // Pricing page must have at least one tier
  if (copy.pricing?.pricing) {
    const tiers = copy.pricing.pricing.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      issues.push({ severity: "warning", field: "copy.pricing.pricing.tiers", message: "Pricing page has no tiers defined" });
    } else {
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!tier.name) {
          issues.push({ severity: "warning", field: `copy.pricing.pricing.tiers[${i}].name`, message: `Tier ${i + 1} is missing a name` });
        }
        if (!tier.price) {
          issues.push({ severity: "warning", field: `copy.pricing.pricing.tiers[${i}].price`, message: `Tier ${i + 1} is missing a price` });
        }
      }
    }
  }
  
  // Offer page checks
  if (copy.offer) {
    if (!copy.offer.hero?.headline) {
      issues.push({ severity: "warning", field: "copy.offer.hero.headline", message: "Services page is missing hero headline" });
    }
  }
  
  // ─── SUMMARY ─────────────────────────────
  const hasFatal = issues.some(i => i.severity === "fatal");
  
  return {
    valid: !hasFatal,
    hasFatal,
    issues,
  };
}

/**
 * Legacy throwing version — for callers that expect old behavior.
 * Throws on first fatal issue.
 */
export function validateWebsite(website: ZelrexWebsite): void {
  const result = checkWebsite(website);
  
  // Log warnings (non-blocking)
  const warnings = result.issues.filter(i => i.severity === "warning");
  if (warnings.length > 0) {
    console.warn("[ZELREX VALIDATE] Warnings:", warnings.map(w => `${w.field}: ${w.message}`).join("; "));
  }
  
  // Throw on first fatal
  const fatal = result.issues.find(i => i.severity === "fatal");
  if (fatal) {
    throw new Error(`${fatal.field}: ${fatal.message}`);
  }
}

/**
 * Strict validation — throws on ANY issue including warnings.
 * Use for pre-deployment gating where quality matters.
 */
export function validateWebsiteStrict(website: ZelrexWebsite): void {
  const result = checkWebsite(website);
  
  if (result.issues.length === 0) return;
  
  const messages = result.issues.map(i => `${i.severity.toUpperCase()} ${i.field}: ${i.message}`);
  throw new Error("Website validation failed:\n" + messages.join("\n"));
}