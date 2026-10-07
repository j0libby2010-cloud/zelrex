/**
 * MODELS — one place that decides which Claude model runs each job, shapes the request for that model,
 * and keeps the app working when a model ID is retired.
 *
 * Why this exists
 *  - Model IDs were hard-coded at ~30 call sites, several of them already retired or about to be.
 *    Now every call names a TIER ("fast", "standard", "premium"), and the IDs live here.
 *  - Claude 5.x models reject some request shapes older models accepted (thinking {type:"enabled"},
 *    non-default temperature/top_p/top_k). A single bad parameter is a 400 on every call. buildParams()
 *    produces the right shape per model, so an env override or a fallback to an older model still works.
 *  - If a model is retired or unknown (404 / "model" 400), createMessage() tries the next model in the
 *    tier's chain instead of failing the user's request, and logs loudly so you can update the config.
 *
 * Override any tier without a deploy of code: set ANTHROPIC_MODEL_HAIKU (fast), ANTHROPIC_MODEL_SONNET
 * (standard) or ANTHROPIC_MODEL_OPUS (premium) in Vercel. The defaults below stay in the fallback chain.
 *
 * Prices and retirement dates checked against Anthropic's docs on 2026-10-07 (USD per million tokens, in/out):
 *   claude-haiku-5-5   $0.10 / $0.50 (prompts up to 100k)      claude-opus-5-5   $4 / $20
 *   claude-sonnet-5-5  $2 / $10                                  claude-opus-4-6   $5 / $25 (retires no sooner than 2027-02-05)
 *   claude-haiku-4-5-20251001  $1 / $5 (retires no sooner than 2026-10-15)
 *   claude-sonnet-4-5-20250929 retires 2026-11-30 (tentative); claude-sonnet-4-20250514 already retired.
 * Re-check https://platform.claude.com/docs/en/about-claude/model-deprecations every few months.
 */

import type Anthropic from "@anthropic-ai/sdk";

export type Tier = "fast" | "standard" | "premium";
export type Effort = "low" | "medium" | "high";

/** Per-call options, passed inside the request as `_z` so call sites stay a one-line change. */
export type ZOpts = {
  /** Reasoning depth on Claude 5.x models. Default "medium". */
  effort?: Effort;
  /** "off" (default for standard/fast) skips extended thinking where the model allows it; "adaptive" lets the model think. */
  thinking?: "off" | "adaptive";
  /** Keep thinking blocks in the response. Only needed when the caller feeds `response.content` back in a tool loop. */
  keepThinking?: boolean;
  /** Thinking budget used only if the call falls back to an older model that needs one. */
  legacyBudget?: number;
  /** Use this exact model first instead of the tier default (still falls back down the tier's chain). */
  model?: string;
};

const DEFAULTS: Record<Tier, string> = {
  fast: "claude-haiku-5-5",
  standard: "claude-sonnet-5-5",
  premium: "claude-opus-5-5",
};

/** Tried in order after the primary. Always ends on something that exists today and is not scheduled to retire soon. */
const FALLBACKS: Record<Tier, string[]> = {
  fast: ["claude-haiku-4-5-20251001", "claude-sonnet-5-5"],
  standard: ["claude-opus-5-5", "claude-opus-4-6"],
  premium: ["claude-sonnet-5-5", "claude-opus-4-6"],
};

const ENV_KEY: Record<Tier, string> = { fast: "ANTHROPIC_MODEL_HAIKU", standard: "ANTHROPIC_MODEL_SONNET", premium: "ANTHROPIC_MODEL_OPUS" };

/** The model a tier resolves to right now (env override, else default). */
export function modelFor(tier: Tier): string {
  const v = process.env[ENV_KEY[tier]];
  return v && v.trim() ? v.trim() : DEFAULTS[tier];
}

/** Full ordered list of models to try for a tier: primary first, then fallbacks, no duplicates. */
export function chainFor(tier: Tier, first?: string): string[] {
  const out: string[] = [];
  for (const id of [first, modelFor(tier), DEFAULTS[tier], ...FALLBACKS[tier]]) if (id && !out.includes(id)) out.push(id);
  return out;
}

/** Models older than the 4.7 generation accept thinking {type:"enabled"} and sampling parameters; newer ones reject them. */
export function isLegacyModel(id: string): boolean {
  return /^claude-(?:3|opus-4(?:-[0-6])?(?:-\d{8})?$|sonnet-4|haiku-4)/.test(id);
}
const family = (id: string) => (id.match(/^claude-(opus|sonnet|haiku|fable|mythos)/)?.[1] ?? "other");

