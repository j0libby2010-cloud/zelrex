import { WebsiteCopy } from "./websiteCopy";

export interface WebsitePage {
  slug: string;
  title: string;
  sections: any[];
}

export interface ZelrexWebsite {
  id: string;

  branding: WebsiteBranding;

  theme: string;

  pages: WebsitePage[];

  copy: WebsiteCopy;
}



export interface WebsiteBranding {
  name: string;
  logo?: string;
  tagline?: string;

tone:
  | "professional"
  | "luxury"
  | "friendly"
  | "authoritative"
  | "minimal"
  | "technical";

  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;

  fontStyle?: "modern" | "classic" | "editorial" | "tech";
}
