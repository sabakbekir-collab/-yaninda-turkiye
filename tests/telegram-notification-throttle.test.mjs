import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyRepeatedClientError } from '../functions/lib/telegram.ts';

function makePersistentEnv(store) {
  return {
    TELEGRAM_BOT_TOKEN: 'fake-bot-token',
    TELEGRAM_ADMIN_CHAT_IDS: '12345',
    DB: {
      prepare(sql) {
        let values = [];
        return {
          bind(...args) { values = args; return this; },
          async run() {
            const key = values[0];
            const current = store.get(key);
            if (sql.includes('WHERE api_cache.expires_at<=?')) {
              const now = values[3];
              if (!current || current.expires_at <= now) {
                store.set(key, { payload: values[1], expires_at: values[2] });
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }
            if (current) {
              store.set(key, { payload: String(Number(current.payload) + 1), expires_at: values[2] });
            } else {
              store.set(key, { payload: values[1], expires_at: values[2] });
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            const row = store.get(values[0]);
            return row ? { payload: row.payload } : null;
          },
        };
      },
    },
  };
}

test('repeated-error throttle persists across Worker instances and sends at most once per hour', async () => {
  const store = new Map();
  const env1 = makePersistentEnv(store);
  const previousFetch = globalThis.fetch;
  const previousWarn = console.warn;
  let sent = 0;
  globalThis.fetch = async () => { sent += 1; return new Response('{}', { status: 200 }); };
  console.warn = () => {};
  try {
    for (let i = 0; i < 5; i += 1) await notifyRepeatedClientError(env1, 'network_timeout');
    assert.equal(sent, 1);

    // A fresh Env simulates a new Worker isolate/restart but shares persistent D1.
    const env2 = makePersistentEnv(store);
    for (let i = 0; i < 5; i += 1) await notifyRepeatedClientError(env2, 'network_timeout');
    assert.equal(sent, 1);
  } finally {
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
  }
});
