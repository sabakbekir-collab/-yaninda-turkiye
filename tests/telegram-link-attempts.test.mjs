import test from 'node:test';
import assert from 'node:assert/strict';
import { clearTelegramLinkAttempts, registerTelegramLinkAttempt } from '../functions/lib/telegramD1Store.ts';

function attemptDatabase() {
  const rows = new Map();
  return {
    DB: {
      prepare(sql) {
        let values = [];
        return {
          bind(...args) {
            values = args;
            return this;
          },
          async run() {
            if (sql.startsWith('DELETE FROM telegram_link_attempts WHERE window_started_at')) {
              const [cutoff, now] = values;
              for (const [chatId, row] of rows) {
                if (row.window_started_at <= cutoff && (!row.locked_until || row.locked_until <= now)) rows.delete(chatId);
              }
            } else if (sql.startsWith('INSERT INTO telegram_link_attempts')) {
              const [chatId, now, cutoff] = values;
              const row = rows.get(chatId);
              if (!row) rows.set(chatId, { window_started_at: now, attempts: 1, locked_until: null });
              else if (row.window_started_at <= cutoff) rows.set(chatId, { window_started_at: now, attempts: 1, locked_until: null });
              else row.attempts += 1;
            } else if (sql.startsWith('UPDATE telegram_link_attempts SET locked_until')) {
              const [locked_until, chatId] = values;
              rows.get(chatId).locked_until = locked_until;
            } else if (sql.startsWith('DELETE FROM telegram_link_attempts WHERE chat_id')) {
              rows.delete(values[0]);
            }
            return {};
          },
          async first() {
            const row = rows.get(values[0]);
            return row ? { ...row } : null;
          },
        };
      },
    },
  };
}

test('Telegram link attempts are limited to five per chat in ten minutes, then locked out', async () => {
  const { DB } = attemptDatabase();
  const start = new Date('2026-11-10T12:00:00Z');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(await registerTelegramLinkAttempt({ DB }, 'chat-1', start), true);
  }
  assert.equal(await registerTelegramLinkAttempt({ DB }, 'chat-1', start), false);
  assert.equal(await registerTelegramLinkAttempt({ DB }, 'chat-1', new Date(start.getTime() + 9 * 60 * 1000)), false);
  assert.equal(await registerTelegramLinkAttempt({ DB }, 'chat-1', new Date(start.getTime() + 11 * 60 * 1000)), true);
});

test('successful linking can clear the chat attempt counter', async () => {
  const { DB } = attemptDatabase();
  const now = new Date('2026-11-10T12:00:00Z');
  assert.equal(await registerTelegramLinkAttempt({ DB }, 'chat-2', now), true);
  await clearTelegramLinkAttempts({ DB }, 'chat-2');
  assert.equal(await registerTelegramLinkAttempt({ DB }, 'chat-2', now), true);
});
