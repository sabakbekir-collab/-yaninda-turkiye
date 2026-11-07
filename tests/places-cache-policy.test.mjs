import test from 'node:test';
import assert from 'node:assert/strict';
import { cachePolicyFor } from '../functions/lib/placesCachePolicy.ts';

test('successful empty results are not cached by clients and expire from D1 within 60 seconds', () => {
  assert.deepEqual(cachePolicyFor({ ok: true, resultCount: 0 }), {
    cacheControl: 'no-store', ttlMs: 60_000, shouldCache: true
  });
});

test('partial populated results have a maximum 60-second cache lifetime', () => {
  assert.deepEqual(cachePolicyFor({ ok: true, resultCount: 3, partial: true }), {
    cacheControl: 'public,max-age=60', ttlMs: 60_000, shouldCache: true
  });
});

test('complete populated results retain a 15-minute D1 lifetime', () => {
  assert.deepEqual(cachePolicyFor({ ok: true, resultCount: 3 }), {
    cacheControl: 'public,max-age=300', ttlMs: 15 * 60_000, shouldCache: true
  });
});

test('upstream failures are never cached', () => {
  assert.deepEqual(cachePolicyFor({ ok: false, resultCount: 0 }), {
    cacheControl: 'no-store', ttlMs: 0, shouldCache: false
  });
});
