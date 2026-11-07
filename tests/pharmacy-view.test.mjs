import test from 'node:test';
import assert from 'node:assert/strict';
import { pharmacyResultsView } from '../src/pharmacyView.ts';

const base = { dutyStatus: 'stale', dutyCount: 0, nearbyStatus: 'success', nearbyCount: 2 };

test('verified duty records remain the primary list', () => {
  assert.deepEqual(pharmacyResultsView({ dutyStatus: 'ok', dutyCount: 3, nearbyStatus: 'success', nearbyCount: 2 }), {
    list: 'duty', note: null, message: null, showRedBanner: false
  });
});

test('stale duty feed shows nearby pharmacies without a red banner', () => {
  assert.deepEqual(pharmacyResultsView(base), {
    list: 'nearby', note: 'unverified', message: null, showRedBanner: false
  });
});

test('stale duty feed with no nearby records shows empty state', () => {
  assert.deepEqual(pharmacyResultsView({ ...base, nearbyCount: 0 }), {
    list: 'none', note: null, message: 'empty', showRedBanner: false
  });
});

test('stale duty feed with nearby lookup failure shows error state', () => {
  assert.deepEqual(pharmacyResultsView({ ...base, nearbyStatus: 'error', nearbyCount: 0 }), {
    list: 'none', note: null, message: 'error', showRedBanner: false
  });
});

test('duty network failure keeps the red error banner visible', () => {
  assert.deepEqual(pharmacyResultsView({ dutyStatus: 'error', dutyCount: 0, nearbyStatus: 'success', nearbyCount: 2 }), {
    list: 'nearby', note: 'unverified', message: null, showRedBanner: true
  });
});

test('stale or undated duty data can never be selected as the duty list', () => {
  for (const nearbyStatus of ['idle', 'loading', 'success', 'error']) {
    const result = pharmacyResultsView({ dutyStatus: 'stale', dutyCount: 99, nearbyStatus, nearbyCount: 0 });
    assert.notEqual(result.list, 'duty');
  }
});
