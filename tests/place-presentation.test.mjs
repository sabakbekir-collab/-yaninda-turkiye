import test from 'node:test';
import assert from 'node:assert/strict';
import { placeCanUseCoordinates, placeDirectionsUrl, placeDistancePresentation, turkpidyaSourceLinkForPlaces, TURKPIDYA_DUTY_SOURCE_URL } from '../src/placePresentation.ts';

test('coordsUnknown kartında mesafe ve kuş uçuşu etiketi üretilmez', () => {
  assert.equal(placeDistancePresentation({ coordsUnknown: true, distance: 2.4 }, 'Konumuna göre, kuş uçuşu'), null);
});

test('coordsUnknown kaydın yol tarifi adı ve adresi arar, merkez koordinatını kullanmaz', () => {
  const url = placeDirectionsUrl({ coordsUnknown: true, name: 'Ege Sena Eczanesi', address: 'Ümitköy, Çankaya', lat: 39.9, lon: 32.85 });
  assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=Ege%20Sena%20Eczanesi%20%C3%9Cmitk%C3%B6y%2C%20%C3%87ankaya');
  assert.equal(placeCanUseCoordinates({ coordsUnknown: true, lat: 39.9, lon: 32.85 }), false);
});

test('Turkpidya nöbet kaydı kaynak bağlantısını görünür kılacak URL sağlar', () => {
  assert.equal(turkpidyaSourceLinkForPlaces([{ id: 'turkpidya-duty-1' }]), TURKPIDYA_DUTY_SOURCE_URL);
  assert.equal(turkpidyaSourceLinkForPlaces([{ id: 'duty-pharmacy-1' }]), null);
});
