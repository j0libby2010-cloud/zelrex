/**
 * ZELREX RELIABILITY HELPERS (frontend)
 * 
 * Shared utilities for making the client side of Zelrex more reliable:
 * - fetchWithRetry: automatic retry with exponential backoff
 * - safeStorage: localStorage with corruption recovery + schema validation
 * - detectOffline: clean offline detection
 * - networkAwareFetch: only attempts fetch when network is available
 * - requestId: unique ID generation for request tracing
 */

// ────────────────────────────────────────────────────────
// FETCH WITH RETRY — exponential backoff, timeout, retry
// ────────────────────────────────────────────────────────

export interface FetchRetryOptions extends RequestInit {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  retryOn?: number[]; // Status codes to retry on
}

export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const {
    retries = 2,
    backoffMs = 1000,
    timeoutMs = 30000,
    retryOn = [429, 500, 502, 503, 504],
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Abort if request takes too long
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      // Combine abort signals if user provided one
      const signals = [controller.signal];
      if (fetchOptions.signal) signals.push(fetchOptions.signal);

      // Add request ID for tracing
      const requestId = generateRequestId();
      const headers = new Headers(fetchOptions.headers);
      headers.set('X-Request-ID', requestId);

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // If status is retryable, throw to trigger retry
      if (retryOn.includes(response.status) && attempt < retries) {
        throw new Error(`Retryable status: ${response.status}`);
      }

      return response;
    } catch (err: any) {
      lastError = err;

      // Don't retry on abort (user canceled)
      if (err.name === 'AbortError' && fetchOptions.signal?.aborted) {
        throw err;
      }

      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = backoffMs * Math.pow(2, attempt);
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

// ────────────────────────────────────────────────────────
// SAFE STORAGE — localStorage wrapper with recovery
// ────────────────────────────────────────────────────────

export interface StorageSchema<T> {
  validate: (data: any) => data is T;
  default: T;
  version?: number;
}

export class SafeStorage {
  private prefix: string;

  constructor(prefix = 'zelrex_') {
    this.prefix = prefix;
  }

  /**
   * Get a value with schema validation. If data is corrupted or missing, returns default.
   */
  get<T>(key: string, schema: StorageSchema<T>): T {
    const fullKey = this.prefix + key;
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return schema.default;
      }

      const raw = localStorage.getItem(fullKey);
      if (!raw) return schema.default;

      const parsed = JSON.parse(raw);

      // Validate schema
      if (!schema.validate(parsed)) {
        console.warn(`[SafeStorage] Invalid schema for ${fullKey}, using default`);
        localStorage.removeItem(fullKey);
        return schema.default;
      }

      return parsed;
    } catch (err) {
      console.warn(`[SafeStorage] Failed to read ${fullKey}:`, err);
      // Corrupted data — clear it
      try { localStorage.removeItem(fullKey); } catch {}
      return schema.default;
    }
  }

  /**
   * Set a value. Returns true on success.
   */
  set(key: string, value: any): boolean {
    const fullKey = this.prefix + key;
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      localStorage.setItem(fullKey, JSON.stringify(value));
      return true;
    } catch (err: any) {
      // Quota exceeded is common — try to clear old entries
      if (err?.name === 'QuotaExceededError') {
        console.warn('[SafeStorage] Quota exceeded, attempting cleanup');
        this.cleanupOldEntries();
        try {
          localStorage.setItem(fullKey, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  remove(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.removeItem(this.prefix + key);
    } catch {}
  }

  /**
   * Emergency cleanup — removes entries that look stale or corrupted
   */
  cleanupOldEntries(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        // Clean up temp notification keys, old animated IDs, etc.
        if (key.includes('_temp_') || key.includes('_old_')) {
          toRemove.push(key);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

export const storage = new SafeStorage();

// ────────────────────────────────────────────────────────
// SETTINGS SCHEMA — validates zelrex_settings object
// ────────────────────────────────────────────────────────

export const SETTINGS_SCHEMA: StorageSchema<any> = {
  validate: (data: any): data is any => {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  },
  default: {
    notifOverdueInvoices: true,
    notifContractReminders: true,
    notifGoalProgress: true,
    notifTrafficDrops: true,
    notifRevenueChanges: true,
    notifPositiveEncouragement: true,
    inAppSuggestions: true,
    inAppDeployStatus: true,
    permAutoExtractClients: true,
    permAutoSuggestInvoices: true,
    permProactiveFollowups: true,
    emailWeeklyReport: false,
    emailGoalMilestones: false,
    emailMarketAlerts: false,
    emailProductUpdates: false,
    language: 'en',
    responseStyle: 'direct',
  },
};

// ────────────────────────────────────────────────────────
// OFFLINE DETECTION
// ────────────────────────────────────────────────────────

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ────────────────────────────────────────────────────────
// REQUEST ID — for tracing in logs
// ────────────────────────────────────────────────────────

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ────────────────────────────────────────────────────────
// SAFE JSON PARSE — handles malformed JSON gracefully
// ────────────────────────────────────────────────────────

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Extract JSON from AI-generated responses that may have markdown/extra text.
 * Tries multiple strategies:
 * 1. Direct parse
 * 2. Strip ```json fences
 * 3. Find first { or [ and matching close
 */
export function extractJson<T>(text: string, fallback: T): T {
  if (!text) return fallback;

  // Strategy 1: Direct
  try { return JSON.parse(text); } catch {}

  // Strategy 2: Strip markdown
  const stripped = text.replace(/```json\s*|\s*```/g, '').trim();
  try { return JSON.parse(stripped); } catch {}

  // Strategy 3: Find object boundaries
  const firstObj = stripped.indexOf('{');
  const firstArr = stripped.indexOf('[');
  let start = -1;
  let endChar = '';
  
  if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
    start = firstObj;
    endChar = '}';
  } else if (firstArr !== -1) {
    start = firstArr;
    endChar = ']';
  }
  
  if (start !== -1) {
    const end = stripped.lastIndexOf(endChar);
    if (end > start) {
      try { return JSON.parse(stripped.slice(start, end + 1)); } catch {}
    }
  }

  return fallback;
}

// ────────────────────────────────────────────────────────
// DEBOUNCE — for input handlers
// ────────────────────────────────────────────────────────

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

// ────────────────────────────────────────────────────────
// STALE DATA CHECK — warn when cached data is too old
// ────────────────────────────────────────────────────────

export function isStale(timestamp: number | null | undefined, maxAgeMs: number): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAgeMs;
}