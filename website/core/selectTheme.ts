import { WebsiteBranding } from "./websiteTypes";

export function selectTheme(
  branding: WebsiteBranding
): "obsidian" | "ivory" | "carbon" | "aura" | "slate" {
  if (branding.tone === "luxury" || branding.tone === "authoritative") {
    return "obsidian";
  }

  if (branding.tone === "technical") {
    return "carbon";
  }

  if (branding.tone === "friendly") {
    return "aura";
  }

  if (branding.tone === "professional") {
    return "ivory";
  }

  return "slate";
}
