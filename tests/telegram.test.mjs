import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/telegram.ts';
import { sendAdminMessage } from '../functions/lib/telegram.ts';

function makeEnv() {
  const calls = [];
  const env = {
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    TELEGRAM_BOT_TOKEN: 'dummy-test-credential',
    TELEGRAM_ADMIN_CHAT_IDS: '12345',
    DB: {
      prepare(sql) {
        const first = async (values = []) => {
          calls.push({ sql, values });
          if (sql.includes('SUM(CASE')) return { total: 12, errors: 2 };
          if (sql.includes('submissions')) return { total: 3 };
          if (sql.includes('reports')) return { total: 4 };
          if (sql.includes('api_cache')) return { payload: '1' };
          return null;
        };
        return {
          first: () => first(),
          bind(...values) {
            return {
              async run() { calls.push({ sql, values }); return { meta: { changes: 1 } }; },
              first: () => first(values),
              async all() { return { results: [] }; },
            };
          },
        };
      },
    },
  };
  return { env, calls };
}
function request(secret, body) {
  return new Request('https://example.test/api/telegram', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': secret, 'CF-Connecting-IP': '203.0.113.4', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('Telegram webhook rejects missing and incorrect secret', async () => {
  const { env } = makeEnv();
  assert.equal((await onRequestPost({ request: request('', { message: { text: '/yardim', chat: { id: 12345 } } }), env })).status, 401);
  assert.equal((await onRequestPost({ request: request('wrong', { message: { text: '/yardim', chat: { id: 12345 } } }), env })).status, 401);
});

test('unauthorized chat receives no command reply', async () => {
  const { env } = makeEnv();
  const previousFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => { sends += 1; return new Response('{}'); };
  try {
    const response = await onRequestPost({ request: request('test-webhook-secret', { message: { text: '/yardim', chat: { id: 99999 } } }), env });
    assert.equal(response.status, 200);
    assert.equal(sends, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test('/durum returns the expected summary format to an admin chat', async () => {
  const { env } = makeEnv();
  const previousFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (_url, init) => { payload = JSON.parse(init.body); return new Response('{}'); };
  try {
    const response = await onRequestPost({ request: request('test-webhook-secret', { message: { text: '/durum', chat: { id: 12345 } } }), env });
    assert.equal(response.status, 200);
    assert.match(payload.text, /Son 24 saat/);
    assert.match(payload.text, /Olay sayısı: 12/);
    assert.match(payload.text, /Hata sayısı: 2/);
    assert.match(payload.text, /Bekleyen işletme başvurusu: 3/);
    assert.match(payload.text, /Hatalı bildirim: 4/);
  } finally { globalThis.fetch = previousFetch; }
});

test('sendAdminMessage swallows Telegram network errors and never exposes credentials', async () => {
  const { env } = makeEnv();
  const previousFetch = globalThis.fetch;
  const previousWarn = console.warn;
  const logs = [];
  console.warn = (...args) => logs.push(args.join(' '));
  globalThis.fetch = async () => { throw new Error('network failure'); };
  try {
    await assert.doesNotReject(() => sendAdminMessage(env, 'Yeni işletme başvurusu alındı.'));
    assert.equal(logs.some((line) => line.includes(env.TELEGRAM_BOT_TOKEN)), false);
    assert.equal(logs.some((line) => line.includes('dummy-test-credential')), false);
  } finally {
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
  }
});


