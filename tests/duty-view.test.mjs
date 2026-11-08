import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dutyViewState, shouldShowDutyCount } from '../src/dutyView.ts';

const today = '2026-11-08';
const items = [{ name: 'Eczane A', verifiedAt: today }, { name: 'Eczane B', verifiedAt: today }];
const overnightNow = '2026-11-08T21:30:00Z';
const afterDutyNow = '2026-11-09T06:30:00Z';

test('today dated feed with two pharmacies returns list', () => {
  assert.deepEqual(dutyViewState({ feedDate: today, items, now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'list', items });
});

test('old feed date returns none and exposes staleDate without items', () => {
  assert.deepEqual(dutyViewState({ feedDate: '2026-10-11', items, now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'none', staleDate: '2026-10-11', items: [] });
});

test('overnight 00:30 accepts yesterday feed and rows', () => {
  assert.deepEqual(dutyViewState({ feedDate: today, items, now: overnightNow, tz: 'Europe/Istanbul' }), { kind: 'list', items });
});

test('09:30 rejects yesterday feed and exposes staleDate', () => {
  assert.deepEqual(dutyViewState({ feedDate: today, items, now: afterDutyNow, tz: 'Europe/Istanbul' }), { kind: 'none', staleDate: today, items: [] });
});

test('08:59 accepts yesterday and 09:00 rejects it', () => {
  assert.equal(dutyViewState({ feedDate: today, items, now: '2026-11-09T05:59:00Z', tz: 'Europe/Istanbul' }).kind, 'list');
  assert.deepEqual(dutyViewState({ feedDate: today, items, now: '2026-11-09T06:00:00Z', tz: 'Europe/Istanbul' }), { kind: 'none', staleDate: today, items: [] });
});

test('missing feed date accepts rows dated today', () => {
  const todayRows = [{ name: 'Eczane A', verifiedAt: '2026-11-09' }, { name: 'Eczane B', verifiedAt: '2026-11-09' }];
  assert.deepEqual(dutyViewState({ feedDate: null, items: todayRows, now: '2026-11-09T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'list', items: todayRows });
});

test('Istanbul date boundary changes at local midnight', () => {
  assert.equal(dutyViewState({ feedDate: '2026-11-08', items, now: '2026-11-07T23:59:00+03:00', tz: 'Europe/Istanbul' }).kind, 'none');
  assert.equal(dutyViewState({ feedDate: '2026-11-08', items, now: '2026-11-08T00:01:00+03:00', tz: 'Europe/Istanbul' }).kind, 'list');
});

test('today dated but empty feed returns none', () => {
  assert.deepEqual(dutyViewState({ feedDate: today, items: [], now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'none', items: [] });
});

test('none state cannot produce a duty label', () => {
  const state = dutyViewState({ feedDate: null, items: [{ name: 'Tarihsiz eczane' }], now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' });
  assert.equal(state.kind, 'none');
  assert.equal(state.kind === 'list' ? 'NÖBETÇİ' : null, null);
});

test('pharmacy error and stale roster messages never render role alert', () => {
  const source = readFileSync(new URL('../src/TargetApp.tsx', import.meta.url), 'utf8');
  assert.match(source, /!pharmacyMode&&err&&<div className="error nearby-error" role="alert">/);
  const BAD_ALERT = source.split(String.fromCharCode(10)).filter(line => line.includes('role="alert"') && line.includes('pharmacyMode&&') && !line.includes('!pharmacyMode&&'));
  assert.deepEqual(BAD_ALERT, []);
});

test('zero duty items do not show a numeric badge', () => {
  assert.equal(shouldShowDutyCount(0), false);
  assert.equal(shouldShowDutyCount(2), true);
});

test('today feed filters out rows whose own date is stale', () => {
  assert.deepEqual(dutyViewState({ feedDate: today, items: [{ name: 'Eski eczane', verifiedAt: '2026-10-11' }], now: '2026-11-08T12:00:00+03:00', tz: 'Europe/Istanbul' }), { kind: 'none', items: [] });
});

test('place action buttons wrap without horizontal clipping on narrow screens', () => {
  const css = readFileSync(new URL('../src/target.css', import.meta.url), 'utf8');
  assert.match(css, /\.nearby-place-card footer\.place-actions\{[^}]*flex-wrap:wrap[^}]*overflow:visible/);
  assert.match(css, /\.nearby-place-card footer\.place-actions>a[^}]*min-width:0/);
});
