import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRequestGpsOnEntry, isPositionFresh, shouldRerunWithGps } from '../src/searchPlan.ts';

test('category entry requests fresh GPS for prompt, granted and unknown permission', () => {
  for (const permission of ['prompt', 'granted', 'unknown']) {
    assert.equal(shouldRequestGpsOnEntry({ incomingCategory: 'atm', permission, hasFreshPosition: false }), true);
  }
});

test('category entry does not prompt when permission is denied or unsupported', () => {
  for (const permission of ['denied', 'unsupported']) {
    assert.equal(shouldRequestGpsOnEntry({ incomingCategory: 'atm', permission, hasFreshPosition: false }), false);
  }
});

test('direct nearby entry without an incoming category does not request GPS', () => {
  assert.equal(shouldRequestGpsOnEntry({ incomingCategory: undefined, permission: 'prompt', hasFreshPosition: false }), false);
});

test('fresh position suppresses another GPS request on category entry', () => {
  assert.equal(shouldRequestGpsOnEntry({ incomingCategory: 'pharmacy', permission: 'granted', hasFreshPosition: true }), false);
});

test('saved position without a timestamp is never fresh', () => {
  assert.equal(isPositionFresh({ savedAt: undefined, now: 1_000_000, maxAgeMs: 300_000 }), false);
  assert.equal(isPositionFresh({ savedAt: null, now: 1_000_000, maxAgeMs: 300_000 }), false);
});

test('position freshness uses the five-minute boundary', () => {
  assert.equal(isPositionFresh({ savedAt: 700_001, now: 1_000_000, maxAgeMs: 300_000 }), true);
  assert.equal(isPositionFresh({ savedAt: 700_000, now: 1_000_000, maxAgeMs: 300_000 }), true);
  assert.equal(isPositionFresh({ savedAt: 699_999, now: 1_000_000, maxAgeMs: 300_000 }), false);
});

test('future timestamps are not accepted as fresh positions', () => {
  assert.equal(isPositionFresh({ savedAt: 1_000_001, now: 1_000_000, maxAgeMs: 300_000 }), false);
});

test('a GPS entry search is not eligible for the silent area-to-GPS rerun', () => {
  assert.equal(shouldRerunWithGps({ gpsArrived: true, lastAnchor: 'gps', manualAreaChosen: false, hasSearched: true, alreadyRerun: false }), false);
});

test('the silent GPS rerun remains one-shot', () => {
  assert.equal(shouldRerunWithGps({ gpsArrived: true, lastAnchor: 'area', manualAreaChosen: false, hasSearched: true, alreadyRerun: false }), true);
  assert.equal(shouldRerunWithGps({ gpsArrived: true, lastAnchor: 'area', manualAreaChosen: false, hasSearched: true, alreadyRerun: true }), false);
});
