import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['functions/api/telegram.ts', 'worker/index.ts', 'functions/api/admin.ts'];

test('Telegram secrets are never included in console output or error messages', () => {
  for (const path of files) {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    const lines = source.split(String.fromCharCode(10));
    for (const line of lines) {
      if (line.includes('console.') || line.includes('new Error') || line.includes('throw ')) {
        assert.equal(line.includes('TELEGRAM_BOT_TOKEN'), false, path + ' logs or throws a bot secret identifier');
        assert.equal(line.includes('TELEGRAM_WEBHOOK_SECRET'), false, path + ' logs or throws a webhook secret identifier');
      }
    }
  }
});
