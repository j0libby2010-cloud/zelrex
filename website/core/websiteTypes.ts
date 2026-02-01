import { WebsiteCopy } from "./websiteCopy";

export type WebsitePageType =
  | "home"
  | "offer"
  | "pricing"
  | "about"
  | "contact";

export interface WebsiteBranding {
  brandName: string;
  tagline?: string;
  logoUrl?: string;
  tone:
    | "professional"
    | "authoritative"
    | "friendly"
    | "luxury"
    | "technical";
}

export interface WebsitePage {
  type: WebsitePageType;
  title: string;
  goal: string;
}

export interface ZelrexWebsite {
  theme:
    | "obsidian"
    | "ivory"
    | "carbon"
    | "aura"
    | "slate";

  branding: WebsiteBranding;

  pages: WebsitePage[];
  
  copy: WebsiteCopy;
}
