import { ZelrexWebsite } from "./websiteTypes";
import { generateWebsiteCopy } from "./generateCopy";
import { selectTheme } from "./selectTheme";

export function buildWebsite(input: {
  branding: ZelrexWebsite["branding"];
  id?: string;
}): ZelrexWebsite {
  const theme = selectTheme(input.branding);

  return {
    id: input.id ?? "demo",
    branding: input.branding,
    theme,
    copy: generateWebsiteCopy({ branding: input.branding }),
    pages: [
      { slug: "home", title: "Home", sections: [] },
      { slug: "offer", title: "Offer", sections: [] },
      { slug: "pricing", title: "Pricing", sections: [] },
      { slug: "about", title: "About", sections: [] },
      { slug: "contact", title: "Contact", sections: [] },
    ],
  };
}
