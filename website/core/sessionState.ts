export interface SessionState {
  // Explicit user-provided facts
  goals?: string[];
  constraints?: string[];
  preferences?: string[];

  // Assumptions (can be overridden)
  assumptions?: {
    goals: string[];
    audience: string[];
    market: string[];
  };

  // Decisions already made
  decisions?: {
    theme?: string;
    branding?: any;
    websiteId?: string;
  };

  // Conversation bookkeeping
  clarified?: string[];
}
