export type CachePolicyInput = {
  ok: boolean;
  resultCount: number;
  partial?: boolean;
};

export type CachePolicy = {
  cacheControl: string;
  ttlMs: number;
  shouldCache: boolean;
};

/** Shared cache rules for /api/places results and their D1 snapshots. */
export function cachePolicyFor(result: CachePolicyInput): CachePolicy {
  if (!result.ok) {
    return { cacheControl: 'no-store', ttlMs: 0, shouldCache: false };
  }
  if (result.resultCount === 0) {
    return { cacheControl: 'no-store', ttlMs: 60_000, shouldCache: true };
  }
  if (result.partial) {
    return { cacheControl: 'public,max-age=60', ttlMs: 60_000, shouldCache: true };
  }
  return { cacheControl: 'public,max-age=300', ttlMs: 15 * 60_000, shouldCache: true };
}
