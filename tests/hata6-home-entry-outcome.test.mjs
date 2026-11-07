import test from 'node:test';
import assert from 'node:assert/strict';
import { homeEntryOutcome, canStartEntry } from '../src/searchPlan.ts';

test('GPS success with reverse-geocoded area navigates with both', () => {
  assert.deepEqual(homeEntryOutcome({ gps: 'ok', area: 'ok' }), { navigate: 'withArea' });
});

test('GPS success survives reverse-geocoding failure and keeps coordinates', () => {
  assert.deepEqual(homeEntryOutcome({ gps: 'ok', area: 'error' }), { navigate: 'positionOnly' });
});

test('denied GPS falls back to saved area and explains permission', () => {
  assert.deepEqual(homeEntryOutcome({ gps: 'denied', area: 'error' }), { navigate: 'withSavedArea', message: 'Konum izni verilmedi. İl ve ilçe seçerek devam edebilirsin.' });
});

test('unsupported GPS falls back to saved area with explanation', () => {
  assert.deepEqual(homeEntryOutcome({ gps: 'unsupported', area: 'error' }), { navigate: 'withSavedArea', message: 'Bu cihazda konum kullanılamıyor. İl ve ilçe seçerek devam edebilirsin.' });
});

test('GPS error falls back to saved area with timeout-safe explanation', () => {
  assert.deepEqual(homeEntryOutcome({ gps: 'error', area: 'error' }), { navigate: 'withSavedArea', message: 'Güncel konum alınamadı. İl ve ilçe seçerek devam edebilirsin.' });
});

test('entry cannot start while location is already being acquired', () => {
  assert.equal(canStartEntry({ locating: true }), false);
  assert.equal(canStartEntry({ locating: false }), true);
});
