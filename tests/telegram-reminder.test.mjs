import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sendMissingRosterReminder } from '../functions/lib/telegramFlow.ts';

function reminderEnv({ alreadySent = false, hasRoster = false, chatId = '123' } = {}) {
  const queries = [];
  return {
    queries,
    env: {
      TELEGRAM_BOT_TOKEN: 'test-token-not-for-output',
      DB: {
        prepare(sql) {
          const prepared = {
            bind(...values) {
              queries.push({ sql, values });
              return prepared;
            },
            async first() {
              if (sql.includes("type='reminder'")) return alreadySent ? { id: 1 } : null;
              if (sql.includes("key='linked_chat_id'")) return { value: chatId };
              return null;
            },
            async all() { return { results: hasRoster ? [{ id: 1 }] : [] }; },
            async run() { return {}; },
          };
          return prepared;
        },
      },
    },
  };
}

test('daily reminder sends once only when today has no roster and a chat is linked', async () => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response('{"ok":true}', { status: 200 });
  };
  try {
    const { env, queries } = reminderEnv();
    await sendMissingRosterReminder(env, new Date('2026-11-10T12:00:00Z'));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].body.chat_id, '123');
    assert.ok(queries.some(query => query.sql.includes("type='reminder'")));
    assert.ok(queries.some(query => query.sql.includes('INSERT INTO roster_events')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('daily reminder does not send if already sent or a roster exists', async () => {
  const originalFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => {
    sends += 1;
    return new Response('{"ok":true}', { status: 200 });
  };
  try {
    await sendMissingRosterReminder(reminderEnv({ alreadySent: true }).env, new Date('2026-11-10T12:00:00Z'));
    await sendMissingRosterReminder(reminderEnv({ hasRoster: true }).env, new Date('2026-11-10T12:00:00Z'));
    assert.equal(sends, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Worker schedule and Wrangler cron both wire the reminder without running it', () => {
  const worker = readFileSync(new URL('../worker/index.ts', import.meta.url), 'utf8');
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.match(worker, /scheduled\([^]*sendMissingRosterReminder/);
  assert.deepEqual(config.triggers.crons, ['0 5 * * *']);
});
