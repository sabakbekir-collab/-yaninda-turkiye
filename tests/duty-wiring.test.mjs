import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('duty endpoint route and scheduled sync crons are wired',()=>{
 const worker=fs.readFileSync('worker/index.ts','utf8');
 const config=fs.readFileSync('wrangler.jsonc','utf8');
 const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
 assert.match(worker,/\/api\/duty/);
 assert.match(worker,/syncDutyChunk/);
 assert.match(config,/30 21/);
 assert.match(config,/0 3/);
 assert.match(config,/0 6/);
 assert.doesNotMatch(ci,/--remote|CLOUDFLARE_API_TOKEN|wrangler-action/i);
});
test('duty schema files are idempotent and manual apply is not wired into CI migrations',()=>{
 const sql=fs.readFileSync('scripts/live/apply-duty.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS duty_pharmacies/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS duty_sync_runs/);
 assert.match(sql,/UNIQUE\(duty_date, province, district, name\)/);
 const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
 assert.doesNotMatch(ci,/wrangler d1 migrations apply/i);
});
