import { ZelrexWebsite } from "./websiteTypes";

export function selectTheme(
  brand: ZelrexWebsite["brand"] | any
): "obsidian" | "ivory" | "carbon" | "aura" | "slate" {
  const tone = (brand as any).tone;
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
