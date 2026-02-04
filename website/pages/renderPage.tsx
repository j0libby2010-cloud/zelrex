import { ZelrexWebsite } from "../core/websiteTypes";
import { BasePage } from "../theme/BasePage";

import { HomePage } from "./types/HomePage";
import { OfferPage } from "./types/OfferPage";
import { PricingPage } from "./types/PricingPage";
import { AboutPage } from "./types/AboutPage";
import { ContactPage } from "./types/ContactPage";

export function RenderPage({
  website,
  pageType,
}: {
  website: ZelrexWebsite;
  pageType: "home" | "offer" | "pricing" | "about" | "contact";
}) {
  function Page() {
    switch (pageType) {
      case "home":
        return <HomePage website={website} />;
      case "offer":
        return <OfferPage website={website} />;
      case "pricing":
        return <PricingPage website={website} />;
      case "about":
        return <AboutPage website={website} />;
      case "contact":
        return <ContactPage website={website} />;
      default:
        return null;
    }
  }

  return (
    <BasePage website={website}>
      <Page />
    </BasePage>
  );
}
