import fs from "fs/promises";
import path from "path";
import { ZelrexWebsite } from "./websiteTypes";

const STORE_PATH = path.join(process.cwd(), ".zelrex-sites.json");

async function readStore(): Promise<Record<string, ZelrexWebsite>> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeStore(data: Record<string, ZelrexWebsite>) {
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2));
}

export async function saveSite(site: ZelrexWebsite) {
  const store = await readStore();
  store[site.id] = site;
  await writeStore(store);
}

export async function loadSite(siteId: string) {
  const store = await readStore();
  return store[siteId] ?? null;
}
