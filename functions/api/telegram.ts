import type { Env } from '../lib/types';
import { rateLimited } from '../lib/ratelimit.ts';

type TelegramUpdate = {
  message?: {
    text?: unknown;
    chat?: { id?: number | string; type?: string };
  };
};

const API = 'https://api.telegram.org';
const TELEGRAM_MAX_MESSAGE_CODEPOINTS = 4000;

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  // SHA-256 always yields the same length, so the comparison loop has a
  // fixed number of iterations regardless of the supplied secret length.
  let mismatch = 0;
  for (let index = 0; index < x.length; index += 1) mismatch |= x[index] ^ y[index];
  return mismatch === 0;
}

export function telegramApiBase(env: Env): string {
  const configured = env.TELEGRAM_API_BASE_URL;
  if (!configured) return API;
  try {
    const candidate = new URL(configured);
    const isLocalHost = candidate.protocol === 'http:' &&
      (candidate.hostname === '127.0.0.1' || candidate.hostname === 'localhost') &&
      !candidate.username && !candidate.password;
    return isLocalHost ? candidate.origin : API;
  } catch {
    return API;
  }
}

function adminIds(env: Env): Set<string> {
  return new Set((env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',').map((value) => value.trim()).filter((value) => /^-?\d+$/.test(value)));
}

function boundedTelegramText(value: string): string {
  return Array.from(value).slice(0, TELEGRAM_MAX_MESSAGE_CODEPOINTS).join('');
}

async function telegramReply(env: Env, chatId: string, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    const apiBase = telegramApiBase(env);
    const response = await fetch(`${apiBase}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: boundedTelegramText(text), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('telegram_send_failed');
  } catch {
    // Never log the request URL, token, response body, or user-provided text.
    console.warn('[telegram] command reply failed');
  }
}

async function statusText(env: Env): Promise<string> {
  if (!env.DB) return 'Durum alınamadı: veritabanı kullanılamıyor.';
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [events, pending, reports] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN event='error' OR type='error' THEN 1 ELSE 0 END) AS errors FROM events WHERE COALESCE(ts,created_at)>=?",
    ).bind(since).first<{ total: number; errors: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM submissions WHERE status='pending'")
      .first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM reports WHERE status='open'")
      .first<{ total: number }>(),
  ]);
  return [
    '📊 Yanımda Türkiye — Son 24 saat',
    `• Olay sayısı: ${Number(events?.total || 0)}`,
    `• Hata sayısı: ${Number(events?.errors || 0)}`,
    `• Bekleyen işletme başvurusu: ${Number(pending?.total || 0)}`,
    `• Hatalı bildirim: ${Number(reports?.total || 0)}`,
  ].join('\n');
}

const HELP_TEXT = '🤖 Yanımda Türkiye yönetim botu\n/durum — Son 24 saat özeti\n/yardim — Komut listesi';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const expected = env.TELEGRAM_WEBHOOK_SECRET || '';
  const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!expected || !supplied || !(await constantTimeEqual(supplied, expected))) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (await rateLimited(env, request, 'telegram-webhook', 60, 60)) {
    return new Response(null, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return new Response(null, { status: 200 });
  }
  const message = update.message;
  const chatId = message?.chat?.id;
  if (chatId === undefined || chatId === null) return new Response(null, { status: 200 });
  const chat = String(chatId);
  if (!/^-?\d+$/.test(chat) || !adminIds(env).has(chat)) return new Response(null, { status: 200 });

  // Group and supergroup chats are accepted only when their chat ID is
  // explicitly allowlisted in TELEGRAM_ADMIN_CHAT_IDS. Channel posts are ignored.
  const chatType = message?.chat?.type;
  if (chatType === 'channel') return new Response(null, { status: 200 });

  const rawText = typeof message?.text === 'string' ? message.text.trim() : '';
  if (!rawText) return new Response(null, { status: 200 });

  const firstToken = rawText.split(/\s+/, 1)[0];
  // Ignore ordinary conversation text; only slash commands are actionable.
  if (!firstToken.startsWith('/')) return new Response(null, { status: 200 });
  const command = firstToken.split('@', 1)[0].toLocaleLowerCase('en-US');

  try {
    if (command === '/durum') {
      await telegramReply(env, chat, await statusText(env));
    } else if (command === '/yardim') {
      await telegramReply(env, chat, HELP_TEXT);
    } else {
      await telegramReply(env, chat, 'Bilinmeyen komut. Kullanılabilir komutlar için /yardim yazın.');
    }
  } catch {
    console.warn('[telegram] command processing failed');
  }
  return new Response(null, { status: 200 });
}
