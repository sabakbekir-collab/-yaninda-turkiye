import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { telegramApiBase } from '../functions/api/telegram.ts';

const worker = await readFile(new URL('../worker/index.ts', import.meta.url), 'utf8');
const apiDir = new URL('../functions/api/', import.meta.url);

test('every functions/api TypeScript endpoint is imported and its exported handlers are routed by Worker', async () => {
  const files = (await readdir(apiDir)).filter((name) => name.endsWith('.ts')).sort();
  assert.ok(files.length > 0, 'functions/api must contain endpoint files');

  for (const file of files) {
    const source = await readFile(new URL(file, apiDir), 'utf8');
    const modulePath = `../functions/api/${file.replace(/\.ts$/, '')}`;
    const importLine = worker.split('\n').find((line) => line.includes(modulePath));
    assert.ok(importLine, `Worker is missing import for functions/api/${file}`);

    const handlers = [...source.matchAll(/export\s+(?:async\s+)?function\s+(onRequest[A-Za-z0-9_]*)/g)].map((match) => match[1]);
    assert.ok(handlers.length > 0, `${file} exports no onRequest handler`);
    for (const handler of handlers) {
      const aliasMatch = importLine.match(new RegExp(`\\b${handler}\\s+as\\s+(\\w+)`));
      assert.ok(aliasMatch, `Worker import for ${file} must include ${handler}`);
      const alias = aliasMatch[1];
      assert.match(worker, new RegExp(`\\b${alias}\\s*\\(`), `Worker imports ${alias} but never routes to it`);
    }
  }
});

test('Telegram API base override accepts only plain HTTP loopback origins', () => {
  assert.equal(telegramApiBase({ TELEGRAM_API_BASE_URL: 'http://127.0.0.1:8799' }), 'http://127.0.0.1:8799');
  assert.equal(telegramApiBase({ TELEGRAM_API_BASE_URL: 'http://localhost:8799' }), 'http://localhost:8799');
  assert.equal(telegramApiBase({ TELEGRAM_API_BASE_URL: 'https://attacker.example' }), 'https://api.telegram.org');
  assert.equal(telegramApiBase({ TELEGRAM_API_BASE_URL: 'http://127.0.0.1.attacker.example' }), 'https://api.telegram.org');
  assert.equal(telegramApiBase({ TELEGRAM_API_BASE_URL: 'http://127.0.0.1@attacker.example' }), 'https://api.telegram.org');
  assert.equal(telegramApiBase({ TELEGRAM_API_BASE_URL: 'https://localhost:8799' }), 'https://api.telegram.org');
  assert.equal(telegramApiBase({ TELEGRAM_API_BASE_URL: 'not-a-url' }), 'https://api.telegram.org');
  assert.equal(telegramApiBase({}), 'https://api.telegram.org');
});
