export interface WebsitePage {
  slug: string;
  title: string;
  sections: any[];
}

export interface ZelrexWebsite {
  id: string;
  brand: {
    name: string;
    logo?: string;
  };
  theme: string;
  pages: WebsitePage[];
}
