import { ZelrexWebsite } from "./websiteTypes";
import { generateWebsiteCopy } from "./generateCopy";
import { selectTheme } from "./selectTheme";

export function buildWebsite(input: {
  branding: ZelrexWebsite["branding"];
}): ZelrexWebsite {
  const theme = selectTheme(input.branding);

  return {
    theme,
    branding: input.branding,
    pages: [
      { type: "home", title: "Home", goal: "Primary conversion" },
      { type: "offer", title: "Offer", goal: "Explain value" },
      { type: "pricing", title: "Pricing", goal: "Set expectations" },
      { type: "about", title: "About", goal: "Build trust" },
      { type: "contact", title: "Contact", goal: "Start conversation" },
    ],
    copy: generateWebsiteCopy({ branding: input.branding }),
  };
}
