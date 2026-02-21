// website/core/websiteTypes.ts

import { WebsiteCopy } from "./websiteCopy";
import { ZelrexAssumptions } from "./deriveAssumptions";
import type { LayoutProfile } from "./layoutEngine";

export type WebsiteStatus = "draft" | "preview" | "published";

export type BrandTone =
  | "professional"
  | "luxury"
  | "friendly"
  | "authoritative"
  | "minimal"
  | "technical";

export type FontStyle = "modern" | "classic" | "editorial" | "tech";

export interface WebsiteBranding {
  name: string;
  logo?: string;            // optional (URLs only)
  tagline?: string;

  tone: BrandTone;

  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;

  fontStyle?: FontStyle;
}

export interface WebsitePage {
  slug: "home" | "offer" | "pricing" | "about" | "contact";
  title: string;
  sections: string[];
}

export interface ZelrexWebsite {
  id: string;

  branding: WebsiteBranding;
  theme: string;
  layout?: LayoutProfile;

  pages: WebsitePage[];
  copy: WebsiteCopy;

  assumptions: ZelrexAssumptions;

  status: WebsiteStatus;

  businessContext?: {
    businessType: string;
    audience: string;
    offer: string;
    pricing: string;
  };

  // Optional publishing fields (Step 4)
  previewUrl?: string;
  customDomain?: string;
}
