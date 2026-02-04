import { WebsiteBranding } from "./websiteTypes";

export function selectTheme(
  branding: WebsiteBranding
): "obsidian" | "ivory" | "carbon" | "aura" | "slate" {
  const tone = branding.tone;
  if (tone === "luxury" || tone === "authoritative") {
    return "obsidian";
  }

  if (tone === "technical") {
    return "carbon";
  }

  if (tone === "friendly") {
    return "aura";
  }

  if (tone === "professional") {
    return "ivory";
  }

  return "slate";
}
