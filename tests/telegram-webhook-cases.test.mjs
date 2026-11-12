import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/telegram.ts';
import { sendAdminMessage } from '../functions/lib/telegram.ts';

function makeEnv({ adminIds = '12345', limit = 60 } = {}) {
  const sends = [];
  const counters = new Map();
  const leases = new Map();
  const env = {
    TELEGRAM_WEBHOOK_SECRET: 'fake-webhook-secret',
    TELEGRAM_BOT_TOKEN: 'fake-bot-token',
    TELEGRAM_ADMIN_CHAT_IDS: adminIds,
    DB: {
      prepare(sql) {
        let values = [];
        return {
          bind(...next) { values = next; return this; },
          async run() {
            if (sql.startsWith('INSERT INTO api_cache')) {
              const key = values[0];
              if (String(key).startsWith('rl:')) counters.set(key, (counters.get(key) || 0) + 1);
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            if (sql.includes('SUM(CASE')) return { total: 17, errors: 2 };
            if (sql.includes('FROM submissions')) return { total: 3 };
            if (sql.includes('FROM reports')) return { total: 4 };
            if (sql.includes('SELECT payload FROM api_cache')) return { payload: String(counters.get(values[0]) || 1) };
            if (sql.includes('SELECT 1 FROM api_cache')) return leases.has(values[0]) ? { ok: 1 } : null;
            return null;
          },
          async all() { return { results: [] }; },
        };
      },
    },
  };
  return { env, sends, counters, leases, limit };
}

function makeRequest({ secret = 'fake-webhook-secret', includeSecret = true, body, chatIp = '203.0.113.8' }) {
  const headers = { 'content-type': 'application/json', 'CF-Connecting-IP': chatIp };
  if (includeSecret) headers['X-Telegram-Bot-Api-Secret-Token'] = secret;
  return new Request('https://example.test/api/telegram', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

async function withTelegramMock(fn) {
  const previousFetch = globalThis.fetch;
  const sends = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url).startsWith('https://api.telegram.org/botfake-bot-token/sendMessage'), true);
    sends.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: { message_id: sends.length } }), { status: 200 });
  };
  try { await fn(sends); } finally { globalThis.fetch = previousFetch; }
}

test('missing and incorrect webhook secrets return 401', async () => {
  const { env } = makeEnv();
  const body = { message: { text: '/yardim', chat: { id: 12345, type: 'private' } } };
  assert.equal((await onRequestPost({ request: makeRequest({ includeSecret: false, body }), env })).status, 401);
  assert.equal((await onRequestPost({ request: makeRequest({ secret: 'wrong', body }), env })).status, 401);
});

test('unauthorized chat is silently acknowledged without a Telegram reply', async () => {
  const { env } = makeEnv();
  await withTelegramMock(async (sends) => {
    const response = await onRequestPost({
      request: makeRequest({ body: { message: { text: '/yardim', chat: { id: 99999, type: 'private' } } }),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(sends.length, 0);
  });
});

test('/yardim returns short Turkish help text', async () => {
  const { env } = makeEnv();
  await withTelegramMock(async (sends) => {
    const response = await onRequestPost({
      request: makeRequest({ body: { message: { text: '/yardim@YanindaTurkiyeBot', chat: { id: 12345, type: 'private' } } }),
      env,
    });
    assert.equal(response.status, 200);
    assert.match(sends[0].text, /\\/durum — Son 24 saat özeti/);
    assert.match(sends[0].text, /\\/yardim — Komut listesi/);
  });
});

test('/durum reads real D1 tables and formats Turkish counts', async () => {
  const { env } = makeEnv();
  await withTelegramMock(async (sends) => {
    const response = await onRequestPost({
      request: makeRequest({ body: { message: { text: '/durum', chat: { id: 12345, type: 'private' } } }),
      env,
    });
    assert.equal(response.status, 200);
    assert.match(sends[0].text, /Olay sayısı: 17/);
    assert.match(sends[0].text, /Hata sayısı: 2/);
    assert.match(sends[0].text, /Bekleyen işletme başvurusu: 3/);
    assert.match(sends[0].text, /Hatalı bildirim: 4/);
  });
});

test('unknown commands get help; empty and ordinary text are ignored', async () => {
  const { env } = makeEnv();
  await withTelegramMock(async (sends) => {
    for (const text of ['/bilinmeyen', ' ', 'Merhaba bot']) {
      const response = await onRequestPost({
        request: makeRequest({ body: { message: { text, chat: { id: 12345, type: 'private' } } }),
        env,
      });
      assert.equal(response.status, 200);
    }
    assert.equal(sends.length, 1);
    assert.match(sends[0].text, /Bilinmeyen komut/);
  });
});

test('allowlisted group chats work; non-allowlisted group chats stay silent', async () => {
  const { env } = makeEnv({ adminIds: '12345,-1001234567890' });
  await withTelegramMock(async (sends) => {
    const allowed = await onRequestPost({
      request: makeRequest({ body: { message: { text: '/yardim', chat: { id: -1001234567890, type: 'supergroup' } } }),
      env,
    });
    const denied = await onRequestPost({
      request: makeRequest({ body: { message: { text: '/yardim', chat: { id: -1009999999999, type: 'group' } } }),
      env,
    });
    assert.equal(allowed.status, 200);
    assert.equal(denied.status, 200);
    assert.equal(sends.length, 1);
  });
});

test('Telegram message text is capped below the 4096-character API limit', async () => {
  const { env } = makeEnv();
  await withTelegramMock(async (sends) => {
    await sendAdminMessage(env, 'ğ'.repeat(5000));
    assert.ok(Array.from(sends[0].text).length <= 4096);
    assert.ok(sends[0].text.startsWith('ğ'));
  });
});
