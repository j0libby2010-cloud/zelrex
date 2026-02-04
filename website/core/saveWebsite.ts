import { ZelrexWebsite } from "./websiteTypes";

const websiteStore = new Map<string, ZelrexWebsite>();

export async function saveWebsite(website: ZelrexWebsite) {
  websiteStore.set(website.id, website);
}

export async function getWebsiteById(id: string): Promise<ZelrexWebsite | null> {
  return websiteStore.get(id) ?? null;
}
