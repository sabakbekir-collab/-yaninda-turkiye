import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAdminTelegramLink } from '../functions/lib/adminRoster.ts';
import { recentRosterEvents } from '../functions/lib/telegramD1Store.ts';

function database() {
  const statements = [];
  return {
    statements,
    DB: {
      prepare(sql) {
        const statement = { sql, values: [] };
        const prepared = {
          bind(...values) {
            statement.values = values;
            return prepared;
          },
          async run() {
            statements.push(statement);
            return {};
          },
          async all() {
            statements.push(statement);
            return { results: [{ id: 8, type: 'confirmed', province: 'Muş', duty_date: '2026-11-10', created_at: '2026-11-10 08:00:00' }] };
          },
        };
        return prepared;
      },
    },
  };
}

test('admin link-code service persists a six-digit code with ten-minute expiry', async () => {
  const db = database();
  const result = await createAdminTelegramLink({ DB: db.DB }, new Date('2026-11-10T12:00:00Z'));
  assert.match(result.code, /^\d{6}$/);
  assert.equal(result.expiresAt, '2026-11-10T12:10:00.000Z');
  assert.ok(db.statements.findIndex(statement => statement.sql === 'DELETE FROM telegram_link_codes') < db.statements.findIndex(statement => statement.sql.includes('INSERT INTO telegram_link_codes')));
  assert.ok(db.statements.some(statement => statement.sql.includes('INSERT INTO telegram_link_codes') && statement.values[0] === result.code));
});

test('admin event service returns roster history and the endpoint exposes both features', async () => {
  const events = await recentRosterEvents({ DB: database().DB });
  assert.equal(events[0].type, 'confirmed');
  const admin = readFileSync(new URL('../functions/api/admin.ts', import.meta.url), 'utf8');
  assert.match(admin, /createAdminTelegramLink/);
  assert.match(admin, /rosterEvents/);
});
