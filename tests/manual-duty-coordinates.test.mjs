import test from 'node:test';
import assert from 'node:assert/strict';
import { manualDutyPlaceFor } from '../functions/lib/manualDuty.ts';
import { isPlaceMappable } from '../src/placeUtils.ts';
import { directionsLinkForPlace, mapsLinkForPlace } from '../src/share.ts';
import { favoriteSnapshot } from '../src/favorites.ts';

test('manual duty places keep unknown coordinates unknown across map, directions and favorites', () => {
  const place = manualDutyPlaceFor({
    id: '7', province_slug: 'mus', district_slug: 'varto',
    name: 'Varto Eczanesi', address: 'Cumhuriyet Caddesi', phone: '04367112233',
  });
  assert.equal(place.coordsUnknown, true);
  assert.equal('lat' in place, false);
  assert.equal('lon' in place, false);
  assert.equal(isPlaceMappable(place), false);
  const destination = new URL(directionsLinkForPlace(place)).searchParams.get('destination');
  assert.equal(destination, 'Varto Eczanesi, Cumhuriyet Caddesi');
  const mapQuery = new URL(mapsLinkForPlace(place)).searchParams.get('query');
  assert.equal(mapQuery, 'Varto Eczanesi, Cumhuriyet Caddesi');
  assert.equal(favoriteSnapshot(place).coordsUnknown, true);
});

test('unknown-coordinate marker prevents fabricated coordinates from enabling map links', () => {
  const place = {
    name: 'Varto Eczanesi', address: 'Cumhuriyet Caddesi',
    lat: 38.5, lon: 41.5, coordsUnknown: true,
  };
  assert.equal(isPlaceMappable(place), false);
  assert.equal(new URL(directionsLinkForPlace(place)).searchParams.get('destination'), 'Varto Eczanesi, Cumhuriyet Caddesi');
  assert.equal(new URL(mapsLinkForPlace(place)).searchParams.get('query'), 'Varto Eczanesi, Cumhuriyet Caddesi');
});