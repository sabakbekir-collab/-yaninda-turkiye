import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentManualDutyPlaces } from '../functions/lib/manualDutyPlaces.ts';

const rosterRows = [
  { id: 1, province: 'Muş', province_slug: 'mus', duty_date: '', district_slug: '', name: 'İl Geneli Eczanesi', address: 'İl adresi', phone: '0436 111 11 11' },
  { id: 2, province: 'Muş', province_slug: 'mus', duty_date: '', district_slug: 'varto', name: 'Varto Eczanesi', address: 'Varto adresi', phone: '0436 222 22 22' },
  { id: 3, province: 'Muş', province_slug: 'mus', duty_date: '', district_slug: 'merkez', name: 'Merkez Eczanesi', address: 'Merkez adresi', phone: '0436 333 33 33' },
];

function envWithRoster() {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async all() {
                if (!sql.includes('FROM manual_duty_rosters')) return { results: [] };
                return { results: rosterRows.map(row => ({ ...row, duty_date: values[1] })) };
              },
            };
          },
        };
      },
    },
  };
}

test('places API returns only the current manual roster and selected district rows', async () => {
  const env = envWithRoster();
  const result = await currentManualDutyPlaces(env, 'mus', 'Varto', '2026-11-10');
  const places = result.places;
  assert.deepEqual(places.map(place => place.name), ['İl Geneli Eczanesi', 'Varto Eczanesi']);
  assert.ok(places.every(place => place.isDuty && place.coordsUnknown));
  assert.ok(places.every(place => !('lat' in place) && !('lon' in place)));
  const api = readFileSync(new URL('../functions/api/places.ts', import.meta.url), 'utf8');
  assert.match(api, /currentManualDutyPlaces/);
});

test('places API shows province records with a note when the selected district has no entry', async () => {
  const result = await currentManualDutyPlaces(envWithRoster(), 'mus', 'Bulanık', '2026-11-10');
  const places = result.places;
  assert.deepEqual(places.map(place => place.name), ['İl Geneli Eczanesi', 'Varto Eczanesi', 'Merkez Eczanesi']);
  assert.ok(places.every(place => /diğer ilçelerindeki nöbetçi eczaneler gösteriliyor/.test(place.dutyNote)));
});
