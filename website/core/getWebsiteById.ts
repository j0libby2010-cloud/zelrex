// website/core/getWebsiteById.ts
import { ZelrexWebsite } from "./websiteTypes";
import { kv } from "./kv";

export async function getWebsiteById(
  siteId: string
): Promise<ZelrexWebsite | null> {
  console.log("ZELREX LOAD: attempting to load website:", siteId);
  console.log("ZELREX LOAD: key =", `website:${siteId}`);
  
  try {
    const result = await kv.getJson<ZelrexWebsite>(`website:${siteId}`);
    console.log("ZELREX LOAD: result =", result ? "FOUND" : "NULL");
    return result;
  } catch (error) {
    console.error("ZELREX LOAD: error loading website:", error);
    return null;
  }
}