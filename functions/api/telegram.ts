import type { Env } from '../lib/types';
import { rateLimited } from '../lib/ratelimit.ts';

type TelegramUpdate = {
  message?: {
    text?: unknown;
    chat?: { id?: number | string; type?: string };
  };
};

const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_CODEPOINTS = 4000;

function allowedAdminIds(env: Env): Set<string> {
  return new Set((env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^-?\d+$/.test(value)));
}

function apiBase(env: Env): string {
  const configured = env.TELEGRAM_API_BASE_URL;
  if (!configured) return TELEGRAM_API;
  try {
    const url = new URL(configured);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password) {
      return url.origin;
    }
  } catch {
    // Ignore invalid test overrides; production always uses the official API.
  }
  return TELEGRAM_API;
}

async function reply(env: Env, chatId: string, message: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    const response = await fetch(`${apiBase(env)}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: Array.from(message).slice(0, MAX_MESSAGE_CODEPOINTS).join(''),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.warn('[telegram] command reply failed');
  } catch {
    // Never log the token, request URL, Telegram response body, or user text.
    console.warn('[telegram] command reply failed');
  }
}

async function getStatus(env: Env): Promise<string> {
  if (!env.DB) return 'Durum alınamadı: veritabanı kullanılamıyor.';
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const [events, pending, reports] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN type='error' THEN 1 ELSE 0 END) AS errors FROM events WHERE created_at>=?",
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
      `• Açık bildirim: ${Number(reports?.total || 0)}`,
    ].join('\n');
  } catch {
    return 'Durum bilgisi alınamadı. Veritabanı tablolarını ve bağlantısını kontrol edin.';
  }
}

const HELP_TEXT = [
  '🤖 Yanımda Türkiye yönetim botu',
  '/durum — Son 24 saat sistem özeti',
  '/yardim — Komut listesini gösterir',
].join('\n');

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const expected = env.TELEGRAM_WEBHOOK_SECRET || '';
  const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!expected || !supplied) return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const encoder = new TextEncoder();
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(expectedHash);
  const b = new Uint8Array(suppliedHash);
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  if (mismatch !== 0) return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });

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
  if (!/^-?\d+$/.test(chat) || !allowedAdminIds(env).has(chat)) return new Response(null, { status: 200 });
  if (message?.chat?.type === 'channel') return new Response(null, { status: 200 });

  const rawText = typeof message?.text === 'string' ? message.text.trim() : '';
  const firstToken = rawText.split(/\s+/, 1)[0];
  if (!firstToken.startsWith('/')) return new Response(null, { status: 200 });
  const command = firstToken.split('@', 1)[0].toLocaleLowerCase('en-US');

  if (command === '/yardim' || command === '/help' || command === '/start') {
    await reply(env, chat, HELP_TEXT);
  } else if (command === '/durum' || command === '/status') {
    await reply(env, chat, await getStatus(env));
  } else {
    await reply(env, chat, 'Bilinmeyen komut. Komut listesi için /yardim yazın.');
  }
  return new Response(null, { status: 200 });
}
