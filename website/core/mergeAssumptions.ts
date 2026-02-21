import { Assumptions } from "./assumptionsTypes";

/**
 * Merges user overrides into existing assumptions.
 * User input always wins.
 */
export function mergeAssumptions(
  base: Assumptions,
  overrides: Assumptions | null
): Assumptions {
  if (!overrides) return base;

  return {
    goals: overrides.goals.length ? overrides.goals : base.goals,
    audience: overrides.audience.length ? overrides.audience : base.audience,
    market: overrides.market.length ? overrides.market : base.market,
  };
}
