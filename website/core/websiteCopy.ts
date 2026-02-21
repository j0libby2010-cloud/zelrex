// website/core/websiteCopy.ts

export type CTAIntent = "primary" | "secondary";

export interface HeroCopy {
  headline: string;
  subheadline: string;
}

export interface ValuePropItem {
  title: string;
  description: string;
}

export interface HowItWorksStep {
  title: string;
  description: string;
}

export interface SocialProofItem {
  label: string;         // e.g. "Faster onboarding"
  value: string;         // e.g. "2–3x"
  detail?: string;       // e.g. "when the offer is clear"
}

export interface CTA_Copy {
  text: string;
  urgencyLine?: string;
  intent: CTAIntent;
}

export interface AssumptionsCopy {
  title: string;              // "Assumptions I made to move fast"
  bullets: string[];
  note?: string;              // "Reply with corrections and I'll adjust."
}

export interface HomeCopy {
  hero: HeroCopy;

  valueProps: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    items: ValuePropItem[];
  };

  howItWorks: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    steps: HowItWorksStep[];
  };

  socialProof: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    items: SocialProofItem[];
  };

  primaryCta: {
    title: string;
    subtitle?: string;
    cta: CTA_Copy;
  };

  assumptions?: AssumptionsCopy; // optional: you can show this on the site or just in chat
}

export interface OfferCopy {
  hero: HeroCopy;

  whatYouGet: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    items: ValuePropItem[];
  };

  whoItsFor: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    items: ValuePropItem[];
  };

  cta: {
    title: string;
    subtitle?: string;
    cta: CTA_Copy;
  };
}

export interface PricingTier {
  name: string;
  price: string;
  note?: string;
  features: string[];
  highlighted?: boolean;
}

export interface PricingCopy {
  hero: HeroCopy;

  pricing: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    tiers: PricingTier[];
  };

  cta: {
    title: string;
    subtitle?: string;
    cta: CTA_Copy;
  };
}

export interface AboutCopy {
  hero: HeroCopy;

  story: {
    eyebrow?: string;
    title: string;
    body: string;
  };

  values: {
    eyebrow?: string;
    title: string;
    items: ValuePropItem[];
  };

  cta: {
    title: string;
    subtitle?: string;
    cta: CTA_Copy;
  };
}

export interface ContactMethod {
  label: string;    // "Email"
  value: string;    // "hello@brand.com"
  href?: string;    // "mailto:hello@brand.com"
}

export interface ContactCopy {
  hero: HeroCopy;

  methods: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    items: ContactMethod[];
  };

  nextSteps: {
    eyebrow?: string;
    title: string;
    items: ValuePropItem[];
  };

  cta: {
    title: string;
    subtitle?: string;
    cta: CTA_Copy;
  };
}

export interface WebsiteCopy {
  home: HomeCopy;
  offer: OfferCopy;
  pricing: PricingCopy;
  about: AboutCopy;
  contact: ContactCopy;
}
