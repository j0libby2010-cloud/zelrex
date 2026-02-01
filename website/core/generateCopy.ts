import { WebsiteCopy } from "./websiteCopy";
import { ZelrexWebsite } from "./websiteTypes";

export function generateWebsiteCopy(
  website: Pick<ZelrexWebsite, "branding">
): WebsiteCopy {
  const brand = website.branding;

  return {
    home: {
      hero: {
        headline: `Welcome to ${brand.name}`,
        subheadline:
          brand.tagline ??
          "A focused solution designed to help you move forward with confidence.",
      },
      sections: [
        {
          eyebrow: "What we do",
          title: "Clear outcomes, no unnecessary complexity",
          body:
            "Everything here is designed to help you take the next step with clarity and momentum.",
        },
        {
          eyebrow: "How it works",
          title: "A simple, intentional process",
          items: [
            {
              title: "Understand the goal",
              description:
                "We start by getting clear on what actually matters.",
            },
            {
              title: "Build the solution",
              description:
                "We create something focused, practical, and effective.",
            },
            {
              title: "Move forward",
              description:
                "You leave with clarity and a clear path ahead.",
            },
          ],
        },
      ],
      cta: {
        text: "Get started",
        urgency: "No pressure. Just clarity.",
      },
    },

    offer: {
      hero: {
        headline: "What we offer",
        subheadline:
          "A clear, focused offering designed around real outcomes.",
      },
      sections: [
        {
          title: "Designed for people who value clarity",
          body:
            "This is built for those who want progress without confusion or noise.",
        },
      ],
      cta: {
        text: "See if this is right for you",
      },
    },

    pricing: {
      hero: {
        headline: "Simple pricing",
        subheadline:
          "Transparent, straightforward pricing with no surprises.",
      },
      sections: [
        {
          title: "One clear option",
          body:
            "You get exactly what you need to move forward — nothing more, nothing less.",
        },
      ],
      cta: {
        text: "View next steps",
      },
    },

    about: {
      hero: {
        headline: "Why this exists",
        subheadline:
          "Built around clarity, trust, and long-term value.",
      },
      sections: [
        {
          title: "Our approach",
          body:
            "We believe progress comes from focus, not complexity.",
        },
      ],
    },

    contact: {
      hero: {
        headline: "Let’s talk",
        subheadline:
          "Start a conversation and figure out the best path forward.",
      },
      sections: [
        {
          title: "What happens next",
          body:
            "You’ll get clarity on your options and next steps quickly.",
        },
      ],
      cta: {
        text: "Start the conversation",
      },
    },
  };
}
