import { SessionState } from "./sessionState";
import { parseAssumptionOverrides } from "./parseAssumptionOverrides";
import { mergeAssumptions } from "./mergeAssumptions";

export interface AssumptionUpdateResult {
  updated: boolean;
  previous: SessionState["assumptions"];
  current: SessionState["assumptions"];
  summary: string[];
}

/**
 * Centralized assumption override handler.
 * Runs on every user message.
 */
export function updateAssumptionsFromMessage(
  message: string,
  sessionState: SessionState
): AssumptionUpdateResult | null {
  if (!sessionState.assumptions) return null;

  const overrides = parseAssumptionOverrides(
    message,
    sessionState.assumptions
  );

  if (!overrides) return null;

  const previous = sessionState.assumptions;

  const current = mergeAssumptions(previous, overrides);

  sessionState.assumptions = current;

  const summary: string[] = [];

  if (
    JSON.stringify(previous.goals) !==
    JSON.stringify(current.goals)
  ) {
    summary.push("Updated primary goal assumptions.");
  }

  if (
    JSON.stringify(previous.audience) !==
    JSON.stringify(current.audience)
  ) {
    summary.push("Updated audience assumptions.");
  }

  if (
    JSON.stringify(previous.market) !==
    JSON.stringify(current.market)
  ) {
    summary.push("Updated market assumptions.");
  }

  return {
    updated: true,
    previous,
    current,
    summary,
  };
}
