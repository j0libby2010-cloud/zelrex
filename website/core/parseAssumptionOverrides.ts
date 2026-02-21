import { Assumptions } from "./assumptionsTypes";

/**
 * Parses plain-English user input and extracts assumption overrides.
 * Deterministic, conservative, and explicit.
 */
export function parseAssumptionOverrides(
  message: string,
  current: Assumptions
): Assumptions | null {
  const next: Assumptions = {
    goals: [...current.goals],
    audience: [...current.audience],
    market: [...current.market],
  };

  const lower = message.toLowerCase();

  let changed = false;

  // ---- Goal overrides ----
  if (lower.includes("get clients") || lower.includes("leads")) {
    next.goals = ["Primary goal is to generate leads quickly."];
    changed = true;
  }

  if (lower.includes("make money") || lower.includes("revenue")) {
    next.goals = ["Primary goal is to generate revenue as quickly as possible."];
    changed = true;
  }

  if (lower.includes("credibility") || lower.includes("look professional")) {
    next.goals = ["Primary goal is to establish credibility and trust."];
    changed = true;
  }

  // ---- Audience overrides ----
  if (lower.includes("technical") || lower.includes("developers")) {
    next.audience = ["Audience is technical and detail-oriented."];
    changed = true;
  }

  if (lower.includes("non-technical") || lower.includes("beginners")) {
    next.audience = ["Audience is non-technical and needs simple explanations."];
    changed = true;
  }

  // ---- Market overrides ----
  if (lower.includes("luxury")) {
    next.market = ["Market expects premium positioning and restraint."];
    changed = true;
  }

  if (lower.includes("competitive")) {
    next.market = ["Market is highly competitive and crowded."];
    changed = true;
  }

  return changed ? next : null;
}
