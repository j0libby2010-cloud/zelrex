import type { ZelrexWebsite } from "../../core/websiteTypes";
import type { ValuePropItem } from "../../core/websiteCopy";
import { Hero } from "../components/Hero";
import { Section } from "../components/Section";

type SectionData = {
  eyebrow?: string;
  title: string;
  body?: string;
  items?: ValuePropItem[];
  type?: string;
};

function HeroSection({
  data,
  website,
}: {
  data?: SectionData;
  website: ZelrexWebsite;
}) {
  return (
    <Hero
      website={website}
      title={data?.title ?? website.branding.name}
      subtitle={data?.body ?? website.branding.tagline}
    />
  );
}

function ValuePropsSection({
  data,
  website,
}: {
  data?: SectionData;
  website: ZelrexWebsite;
}) {
  if (!data) {
    return null;
  }

  return (
    <Section themeKey={website.theme}>
      {data.eyebrow ? <small>{data.eyebrow}</small> : null}
      <h2>{data.title}</h2>
      {data.body ? <p>{data.body}</p> : null}

      {data.items ? (
        <ul>
          {data.items.map((item: ValuePropItem, index: number) => (
            <li key={`${item.title}-${index}`}>
              <strong>{item.title}</strong> — {item.description}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function StepsSection({
  data,
  website,
}: {
  data?: SectionData;
  website: ZelrexWebsite;
}) {
  return <ValuePropsSection data={data} website={website} />;
}

function PricingSection({
  data,
  website,
}: {
  data?: SectionData;
  website: ZelrexWebsite;
}) {
  return <ValuePropsSection data={data} website={website} />;
}

function CTASection({
  data,
  website,
}: {
  data?: SectionData;
  website: ZelrexWebsite;
}) {
  if (!data) {
    return null;
  }

  return (
    <Section themeKey={website.theme}>
      <h2>{data.title}</h2>
      {data.body ? <p>{data.body}</p> : null}
    </Section>
  );
}

export function SectionRenderer({
  section,
  website,
}: {
  section: SectionData;
  website: ZelrexWebsite;
}) {
  switch (section.type) {
    case "hero":
      return <HeroSection data={section} website={website} />;
    case "features":
      return <ValuePropsSection data={section} website={website} />;
    case "steps":
      return <StepsSection data={section} website={website} />;
    case "pricing":
      return <PricingSection data={section} website={website} />;
    case "cta":
      return <CTASection data={section} website={website} />;
    default:
      return <ValuePropsSection data={section} website={website} />;
  }
}
