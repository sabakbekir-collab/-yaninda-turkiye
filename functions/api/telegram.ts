import type { Env } from '../lib/types';
import { rateLimited } from '../lib/ratelimit.ts';
import { updateSubmissionStatus } from '../lib/submissionStatus.ts';

type TelegramUpdate = { message?: { text?: unknown; chat?: { id?: number | string; type?: string } } };
type Row = Record<string, unknown>;
const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_CODEPOINTS = 4096;
const ADMIN_PANEL_URL = 'https://yaninda-turkiye.sabakbekir.workers.dev/admin';
const REASONS: Record<string, string> = {
  wrong_info: 'Bilgi yanlış', wrong_phone: 'Telefon yanlış', wrong_address: 'Adres yanlış', closed: 'Kapalı',
};

function adminIds(env: Env): string[] {
  return [...new Set((env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').map((v) => v.trim()).filter((v) => /^-?\d+$/.test(v)))];
}
function apiBase(env: Env): string {
  const configured = env.TELEGRAM_API_BASE_URL;
  if (!configured) return TELEGRAM_API;
  try { const url = new URL(configured); if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password) return url.origin; } catch { /* production API only */ }
  return TELEGRAM_API;
}
async function send(env: Env, chatId: string, message: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${apiBase(env)}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: Array.from(message).slice(0, MAX_MESSAGE_CODEPOINTS).join(''), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* Never log token, URL, response body, or message content. */ }
}
async function cacheGet(env: Env, key: string): Promise<{ payload: string; expires_at: string } | null> {
  if (!env.DB) return null;
  return env.DB.prepare('SELECT payload,expires_at FROM api_cache WHERE cache_key=? AND expires_at>? LIMIT 1')
    .bind(key, new Date().toISOString()).first<{ payload: string; expires_at: string }>();
}
async function cachePut(env: Env, key: string, payload: string, ttlMs: number): Promise<void> {
  if (!env.DB) return;
  await env.DB.prepare('INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at')
    .bind(key, payload, new Date(Date.now() + ttlMs).toISOString()).run();
}
async function cacheDelete(env: Env, key: string): Promise<void> {
  await env.DB?.prepare('DELETE FROM api_cache WHERE cache_key=?').bind(key).run();
}
async function hashChat(chat: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chat));
  return Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, '0')).join('');
}
async function audit(env: Env, chat: string, action: string, targetId: number): Promise<void> {
  const chatHash = await hashChat(chat);
  await env.DB?.prepare('INSERT INTO admin_logs(action,target_id,detail,ip) VALUES(?,?,?,NULL)')
    .bind(`telegram_${action}`, targetId, `chat_sha256:${chatHash}`).run();
}
function parseId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
function helpText(): string {
  return [
    '🤖 Yanımda Türkiye yönetim botu',
    '/durum — Son 24 saat sistem özeti',
    '/basvurular — Bekleyen son 10 başvuru',
    '/basvuru <id> — Başvuru özeti',
    '/onayla <id> — Onay isteği oluştur',
    '/reddet <id> <kısa neden> — Ret isteği oluştur',
    '/evet <id> — Bekleyen işlemi onayla',
    '/bildirimler — Açık hatalı bildirimler',
    '/rapor — 24 saat ve 7 günlük rapor',
    '/sessiz <dakika> — Bildirimleri geçici kapat',
    '/ac — Bildirimleri aç',
    '/saglik — Sistem sağlık kontrolü',
    '/yardim — Komut listesi',
  ].join('\n');
}
async function getStatus(env: Env): Promise<string> {
  if (!env.DB) return 'Durum alınamadı: veritabanı kullanılamıyor.';
  try {
    const [events, pending, reports] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN type IN ('error','client_error') THEN 1 ELSE 0 END) AS errors FROM events WHERE created_at>=datetime('now','-24 hours')").first<Row>(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM submissions WHERE status='pending'").first<Row>(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM reports WHERE status='open'").first<Row>(),
    ]);
    return ['📊 Yanımda Türkiye — Son 24 saat', `• Olay sayısı: ${Number(events?.total || 0)}`, `• Hata sayısı: ${Number(events?.errors || 0)}`, `• Bekleyen işletme başvurusu: ${Number(pending?.total || 0)}`, `• Açık hatalı bildirim: ${Number(reports?.total || 0)}`].join('\n');
  } catch { return 'Durum bilgisi alınamadı. Veritabanı bağlantısını kontrol edin.'; }
}
async function listSubmissions(env: Env): Promise<string> {
  const rows = await env.DB!.prepare("SELECT id,name,category,province FROM submissions WHERE status='pending' ORDER BY created_at DESC LIMIT 10").all<Row>();
  if (!rows.results.length) return 'Bekleyen başvuru yok.';
  return ['📝 Bekleyen son başvurular', ...rows.results.map((r) => `#${Number(r.id)} • ${String(r.name || '').slice(0,80)} • ${String(r.category || '').slice(0,40)} • ${String(r.province || '').slice(0,40)}`)].join('\n');
}
async function submission(env: Env, id: number): Promise<string> {
  const row = await env.DB!.prepare('SELECT id,name,category,province,district,status,created_at FROM submissions WHERE id=? LIMIT 1').bind(id).first<Row>();
  if (!row) return 'Başvuru bulunamadı.';
  return [`📝 Başvuru #${id}`, `Ad: ${String(row.name || '').slice(0,100)}`, `Kategori: ${String(row.category || '').slice(0,60)}`, `İl/ilçe: ${String(row.province || '')} / ${String(row.district || '')}`, `Durum: ${String(row.status || '')}`, `Tarih: ${String(row.created_at || '')}`, `Yönetim paneli: ${ADMIN_PANEL_URL}`].join('\n');
}
async function listReports(env: Env): Promise<string> {
  const rows = await env.DB!.prepare("SELECT id,place_name,reason FROM reports WHERE status='open' ORDER BY created_at DESC LIMIT 10").all<Row>();
  if (!rows.results.length) return 'Açık hatalı bildirim yok.';
  return ['⚠️ Açık hatalı bildirimler', ...rows.results.map((r) => `#${Number(r.id)} • ${String(r.place_name || '').slice(0,100)} • ${REASONS[String(r.reason)] || 'Diğer'}`)].join('\n');
}
async function reportPeriod(env: Env, hours: number): Promise<Record<string, number>> {
  const since = hours === 24 ? "-24 hours" : "-7 days";
  const row = await env.DB!.prepare(`SELECT COUNT(*) AS events,
    SUM(CASE WHEN type='search' THEN 1 ELSE 0 END) AS searches,
    SUM(CASE WHEN type='search' AND COALESCE(json_extract(metadata,'$.result_count'),json_extract(metadata,'$.resultCount'),json_extract(metadata,'$.results'),1)=0 THEN 1 ELSE 0 END) AS empty_searches,
    SUM(CASE WHEN type='ad_impression' THEN 1 ELSE 0 END) AS ad_impressions,
    SUM(CASE WHEN type='ad_click' THEN 1 ELSE 0 END) AS ad_clicks,
    SUM(CASE WHEN type='client_error' THEN 1 ELSE 0 END) AS client_errors,
    COUNT(DISTINCT COALESCE(json_extract(metadata,'$.session_id'),json_extract(metadata,'$.sessionId'))) AS sessions
    FROM events WHERE created_at>=datetime('now',?)`).bind(since).first<Row>();
  return Object.fromEntries(['events','sessions','searches','empty_searches','ad_impressions','ad_clicks','client_errors'].map((key) => [key, Number(row?.[key] || 0)]));
}
async function report(env: Env): Promise<string> {
  const [day, week] = await Promise.all([reportPeriod(env, 24), reportPeriod(env, 168)]);
  const format = (title: string, row: Record<string, number>) => [
    title, `Olay: ${row.events} • Tekil oturum: ${row.sessions}`, `Arama: ${row.searches} • Sonuçsuz: ${row.empty_searches}`,
    `Reklam gösterimi: ${row.ad_impressions} • Tıklama: ${row.ad_clicks}`, `İstemci hatası: ${row.client_errors}`,
  ].join('\n');
  return [format('📈 Son 24 saat', day), format('Son 7 gün', week), 'Not: Mevcut olay akışı ölçüm izni ve oturum kimliği alanlarını henüz göndermiyor; bu nedenle onay bazlı kapsam ve tekil oturum sayısı henüz doğrulanamaz.'].join('\n\n');
}
async function health(env: Env): Promise<string> {
  let db = 'kullanılamıyor';
  let lastError = 'kayıt yok';
  try {
    await env.DB!.prepare('SELECT 1 AS ok').first();
    db = 'erişilebilir';
    const row = await env.DB!.prepare("SELECT created_at FROM events WHERE type IN ('error','client_error') ORDER BY created_at DESC LIMIT 1").first<Row>();
    if (row?.created_at) lastError = String(row.created_at);
  } catch { /* keep safe health response */ }
  return ['🩺 Sistem sağlığı', `Veritabanı: ${db}`, `Son deploy commit: ${(env.COMMIT_SHA || 'unknown').slice(0,12)}`, `Son hata zamanı: ${lastError}`].join('\n');
}
async function requestDecision(env: Env, chat: string, id: number, action: 'approve_submission' | 'reject_submission', reason = ''): Promise<string> {
  const key = `telegram:confirm:${await hashChat(chat)}`;
  const payload = JSON.stringify({ id, action, reason, createdAt: Date.now() });
  await cachePut(env, key, payload, 60_000);
  return `Emin misin? 60 saniye içinde /evet ${id} yazarak onayla. Süre dolarsa işlem iptal edilir.`;
}
async function confirmDecision(env: Env, chat: string, id: number): Promise<string> {
  const chatHash = await hashChat(chat);
  const pendingKey = `telegram:confirm:${chatHash}`;
  const pending = await cacheGet(env, pendingKey);
  if (!pending) return 'Onay isteği yok veya süresi dolmuş. Yeniden /onayla ya da /reddet kullan.';
  let value: { id?: number; action?: string; reason?: string; createdAt?: number };
  try { value = JSON.parse(pending.payload) as typeof value; } catch { await cacheDelete(env, pendingKey); return 'Onay isteği geçersiz. Yeniden deneyin.'; }
  if (value.id !== id || Date.now() - Number(value.createdAt || 0) > 60_000) return 'Onay isteği bulunamadı veya süresi dolmuş.';
  const doneKey = `telegram:done:${chatHash}:${id}`;
  const reservation = await env.DB!.prepare('INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO NOTHING')
    .bind(doneKey, '1', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()).run() as { meta?: { changes?: number } };
  if (Number(reservation.meta?.changes || 0) !== 1) return 'Bu onay zaten işlenmiş.';
  const action = value.action === 'approve_submission' ? 'approve_submission' : value.action === 'reject_submission' ? 'reject_submission' : '';
  if (!action) { await cacheDelete(env, pendingKey); return 'İşlem türü geçersiz.'; }
  const result = await updateSubmissionStatus(env, id, action);
  await cacheDelete(env, pendingKey);
  if (result !== 'ok') {
    await cacheDelete(env, doneKey);
    if (result === 'not_found') return 'Başvuru bulunamadı.';
    if (result === 'geocode_failed') return 'Adres doğrulanamadı; başvuru onaylanmadı.';
    return 'Başvuru güncellenemedi veya artık beklemede değil.';
  }
  await audit(env, chat, action, id);
  return action === 'approve_submission' ? `Başvuru #${id} onaylandı.` : `Başvuru #${id} reddedildi. Neden: ${String(value.reason || 'Belirtilmedi').slice(0,100)}`;
}
export async function sendAdminMessage(env: Env, message: string, throttleKey?: string): Promise<void> {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) return;
  try {
    const silence = await cacheGet(env, 'telegram:notifications:silence');
    if (silence) return;
    if (throttleKey) {
      const row = await env.DB.prepare('INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO NOTHING')
        .bind(`telegram:notify:${throttleKey}`, '1', new Date(Date.now() + 10 * 60_000).toISOString()).run() as { meta?: { changes?: number } };
      if (Number(row.meta?.changes || 0) !== 1) return;
    }
    await Promise.all(adminIds(env).map((id) => send(env, id, message)));
  } catch { /* notifications are best-effort and never log private data */ }
}
export async function sendDailyTelegramReport(env: Env): Promise<void> {
  if (!env.DB) return;
  const day = new Date(Date.now() + 3 * 60 * 60_000).toISOString().slice(0,10);
  const key = `telegram:daily:${day}`;
  try {
    const reserved = await env.DB.prepare('INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO NOTHING')
      .bind(key, 'sent', new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString()).run() as { meta?: { changes?: number } };
    if (Number(reserved.meta?.changes || 0) !== 1) return;
    const summary = await report(env);
    await sendAdminMessage(env, `☀️ Günlük Yanımda Türkiye özeti\n\n${summary}`, `daily-${day}`);
  } catch { /* cron is best-effort */ }
}
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const expected = env.TELEGRAM_WEBHOOK_SECRET || '';
  const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!expected || !supplied) return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(expected)), crypto.subtle.digest('SHA-256', encoder.encode(supplied))]);
  const a = new Uint8Array(aHash); const b = new Uint8Array(bHash); let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  if (mismatch !== 0) return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  if (await rateLimited(env, request, 'telegram-webhook', 60, 60)) return new Response(null, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
  let update: TelegramUpdate;
  try { update = await request.json() as TelegramUpdate; } catch { return new Response(null, { status: 200 }); }
  const message = update.message; const chatId = message?.chat?.id;
  if (chatId === undefined || chatId === null || message?.chat?.type !== 'private') return new Response(null, { status: 200 });
  const chat = String(chatId);
  if (!/^-?\d+$/.test(chat) || !adminIds(env).includes(chat)) return new Response(null, { status: 200 });
  const raw = typeof message.text === 'string' ? message.text.trim() : '';
  if (raw.length > 4096) { await send(env, chat, 'Komut 4096 karakter sınırını aşıyor.'); return new Response(null, { status: 200 }); }
  const [token, ...args] = raw.split(/\s+/);
  const command = (token || '').split('@',1)[0].toLocaleLowerCase('tr-TR');
  try {
    let response = '';
    if (command === '/start' || command === '/yardim') response = helpText();
    else if (command === '/durum') response = await getStatus(env);
    else if (command === '/basvurular') response = await listSubmissions(env);
    else if (command === '/basvuru') { const id = parseId(args[0]); response = id ? await submission(env,id) : 'Kullanım: /basvuru <pozitif_id>'; }
    else if (command === '/onayla') { const id = parseId(args[0]); response = id ? await requestDecision(env,chat,id,'approve_submission') : 'Kullanım: /onayla <pozitif_id>'; }
    else if (command === '/reddet') { const id = parseId(args[0]); const reason = args.slice(1).join(' ').trim().slice(0,100); response = id && reason ? await requestDecision(env,chat,id,'reject_submission',reason) : 'Kullanım: /reddet <pozitif_id> <kısa_neden>'; }
    else if (command === '/evet') { const id = parseId(args[0]); response = id ? await confirmDecision(env,chat,id) : 'Kullanım: /evet <pozitif_id>'; }
    else if (command === '/bildirimler') response = await listReports(env);
    else if (command === '/rapor') response = await report(env);
    else if (command === '/sessiz') {
      const minutes = Number(args[0]);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) response = 'Kullanım: /sessiz <1-1440 dakika>';
      else { await cachePut(env,'telegram:notifications:silence',String(Date.now()+minutes*60_000),Math.min(minutes,1440)*60_000); response = `Bildirimler ${minutes} dakika susturuldu.`; }
    }
    else if (command === '/ac') { await cacheDelete(env,'telegram:notifications:silence'); response = 'Bildirimler yeniden açıldı.'; }
    else if (command === '/saglik') response = await health(env);
    else response = 'Bilinmeyen komut. Komut listesi için /yardim yazın.';
    await send(env,chat,response);
  } catch {
    await send(env,chat,'İşlem tamamlanamadı. Veritabanı veya sistem durumunu kontrol edin.');
  }
  return new Response(null, { status: 200 });
}
