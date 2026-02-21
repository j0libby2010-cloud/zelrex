import { ZelrexAssumptions } from "./deriveAssumptions";

export function formatAssumptionsForChat(
  assumptions: ZelrexAssumptions
): string {
  return [
    "Assumptions I made to move fast:",
    ...assumptions.goals.map((g) => `• Goal: ${g}`),
    ...assumptions.audience.map((a) => `• Audience: ${a}`),
    ...assumptions.market.map((m) => `• Market: ${m}`),
    "",
    "If any of these are off, tell me and I’ll adjust the site accordingly.",
  ].join("\n");
}
