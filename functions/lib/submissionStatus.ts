import type { Env } from './types';

export type SubmissionDecision = 'approve_submission' | 'reject_submission';

/** Shared by the authenticated admin API and Telegram; approval validation/geocoding lives here once. */
export async function updateSubmissionStatus(env: Env, id: number, decision: SubmissionDecision): Promise<'ok' | 'not_found' | 'geocode_failed' | 'unavailable'> {
  if (!env.DB) return 'unavailable';
  try {
    const row = await env.DB.prepare('SELECT address,district,province,status FROM submissions WHERE id=? LIMIT 1')
      .bind(id).first<{ address: string; district: string; province: string; status: string }>();
    if (!row) return 'not_found';
    if (row.status !== 'pending') return 'unavailable';
    if (decision === 'reject_submission') {
      await env.DB.prepare("UPDATE submissions SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(id).run();
      return 'ok';
    }
    const q = new URL('https://nominatim.openstreetmap.org/search');
    q.searchParams.set('format', 'jsonv2');
    q.searchParams.set('limit', '1');
    q.searchParams.set('countrycodes', 'tr');
    q.searchParams.set('q', `${row.address}, ${row.district}, ${row.province}, Türkiye`);
    const response = await fetch(q, {
      headers: { Accept: 'application/json', 'User-Agent': `YanimdaTurkiye/1.0 (${env.OSM_CONTACT_EMAIL || 'public-web-app'})` },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return 'unavailable';
    const results = await response.json() as Array<{ lat?: unknown; lon?: unknown }>;
    const latitude = Number(results[0]?.lat);
    const longitude = Number(results[0]?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 35 || latitude > 43 || longitude < 25 || longitude > 46) return 'geocode_failed';
    await env.DB.prepare("UPDATE submissions SET status='approved',latitude=?,longitude=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
      .bind(latitude, longitude, id).run();
    return 'ok';
  } catch {
    return 'unavailable';
  }
}
