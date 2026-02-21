// website/core/saveWebsite.ts
import { ZelrexWebsite } from "./websiteTypes";
import { kv } from "./kv";

export async function saveWebsite(site: ZelrexWebsite) {
  const key = `website:${site.id}`;

  await kv.setJson(key, site);

  return {
    id: site.id,
    // This is the *preview path*, not the domain.
    // Domain is added in route.ts using origin/base url.
    path: `/s/${site.id}`,
  };
}
