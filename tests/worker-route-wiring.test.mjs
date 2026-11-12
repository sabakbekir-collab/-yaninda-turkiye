import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../worker/index.ts', import.meta.url), 'utf8');
const telegram = await readFile(new URL('../functions/api/telegram.ts', import.meta.url), 'utf8');

test('Worker exposes Telegram webhook and analytics deletion endpoints', () => {
  assert.match(worker, /postTelegram\s+from\s+["'][^"']*api\/telegram["']/);
  assert.match(worker, /postDeleteRequest\s+from\s+["'][^"']*api\/delete-request["']/);
  assert.match(worker, /path\s*===\s*["']\/api\/telegram["'][\s\S]*?postTelegram\(/);
  assert.match(worker, /path\s*===\s*["']\/api\/delete-request["'][\s\S]*?postDeleteRequest\(/);
});

test('Telegram reply can target an explicit local mock API origin', () => {
  assert.match(telegram, /env\.TELEGRAM_API_BASE_URL\s*\|\|\s*API/);
  assert.match(telegram, /\$\{apiBase\}\/bot\$\{env\.TELEGRAM_BOT_TOKEN\}\/sendMessage/);
});
