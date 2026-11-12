import type { Env } from './types';

const TELEGRAM_API = 'https://api.telegram.org';

function adminChatIds(env: Env): string[] {
  return (env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^-?\d+$/.test(value));
}

/** Send a privacy-safe operational message; notification failures never escape. */
export async function sendAdminMessage(env: Env, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatIds = adminChatIds(env);
  if (!chatIds.length) return;

  const message = [...text].filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }).join('').slice(0, 3500);
  try {
    await Promise.all(chatIds.map(async (chatId) => {
      const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('telegram_send_failed');
    }));
  } catch {
    // Never log request URLs, response bodies, or credentials.
    console.warn('[telegram] admin notification failed');
  }
}

/**
 * Alert after repeated client-side error events. Fingerprints are one-way
 * hashes of a bounded error code, never user text, IP, or session data.
 */
export async function notifyRepeatedClientError(env: Env, errorCode: unknown): Promise<void> {
  if (!env.DB) return;
  const code = typeof errorCode === 'string' && /^[a-zA-Z0-9_.-]{1,40}$/.test(errorCode)
    ? errorCode
    : 'unspecified';
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const now = Date.now();
    const bucket = Math.floor(now / 600000);
    const countKey = `telegram:error-count:${fingerprint}:${bucket}`;
    const cooldownKey = `telegram:error-alert:${fingerprint}`;
    const expires = new Date((bucket + 1) * 600000 + 3600000).toISOString();
    await env.DB.prepare(
      'INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=CAST(CAST(api_cache.payload AS INTEGER)+1 AS TEXT),expires_at=excluded.expires_at',
    ).bind(countKey, '1', expires).run();
    const row = await env.DB.prepare('SELECT payload FROM api_cache WHERE cache_key=? LIMIT 1')
      .bind(countKey).first<{ payload: string }>();
    if (Number(row?.payload) < 5) return;
    const existing = await env.DB.prepare('SELECT 1 FROM api_cache WHERE cache_key=? AND expires_at>? LIMIT 1')
      .bind(cooldownKey, new Date(now).toISOString()).first<Record<string, unknown>>();
    if (existing) return;
    await env.DB.prepare('INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at')
      .bind(cooldownKey, '1', new Date(now + 3600000).toISOString()).run();
    await sendAdminMessage(env, '⚠️ Yanımda Türkiye: Aynı istemci hata kodu kısa sürede 5 kez tekrarlandı. Yönetim panelinden hata kayıtlarını kontrol edin.');
  } catch {
    console.warn('[telegram] repeated-error alert preparation failed');
  }
}
