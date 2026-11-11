import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceLabelFor, manualDutySourceFor } from '../functions/lib/manualDuty.ts';
import { confirmRoster } from '../functions/lib/telegramD1Store.ts';

test('manual duty source does not claim an unverified chamber source', () => {
  assert.equal(sourceLabelFor('mus'), 'Elle girildi');
  assert.equal(manualDutySourceFor('mus'), 'Elle girildi');
});

test('confirmed roster persists the neutral manual-entry source', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          statements.push({ sql, values });
          return { sql, values };
        },
      };
    },
    async batch() {},
  };
  await confirmRoster({
    DB: db,
  }, {
    ok: true,
    province: 'Muş',
    province_slug: 'mus',
    duty_date: '2026-11-10',
    rows: [{ district_slug: '', name: 'Eczane', address: 'Adres', phone: '0436 111 22 33' }],
  });
  assert.equal(statements[1].values[3], 'Elle girildi');
});