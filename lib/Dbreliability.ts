/**
 * ZELREX DATABASE RELIABILITY HELPERS
 * 
 * Server-side wrappers for Supabase queries that add:
 * - Automatic retry with exponential backoff
 * - Structured error logging
 * - Timeout enforcement
 * - Graceful degradation (returns empty arrays/null instead of throwing)
 * 
 * Usage:
 *   import { getWithFallback } from '@/lib/dbReliability';
 *   const clients = await getWithFallback(
 *     () => supabase.from('clients').select('*'),
 *     []
 *   );
 */

import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

interface QueryResult<T> {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
}

interface SafeQueryOptions {
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
  silent?: boolean; // Don't log errors if true
  context?: string;  // Label for logs
}

/**
 * Run a Supabase query with retry, timeout, and safe error handling.
 * Returns the query result. If all retries fail, returns { data: null, error }.
 */
export async function safeQuery<T>(
  queryFn: () => Promise<QueryResult<T>> | PromiseLike<QueryResult<T>>,
  options: SafeQueryOptions = {}
): Promise<QueryResult<T>> {
  const {
    retries = 2,
    timeoutMs = 15000,
    backoffMs = 500,
    silent = false,
    context = 'query',
  } = options;

  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Race against timeout
      const result = await Promise.race([
        queryFn(),
        new Promise<QueryResult<T>>((_, reject) =>
          setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      // Check if the query returned an error (not a throw, but a PostgrestError)
      if (result.error) {
        // Certain errors shouldn't retry (permission denied, malformed SQL, etc)
        const nonRetryable = [
          'permission denied',
          'not found',
          'duplicate key',
          'invalid input',
          'violates',
        ];
        const errMsg = (result.error.message || '').toLowerCase();
        if (nonRetryable.some(nr => errMsg.includes(nr))) {
          if (!silent) console.warn(`[safeQuery ${context}] Non-retryable error:`, result.error.message);
          return result;
        }

        lastError = result.error;
        if (attempt < retries) {
          const delay = backoffMs * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      return result;
    } catch (err: any) {
      lastError = {
        message: err?.message || 'Unknown error',
        details: '',
        hint: '',
        code: 'TIMEOUT_OR_NETWORK',
        name: 'PostgrestError',
      } as PostgrestError;
      
      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (!silent) {
    console.error(`[safeQuery ${context}] Failed after ${retries + 1} attempts:`, lastError?.message);
  }

  return { data: null, error: lastError };
}

/**
 * Get data with a fallback value. Always returns the fallback on error.
 * Use this when you want guaranteed non-null results.
 */
export async function getWithFallback<T>(
  queryFn: () => Promise<QueryResult<T>> | PromiseLike<QueryResult<T>>,
  fallback: T,
  options: SafeQueryOptions = {}
): Promise<T> {
  const result = await safeQuery(queryFn, options);
  if (result.error || result.data === null) return fallback;
  return result.data;
}

/**
 * Check if Supabase is reachable. Use this in health checks.
 */
export async function isDbHealthy(supabase: SupabaseClient): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    const latencyMs = Date.now() - start;
    return {
      healthy: !result.error,
      latencyMs,
      error: result.error?.message,
    };
  } catch (err: any) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: err?.message || 'Unknown',
    };
  }
}

/**
 * Batched insert with per-row error isolation.
 * If one row fails, the others still succeed.
 * Returns { succeeded: number, failed: Array<{ row, error }> }
 */
export async function safeBatchInsert(
  supabase: SupabaseClient,
  table: string,
  rows: any[],
  options: { batchSize?: number } = {}
): Promise<{ succeeded: number; failed: Array<{ row: any; error: string }> }> {
  const batchSize = options.batchSize || 20;
  let succeeded = 0;
  const failed: Array<{ row: any; error: string }> = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error, data } = await safeQuery(
      () => supabase.from(table).insert(batch).select(),
      { context: `batch-insert-${table}`, retries: 1 }
    );

    if (error) {
      // Fall back to per-row insert to isolate failures
      for (const row of batch) {
        const { error: rowError } = await safeQuery(
          () => supabase.from(table).insert(row),
          { context: `single-insert-${table}`, retries: 1, silent: true }
        );
        if (rowError) {
          failed.push({ row, error: rowError.message });
        } else {
          succeeded++;
        }
      }
    } else {
      succeeded += (data as any[])?.length || batch.length;
    }
  }

  return { succeeded, failed };
}