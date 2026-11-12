import test from 'node:test';
import assert from 'node:assert/strict';
import { dutyStripState, matchDutyToNearby } from '../src/pharmacyPresentation.ts';

const today = '2026-11-07';
const duty = (id, name, lat, lon, verifiedAt = today) => ({ id, name, lat, lon, verifiedAt, isDuty: true });
const nearby = (id, name, lat, lon) => ({ id, name, lat, lon, isDuty: false });

test('only successful, dated, active-today duty data produces the names strip', () => {
  assert.equal(dutyStripState({ status: 'success', count: 2, stale: false, feedDate: today, activeDates: [today] }), 'names');
});

test('stale feed never produces names even when it contains records', () => {
  assert.equal(dutyStripState({ status: 'success', count: 2, stale: true, feedDate: '2026-10-11', activeDates: [today] }), 'stale');
});

test('undated feed never produces names', () => {
  assert.equal(dutyStripState({ status: 'success', count: 2, stale: false, feedDate: null, activeDates: [today] }), 'stale');
});

test('a feed date outside active duty dates never produces names', () => {
  assert.equal(dutyStripState({ status: 'success', count: 2, stale: false, feedDate: '2026-11-06', activeDates: [today] }), 'stale');
});

test('empty, loading, error and idle states remain distinct', () => {
  assert.equal(dutyStripState({ status: 'success', count: 0, stale: false, feedDate: today, activeDates: [today] }), 'empty');
  assert.equal(dutyStripState({ status: 'loading', count: 0, stale: false, feedDate: today, activeDates: [today] }), 'loading');
  assert.equal(dutyStripState({ status: 'error', count: 0, stale: false, feedDate: null, activeDates: [today] }), 'error');
  assert.equal(dutyStripState({ status: 'idle', count: 0, stale: false, feedDate: null, activeDates: [today] }), 'idle');
});

test('badge matching requires normalized equal names and coordinates within 75m', () => {
  const matches = matchDutyToNearby(
    [duty('d1', 'Şifa Eczanesi', 38.733, 41.491)],
    [nearby('o1', 'SIFA ECZANESİ', 38.7331, 41.491)]
  );
  assert.deepEqual([...matches], ['o1']);
});

test('badge is absent when names differ even when coordinates are close', () => {
  const matches = matchDutyToNearby(
    [duty('d1', 'Şifa Eczanesi', 38.733, 41.491)],
    [nearby('o1', 'Merkez Eczanesi', 38.733, 41.491)]
  );
  assert.equal(matches.size, 0);
});

test('badge is absent when coordinates exceed 75m', () => {
  const matches = matchDutyToNearby(
    [duty('d1', 'Şifa Eczanesi', 38.733, 41.491)],
    [nearby('o1', 'Şifa Eczanesi', 38.735, 41.491)]
  );
  assert.equal(matches.size, 0);
});

test('undated and stale duty rows can never badge nearby pharmacies', () => {
  const matches = matchDutyToNearby(
    [duty('old', 'Şifa Eczanesi', 38.733, 41.491, '2026-10-11'), duty('unknown', 'Merkez Eczanesi', 38.733, 41.491, undefined)],
    [nearby('o1', 'Şifa Eczanesi', 38.733, 41.491), nearby('o2', 'Merkez Eczanesi', 38.733, 41.491)]
  , [today]);
  assert.equal(matches.size, 0);
});

test('ambiguous one-to-many name and coordinate matches produce no badge', () => {
  const matches = matchDutyToNearby(
    [duty('d1', 'Şifa Eczanesi', 38.733, 41.491)],
    [nearby('o1', 'Şifa Eczanesi', 38.733, 41.491), nearby('o2', 'Şifa Eczanesi', 38.733, 41.491)]
  );
  assert.equal(matches.size, 0);
});
