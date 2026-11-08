import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dutyViewState, shouldShowDutyCount } from '../src/dutyView.ts';

const today = '2026-11-08';
const items = [{ name: 'Eczane A' }, { name: 'Eczane B' }];

test('today dated feed with two pharmacies returns list', () => {
  assert.deepEqual(dutyViewState({ feedDate: today, items, now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'list', items });
});

test('old feed date returns none and exposes staleDate without items', () => {
  assert.deepEqual(dutyViewState({ feedDate: '2026-10-11', items, now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'none', staleDate: '2026-10-11', items: [] });
});

test('missing feed date never returns a duty list', () => {
  assert.deepEqual(dutyViewState({ feedDate: null, items, now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'none', items: [] });
});

test('Istanbul date boundary changes at local midnight', () => {
  assert.equal(dutyViewState({ feedDate: '2026-11-08', items, now: '2026-11-07T23:59:00+03:00', tz: 'Europe/Istanbul' }).kind, 'none');
  assert.equal(dutyViewState({ feedDate: '2026-11-08', items, now: '2026-11-08T00:01:00+03:00', tz: 'Europe/Istanbul' }).kind, 'list');
});

test('today dated but empty feed returns none', () => {
  assert.deepEqual(dutyViewState({ feedDate: today, items: [], now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'none', items: [] });
});

test('none state cannot produce a duty label', () => {
  const state = dutyViewState({ feedDate: null, items, now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' });
  assert.equal(state.kind, 'none');
  assert.equal(state.kind === 'list' ? 'NÖBETÇİ' : null, null);
});

test('pharmacy error and stale roster messages never render role alert', () => {
  const source = readFileSync(new URL('../src/TargetApp.tsx', import.meta.url), 'utf8');
  assert.match(source, /!pharmacyMode\s*&&\s*err[^\n]*role="alert"/);
  assert.doesNotMatch(source, /pharmacyMode[^\n]*role="alert"/);
});

test('zero duty items do not show a numeric badge', () => {
  assert.equal(shouldShowDutyCount(0), false);
  assert.equal(shouldShowDutyCount(2), true);
});
