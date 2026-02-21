"use client";
import type { ZelrexWebsite } from "../../core/websiteTypes";
import { selectHomeSections } from "../../core/sectionStrategy";
import { HeroSection } from "../components/HeroSection";
import { ValuePropsSection } from "../components/ValuePropsSection";
import { HowItWorksSection } from "../components/HowItWorksSection";
import { PricingSection } from "../components/PricingSection";
import { PrimaryCTASection } from "../components/PrimaryCTASection";

export function HomePage({ website }: { website: ZelrexWebsite }) {
  const sections = selectHomeSections(website);
  const layout = website.layout;

  return (
    <>
      {sections.includes("hero") && (
        <HeroSection website={website} layout={layout} />
      )}
      {sections.includes("valueProps") && (
        <ValuePropsSection website={website} layout={layout} />
      )}
      {sections.includes("howItWorks") && (
        <HowItWorksSection website={website} />
      )}
      {sections.includes("pricing") && (
        <PricingSection website={website} />
      )}
      {sections.includes("cta") && (
        <PrimaryCTASection website={website} />
      )}
    </>
  );
}
