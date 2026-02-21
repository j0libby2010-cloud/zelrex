// website/core/kv.ts
import { kv as vercelKv } from "@vercel/kv";

/**
 * Single KV client wrapper.
 * We do not instantiate anything ourselves here—@vercel/kv reads env vars.
 * If env vars are missing, we throw a clear error early.
 */
function assertKvEnv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      "@vercel/kv is not configured. Missing KV_REST_API_URL and/or KV_REST_API_TOKEN.\n" +
        "Fix: Connect Upstash Redis to the Vercel project OR set the env vars in Vercel Project Settings.\n" +
        "Local fix: run `vercel link` then `vercel env pull .env.local` and restart dev server."
    );
  }
}

export const kv = {
  async setJson<T>(key: string, value: T) {
    assertKvEnv();
    // @vercel/kv supports JSON directly
    await vercelKv.set(key, value as any);
  },

  async getJson<T>(key: string): Promise<T | null> {
    assertKvEnv();
    const v = await vercelKv.get<T>(key);
    return (v ?? null) as T | null;
  },

  async del(key: string) {
    assertKvEnv();
    await vercelKv.del(key);
  },
};
