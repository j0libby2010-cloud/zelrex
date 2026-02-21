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

export function validateWebsite(website: ZelrexWebsite): void {
  // ---- Basic shape checks ----
  if (!website.id) {
    throw new Error("Website is missing id");
  }

  if (!website.branding) {
    throw new Error("Website is missing branding");
  }

  if (!website.theme) {
    throw new Error("Website is missing theme");
  }

  if (!Array.isArray(website.pages) || website.pages.length === 0) {
    throw new Error("Website has no pages");
  }

  if (!website.copy) {
    throw new Error("Website is missing copy");
  }

  // ---- Branding checks ----
  const branding = website.branding;

  if (!branding.name) {
    throw new Error("Branding is missing name");
  }

  if (!branding.tone || !ALLOWED_TONES.includes(branding.tone)) {
    throw new Error(`Invalid branding tone: ${branding.tone}`);
  }

  // ---- Page checks ----
  const slugs = website.pages.map((p) => p.slug);

  for (const required of REQUIRED_PAGES) {
    if (!slugs.includes(required)) {
      throw new Error(`Missing required page: ${required}`);
    }
  }

  for (const page of website.pages) {
    if (!page.slug || !page.title) {
      throw new Error("Page is missing slug or title");
    }

    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      throw new Error(`Page "${page.slug}" has no sections`);
    }
  }
}
