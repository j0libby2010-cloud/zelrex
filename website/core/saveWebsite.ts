// Temporary in-memory store until Vercel KV is set up
const websites = new Map<string, any>();

export async function saveWebsite(website: any) {
  websites.set(website.id, website);
}

export async function getWebsiteById(id: string) {
  return websites.get(id) || null;
}