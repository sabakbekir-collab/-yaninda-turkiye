import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dutySourceNote } from '../src/placeUtils.ts';

const card = readFileSync(new URL('../src/PlaceCard.tsx', import.meta.url), 'utf8');

test('manual duty cards show only their optional note instead of the third-party warning', () => {
  assert.equal(dutySourceNote({ coordsUnknown: true, source: 'Elle girildi: Eczacı odası listesi', dutyNote: 'Elle girildi.' }), 'Elle girildi.');
  assert.equal(dutySourceNote({ source: 'Elle girildi: Eczacı odası listesi' }), null);
  assert.equal(dutySourceNote({ source: 'Eczane Adresi' }), 'third_party');
  assert.match(card, /dutySourceNote\(p\)/);
});