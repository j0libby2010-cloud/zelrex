import { ZelrexWebsite } from "./websiteTypes";
import { selectTheme } from "./selectTheme";

export function buildWebsite(input: {
  brand: ZelrexWebsite["brand"];
  id?: string;
}): ZelrexWebsite {
  const theme = selectTheme(input.brand as any) as string;

  return {
    id: input.id ?? "demo",
    brand: input.brand,
    theme,
    pages: [
      { slug: "home", title: "Home", sections: [] },
      { slug: "offer", title: "Offer", sections: [] },
      { slug: "pricing", title: "Pricing", sections: [] },
      { slug: "about", title: "About", sections: [] },
      { slug: "contact", title: "Contact", sections: [] },
    ],
  };
}
