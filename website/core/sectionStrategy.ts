import { ZelrexWebsite } from "./websiteTypes";

export type SectionKey =
  | "hero"
  | "valueProps"
  | "howItWorks"
  | "pricing"
  | "cta";

export function selectHomeSections(website: ZelrexWebsite): SectionKey[] {
  const tone = website.branding.tone;

  // Conservative / Trust-first brands
  if (tone === "professional" || tone === "authoritative") {
    return ["hero", "valueProps", "howItWorks", "pricing", "cta"];
  }

  // Friendly / emotional brands
  if (tone === "friendly") {
    return ["hero", "valueProps", "cta"];
  }

  // Minimal brands
  if (tone === "minimal") {
    return ["hero", "valueProps", "pricing", "cta"];
  }

  // Default
  return ["hero", "valueProps", "howItWorks", "pricing", "cta"];
}
