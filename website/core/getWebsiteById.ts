import { buildWebsite } from "./buildWebsite";
import { ZelrexWebsite } from "./websiteTypes";

/**
 * TEMP v1
 * Later replaced by DB lookup
 */
export function getWebsiteById(siteId: string): ZelrexWebsite | null {
  if (siteId === "demo") {
    return buildWebsite({
      branding: {
        brandName: "DemoCo",
        tagline: "Websites designed to convert",
        tone: "professional",
      },
    });
  }

  return null;
}