/** Shape one request for one model. Pure: same inputs, same output. */
export function buildParams(id: string, params: any, z: ZOpts = {}): any {
  const { _z, ...rest } = params || {};
  const p: any = { ...rest, model: id };

  if (isLegacyModel(id)) {
    delete p.output_config;
    if (z.thinking === "adaptive" && z.legacyBudget && z.legacyBudget >= 1024) {
      p.thinking = { type: "enabled", budget_tokens: z.legacyBudget };
      p.temperature = 1;                                  /* required while thinking is on */
      p.max_tokens = Math.max(p.max_tokens || 0, z.legacyBudget + 1024);
    } else {
      delete p.thinking;
    }
    return p;
  }

  /* Claude 5.x: no sampling params, no manual thinking budgets. */
  delete p.temperature; delete p.top_p; delete p.top_k;
  const effort = z.effort ?? "medium";
  const fam = family(id);
  let thinkingMayRun = true;

  if (fam === "opus") {
    delete p.thinking;                                     /* always on; effort is the only control */
    p.output_config = { ...(p.output_config || {}), effort };
  } else if (z.thinking === "adaptive") {
    p.thinking = { type: "adaptive" };
    p.output_config = { ...(p.output_config || {}), effort };
  } else if (fam === "sonnet") {
    p.thinking = { type: "between_tools" };                /* Sonnet 5.5's way to turn thinking off */
    thinkingMayRun = false;
  } else {
    delete p.thinking;                                     /* Haiku and others: keep effort low so they don't over-think */
    p.output_config = { ...(p.output_config || {}), effort: z.effort ?? "low" };
  }

  /* max_tokens caps thinking + answer together. Leave room so a short answer is never starved by thinking. */
  if (thinkingMayRun && typeof p.max_tokens === "number") p.max_tokens += effort === "low" ? 1024 : 2048;
  return p;
}

/** True when the error means "this model ID can't be used" (retired, unknown, no access), not "your request was bad". */
export function isModelUnavailable(e: any): boolean {
  const status = e?.status ?? e?.statusCode;
  const msg = String(e?.error?.error?.message ?? e?.error?.message ?? e?.message ?? "").toLowerCase();
  const type = String(e?.error?.error?.type ?? e?.error?.type ?? "").toLowerCase();
  if (status === 404 || type === "not_found_error") return /model/.test(msg) || type === "not_found_error";
  if (status === 400 && /model/.test(msg) && /(retired|deprecat|not found|does not exist|unknown|invalid model|not available|no access)/.test(msg)) return true;
  return false;
}

const deadUntil = new Map<string, number>();
const DEAD_MS = 10 * 60 * 1000;
const isDead = (id: string) => (deadUntil.get(id) ?? 0) > Date.now();
/** Test hook. */
export function _resetModelHealth() { deadUntil.clear(); }

/** Drop thinking blocks so callers that read content[0] as text keep working. */
function stripThinking(resp: any) {
  if (resp && Array.isArray(resp.content)) resp.content = resp.content.filter((b: any) => b?.type !== "thinking" && b?.type !== "redacted_thinking");
  return resp;
}

/** Concatenated text of a response, ignoring thinking and tool blocks. */
export function textOf(resp: { content?: any[] } | null | undefined): string {
  return (resp?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b.text || "").join("");
}

/**
 * Drop-in replacement for client.messages.create(...) that picks the model by tier.
 *   createMessage(anthropic, "standard", { max_tokens: 800, messages: [...], _z: { effort: "low" } })
 */
export async function createMessage(client: Anthropic, tier: Tier, params: any): Promise<Anthropic.Message> {
  const z: ZOpts = params?._z || {};
  const chain = chainFor(tier, z.model);
  let lastErr: any;
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    if (isDead(id) && i < chain.length - 1) continue;      /* known-bad: skip, unless it's our last resort */
    try {
      const resp = await client.messages.create(buildParams(id, params, z));
      return (z.keepThinking ? resp : stripThinking(resp)) as Anthropic.Message;
    } catch (e: any) {
      if (!isModelUnavailable(e)) throw e;                 /* a real error: don't hide it by switching models */
      deadUntil.set(id, Date.now() + DEAD_MS);
      lastErr = e;
      console.error(`[models] ${id} is unavailable (${e?.status ?? "?"}: ${String(e?.message ?? e).slice(0, 160)}). Trying ${chain[i + 1] ?? "nothing else"}. Update the ${ENV_KEY[tier]} env var or lib/models.ts.`);
    }
  }
  throw lastErr;
}
