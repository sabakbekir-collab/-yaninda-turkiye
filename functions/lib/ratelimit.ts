import type { Env } from './types';

/**
 * Cloudflare supplies CF-Connecting-IP at the edge. Do not trust arbitrary
 * forwarding headers when that trusted header is absent.
 */
export function clientIp(request: Request): string {
  const cfIp = request.headers.get('CF-Connecting-IP')?.trim();
  if (cfIp) return cfIp;
  return 'unknown';
}

/**
 * Returns true when the request must be blocked.
 *
 * Security policy: fail closed. If D1 is missing or unavailable, protected
 * endpoints must not silently lose their rate limit. Cleanup is best-effort
 * and must never turn an otherwise successful check into a denial.
 */
export async function rateLimited(
  env: Env,
  request: Request,
  name: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  if (!env.DB || !Number.isFinite(limit) || limit < 1 || !Number.isFinite(windowSec) || windowSec < 1) {
    return true;
  }

  try {
    const now = Date.now();
    const bucket = Math.floor(now / (windowSec * 1000));
    const rawIp=clientIp(request);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode((env.ADMIN_SESSION_SECRET||'rate-limit')+':'+rawIp));
    const ipKey=[...new Uint8Array(digest)].map((b)=>b.toString(16).padStart(2,'0')).join('');
    const key = `rl:${name}:${ipKey}:${bucket}`;
    const expires = new Date((bucket + 1) * windowSec * 1000 + 60_000).toISOString();

    await env.DB.prepare(
      'INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ' +
      'ON CONFLICT(cache_key) DO UPDATE SET ' +
      'payload=CAST(CAST(api_cache.payload AS INTEGER)+1 AS TEXT), expires_at=excluded.expires_at',
    ).bind(key, '1', expires).run();

    const row = await env.DB.prepare(
      'SELECT payload FROM api_cache WHERE cache_key=? LIMIT 1',
    ).bind(key).first<{ payload: string }>();

    // A missing or malformed counter is not permission to bypass protection.
    const count = Number(row?.payload);
    if (!Number.isFinite(count) || count < 1) return true;

    // Opportunistic cleanup; failure here does not affect the security check.
    if (Math.random() < 0.02) {
      try {
        await env.DB.prepare('DELETE FROM api_cache WHERE expires_at<?')
          .bind(new Date(now).toISOString()).run();
      } catch {
        // Expired rows are harmless and will be cleaned up by a later request.
      }
    }

    return count > limit;
  } catch {
    return true;
  }
}
