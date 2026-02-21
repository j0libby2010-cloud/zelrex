"use client";
import { ZelrexWebsite } from "../core/websiteTypes";
import { BasePage } from "../theme/BasePage";

import { HomePage } from "./types/HomePage";
import { PricingPage } from "./types/PricingPage";
import { AboutPage } from "./types/AboutPage";
import { ContactPage } from "./types/ContactPage";
import { OfferPage } from "./types/OfferPage";

export function RenderPage({
  website,
  pageType,
}: {
  website: ZelrexWebsite;
  pageType: "home" | "offer" | "pricing" | "about" | "contact";
}) {
  return (
    <BasePage website={website}>
      {pageType === "home" && <HomePage website={website} />}
      {pageType === "offer" && <OfferPage website={website} />}
      {pageType === "pricing" && <PricingPage website={website} />}
      {pageType === "about" && <AboutPage website={website} />}
      {pageType === "contact" && <ContactPage website={website} />}
    </BasePage>
  );
}
