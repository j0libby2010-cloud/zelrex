export interface HeroCopy {
  headline: string;
  subheadline: string;
}

export interface ValueItem {
  title: string;
  description: string;
}

export interface SectionCopy {
  eyebrow?: string;
  title: string;
  body?: string;
  items?: ValueItem[];
}

export interface CTA_Copy {
  text: string;
  urgency?: string;
}

export interface PageCopy {
  hero: HeroCopy;
  sections: SectionCopy[];
  cta?: CTA_Copy;
}

export interface WebsiteCopy {
  home: PageCopy;
  offer: PageCopy;
  pricing: PageCopy;
  about: PageCopy;
  contact: PageCopy;
}
