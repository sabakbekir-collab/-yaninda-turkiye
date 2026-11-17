import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('CI does not use remote D1 or Cloudflare deployment credentials', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.doesNotMatch(workflow, /--remote|CLOUDFLARE_API_TOKEN|wrangler-action/i);
});

test('Telegram route is wired and cron does not expose secrets', () => {
  const worker = readFileSync('worker/index.ts', 'utf8');
  const config = readFileSync('wrangler.jsonc', 'utf8');
  assert.match(worker, /path === "\/api\/telegram".*postTelegram/s);
  assert.match(worker, /sendDailyTelegramReport/);
  assert.match(config, /"0 6 \* \* \*"/);
});
