import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/telegram.ts';

function makeEnv() {
  const sent = [];
  const queries = [];
  const env = {
    TELEGRAM_BOT_TOKEN: 'fake-local-token',
    TELEGRAM_WEBHOOK_SECRET: 'fake-local-secret',
    TELEGRAM_ADMIN_CHAT_IDS: '12345',
    DB: {
      prepare(sql) {
        queries.push(sql);
        const first = async () => {
          if (sql.includes('SELECT payload FROM api_cache')) return { payload: '1' };
          if (sql.includes('SUM(CASE WHEN type IN')) return { total: 8, errors: 2 };
          if (sql.includes('FROM submissions')) return { total: 3 };
          if (sql.includes('FROM reports')) return { total: 4 };
          return null;
        };
        return {
          bind() {
            return {
              async run() { return { meta: { changes: 1 } }; },
              first,
            };
          },
          first,
        };
      },
    },
  };
  return { env, sent, queries };
}

function makeRequest(secret, update) {
  return new Request('https://example.test/api/telegram', {
    method: 'POST',
    headers: {
      'X-Telegram-Bot-Api-Secret-Token': secret,
      'CF-Connecting-IP': '203.0.113.10',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(update),
  });
}

test('Telegram webhook rejects missing or incorrect secret', async () => {
  const { env } = makeEnv();
  assert.equal((await onRequestPost({ request: makeRequest('', {}), env })).status, 401);
  assert.equal((await onRequestPost({ request: makeRequest('wrong', {}), env })).status, 401);
});

test('unauthorized chat is silently ignored', async () => {
  const { env } = makeEnv();
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ ok: true }); };
  try {
    const response = await onRequestPost({
      request: makeRequest('fake-local-secret', { message: { chat: { id: 999 }, text: '/yardim' } }),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('/start and /yardim return the help text to an allowlisted admin', async () => {
  const { env } = makeEnv();
  const previousFetch = globalThis.fetch;
  const payloads = [];
  globalThis.fetch = async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    return Response.json({ ok: true });
  };
  try {
    for (const text of ['/start', '/yardim@YanindaTurkiyeBot']) {
      const response = await onRequestPost({
        request: makeRequest('fake-local-secret', { message: { chat: { id: 12345, type: 'private' }, text } }),
        env,
      });
      assert.equal(response.status, 200);
    }
    assert.equal(payloads.length, 2);
    assert.match(payloads[0].text, /Yanımda Türkiye yönetim botu/);
    assert.match(payloads[1].text, /\/durum/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('/durum uses the actual D1 schema columns', async () => {
  const { env, queries } = makeEnv();
  const previousFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(init.body);
    return Response.json({ ok: true });
  };
  try {
    const response = await onRequestPost({
      request: makeRequest('fake-local-secret', { message: { chat: { id: 12345, type: 'private' }, text: '/durum' } }),
      env,
    });
    assert.equal(response.status, 200);
    assert.ok(queries.some((sql) => sql.includes("created_at>=datetime('now','-24 hours')")));
    assert.match(payload.text, /Olay sayısı: 8/);
    assert.match(payload.text, /Hata sayısı: 2/);
    assert.match(payload.text, /Bekleyen işletme başvurusu: 3/);
    assert.match(payload.text, /Açık hatalı bildirim: 4/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
