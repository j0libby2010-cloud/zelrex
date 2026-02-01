import { buildWebsite } from "./buildWebsite";
import { ZelrexWebsite } from "./websiteTypes";

/**
 * TEMP v1
 * Later replaced by DB lookup
 */
export function getWebsiteById(siteId: string): ZelrexWebsite | null {
  if (siteId === "demo") {
    return buildWebsite({
      brand: {
        name: "DemoCo",
        logo: undefined,
      },
      id: "demo",
    });
  }

  return null;
}
