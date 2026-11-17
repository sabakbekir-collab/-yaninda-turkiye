import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, sendAdminMessage, sendDailyTelegramReport } from '../functions/api/telegram.ts';

function harness() {
  const cache = new Map();
  const logs = [];
  const submissions = [{ id: 7, name: 'Deneme İşletmesi', category: 'market', province: 'Muş', district: 'Merkez', address: 'GİZLİ ADRES', phone: '5550000000', description: 'GİZLİ AÇIKLAMA', status: 'pending', created_at: '2026-11-18 00:00:00' }];
  const reports = [{ id: 9, place_name: 'Deneme Market', reason: 'wrong_phone', details: 'GİZLİ SERBEST METİN', status: 'open' }];
  const sent = [];
  const DB = { prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() {
        if (sql.includes('SELECT payload,expires_at FROM api_cache')) {
          const row = cache.get(values[0]);
          return row && row.expires_at > values[1] ? row : null;
        }
        if (sql.includes('SELECT payload FROM api_cache')) return cache.has(values[0]) ? { payload: cache.get(values[0]).payload } : null;
        if (sql.includes('FROM submissions WHERE id=?')) return submissions.find((x) => x.id === values[0]) || null;
        if (sql.includes('FROM submissions')) return { total: submissions.filter((x) => x.status === 'pending').length };
        if (sql.includes('FROM reports')) return { total: reports.filter((x) => x.status === 'open').length };
        if (sql.includes('SUM(CASE WHEN type')) return { total: 12, errors: 2 };
        if (sql.includes('COUNT(DISTINCT')) return { events: 12, sessions: 4, searches: 3, empty_searches: 1, ad_impressions: 2, ad_clicks: 1, client_errors: 2 };
        if (sql.includes('SELECT created_at FROM events')) return { created_at: '2026-11-18 00:00:00' };
        if (sql.includes('SELECT 1 AS ok')) return { ok: 1 };
        return null;
      },
      async all() {
        if (sql.includes('FROM submissions')) return { results: submissions.filter((x) => x.status === 'pending').slice(0, 10) };
        if (sql.includes('FROM reports')) return { results: reports.filter((x) => x.status === 'open').slice(0, 10) };
        return { results: [] };
      },
      async run() {
        if (sql.includes('INSERT INTO api_cache')) {
          const [key, payload, expires] = values;
          if (sql.includes('DO NOTHING') && cache.has(key)) return { meta: { changes: 0 } };
          if (sql.includes('payload=CAST')) {
            const previous = Number(cache.get(key)?.payload || 0);
            cache.set(key, { payload: String(previous + 1), expires_at: expires });
          } else cache.set(key, { payload, expires_at: expires });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('DELETE FROM api_cache')) { cache.delete(values[0]); return { meta: { changes: 1 } }; }
        if (sql.includes('INSERT INTO admin_logs')) { logs.push(values); return { meta: { changes: 1 } }; }
        if (sql.includes("UPDATE submissions SET status='approved'")) {
          const row = submissions.find((x) => x.id === values[2] && x.status === 'pending');
          if (row) row.status = 'approved';
          return { meta: { changes: row ? 1 : 0 } };
        }
        if (sql.includes("UPDATE submissions SET status='rejected'")) {
          const row = submissions.find((x) => x.id === values[0] && x.status === 'pending');
          if (row) row.status = 'rejected';
          return { meta: { changes: row ? 1 : 0 } };
        }
        return { meta: { changes: 1 } };
      },
    };
  } };
  const env = { DB, TELEGRAM_BOT_TOKEN: 'fake-token', TELEGRAM_WEBHOOK_SECRET: 'fake-secret', TELEGRAM_ADMIN_CHAT_IDS: '12345', COMMIT_SHA: 'abcdef0123456789' };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('nominatim.openstreetmap.org')) return Response.json([{ lat: '38.73', lon: '41.49' }]);
    sent.push(JSON.parse(init.body || '{}'));
    return Response.json({ ok: true });
  };
  return {
    env, cache, logs, submissions, reports, sent,
    restore() { globalThis.fetch = previousFetch; },
  };
}
function req(text, chat = { id: 12345, type: 'private' }, secret = 'fake-secret') {
  return new Request('https://worker.test/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify({ message: { chat, text } }) });
}
async function command(ctx, text, chat) {
  return onRequestPost({ request: req(text, chat), env: ctx.env });
}
function lastText(ctx) { return ctx.sent.at(-1)?.text || ''; }

test('unauthorized private chat and group chats are silently ignored', async () => {
  const c = harness();
  try {
    await command(c, '/yardim', { id: 888, type: 'private' });
    await command(c, '/yardim', { id: -100, type: 'supergroup' });
    assert.equal(c.sent.length, 0);
  } finally { c.restore(); }
});

test('all read commands respond and omit personal/free-text data', async () => {
  const c = harness();
  try {
    for (const text of ['/start', '/yardim', '/durum', '/basvurular', '/basvuru 7', '/bildirimler', '/rapor', '/saglik']) {
      const response = await command(c, text);
      assert.equal(response.status, 200, text);
    }
    assert.match(c.sent[0].text, /\/basvurular/);
    assert.match(c.sent[2].text, /Son 24 saat/);
    assert.match(c.sent[3].text, /Deneme İşletmesi/);
    assert.match(c.sent[4].text, /Yönetim paneli/);
    assert.match(c.sent[5].text, /Bilgi yanlış/);
    assert.match(c.sent[6].text, /Son 7 gün/);
    assert.match(c.sent[7].text, /abcdef012345/);
    const combined = c.sent.map((x) => x.text).join('\n');
    for (const privateValue of ['GİZLİ ADRES', '5550000000', 'GİZLİ AÇIKLAMA', 'GİZLİ SERBEST METİN']) assert.equal(combined.includes(privateValue), false);
  } finally { c.restore(); }
});

test('invalid IDs and command arguments are rejected', async () => {
  const c = harness();
  try {
    await command(c, '/basvuru 0');
    assert.match(lastText(c), /pozitif_id/);
    await command(c, '/onayla -7');
    assert.match(lastText(c), /pozitif_id/);
    await command(c, '/reddet 7');
    assert.match(lastText(c), /kısa_neden/);
  } finally { c.restore(); }
});

test('approval requires confirmation and is idempotent', async () => {
  const c = harness();
  try {
    await command(c, '/onayla 7');
    assert.match(lastText(c), /Emin misin/);
    await command(c, '/evet 7');
    assert.match(lastText(c), /onaylandı/);
    assert.equal(c.submissions[0].status, 'approved');
    assert.equal(c.logs.length, 1);
    assert.equal(c.logs[0][0], 'telegram_approve_submission');
    assert.match(c.logs[0][2], /^chat_sha256:/);
    await command(c, '/evet 7');
    assert.equal(c.logs.length, 1);
  } finally { c.restore(); }
});

test('rejection requires confirmation and updates status with hashed chat audit', async () => {
  const c = harness();
  try {
    await command(c, '/reddet 7 yinelenen kayıt');
    await command(c, '/evet 7');
    assert.equal(c.submissions[0].status, 'rejected');
    assert.equal(c.logs.length, 1);
    assert.equal(c.logs[0][0], 'telegram_reject_submission');
    assert.match(c.logs[0][2], /^chat_sha256:/);
  } finally { c.restore(); }
});

test('expired confirmation cannot mutate a submission', async () => {
  const c = harness();
  try {
    await command(c, '/onayla 7');
    const key = [...c.cache.keys()].find((x) => x.startsWith('telegram:confirm:'));
    c.cache.get(key).expires_at = '2000-01-01T00:00:00.000Z';
    await command(c, '/evet 7');
    assert.equal(c.submissions[0].status, 'pending');
    assert.equal(c.logs.length, 0);
  } finally { c.restore(); }
});

test('silence suppresses notifications and /ac reopens them', async () => {
  const c = harness();
  try {
    await command(c, '/sessiz 5');
    const count = c.sent.length;
    await sendAdminMessage(c.env, 'test notification', 'test-silence');
    assert.equal(c.sent.length, count);
    await command(c, '/ac');
    await sendAdminMessage(c.env, 'test notification', 'test-open');
    assert.equal(c.sent.length, count + 2); // command reply plus notification
  } finally { c.restore(); }
});

test('daily summary is sent only once per Istanbul day', async () => {
  const c = harness();
  try {
    await sendDailyTelegramReport(c.env);
    const count = c.sent.length;
    await sendDailyTelegramReport(c.env);
    assert.equal(c.sent.length, count);
    assert.equal(count, 1);
  } finally { c.restore(); }
});

test('4096 character command boundary is enforced', async () => {
  const c = harness();
  try {
    await command(c, '/yardim ' + 'x'.repeat(4096));
    assert.match(lastText(c), /4096/);
    assert.ok([...lastText(c)].length <= 4096);
  } finally { c.restore(); }
});
