import { SessionState } from "./sessionState";

export function getSessionState(messages: any[]): SessionState {
  const last = [...messages].reverse().find(
    (m) => m.role === "assistant" && m.sessionState
  );

  return last?.sessionState ?? {};
}
