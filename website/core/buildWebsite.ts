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
      {
        slug: "home",
        title: "Home",
        sections: [
          "hero",
          "social-proof",
          "value-props",
          "how-it-works",
          "primary-cta",
        ],
      },
      {
        slug: "offer",
        title: "Offer",
        sections: [
          "offer-hero",
          "what-you-get",
          "who-its-for",
          "who-its-not-for",
          "cta",
        ],
      },
      {
        slug: "pricing",
        title: "Pricing",
        sections: [
          "pricing-tiers",
          "comparison",
          "faq",
          "cta",
        ],
      },
      {
        slug: "about",
        title: "About",
        sections: [
          "mission",
          "story",
          "values",
          "credibility",
        ],
      },
      {
        slug: "contact",
        title: "Contact",
        sections: [
          "contact-methods",
          "booking",
          "final-cta",
        ],
      },
    ],
  };
}
