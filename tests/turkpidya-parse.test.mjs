import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTurkpidya } from '../functions/lib/turkpidyaParse.ts';
import { activeDutyDates, dutyDateKey } from '../functions/lib/dutyDates.ts';
import { trSlug } from '../src/text.ts';

const slugify = trSlug;
const now = new Date('2026-11-08T12:00:00+03:00');
const rows = [
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Ege Sena Eczanesi', address: 'Ümit Mah.meksika Cad.no:39/A Ümitköy, Çankaya', phone: '+903122359811', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Feride Eczanesi', address: '100. Yıl Mah. Nenehatun Cad. No:63/A, Çankaya', phone: '+903124361855', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Gökbala Eczanesi', address: 'Ehlibeyt Mah. Ceyhun Atuf Kansu Cad. No:91/E, Çankaya', phone: '+903129115546', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Leman Eczanesi', address: 'Emek Mah. Kazakistan Cad. No: 138/A, Çankaya', phone: '+903122129796', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Pırıl Eczanesi', address: 'Zülfü Tigrel Akın-1 Blok No:9/A, Çankaya', phone: '+903124902196', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Yaşamkent Mine Eczanesi', address: 'Alacaatlı Mah. Mehmet Rifat Börekçi Cad. No:35/B-e, Çankaya', phone: '+905052584300', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Özlemin Eczanesi', address: 'Birlik Mah. Şehit Kurbani Akboğa Sok. No:35/8, Çankaya', phone: '+903124965364', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'Ülkü Eczanesi', address: 'Kocatepe Mah.meşrutiyet Cad. No: 23/B-23C, Çankaya', phone: '+903124188929', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null },
  { city: 'ankara', district: 'Cankaya', subDistrict: 'Çankaya', name: 'İrem Eczanesi', address: 'Topraklık Mah. Kıbrıs Cad. No:64/A, Çankaya', phone: '+903124341061', duty_date: '2026-11-08', duty_start: null, duty_end: null, open_now: null, source_state: 'current', lat: null, lng: null }
];
const ankaraFixture = {
  source: 'Provincial pharmacist chambers (eczacı odası), with municipal fallbacks, via the Turkpidya tools platform',
  duty_date: '2026-11-08',
  duty_dates: { ankara: '2026-11-08' },
  count: 9,
  cities_available: { ankara: 9 },
  cities_served: ['ankara'],
  cities_blocked: [],
  pharmacies: rows,
  last_updated: '2026-11-08T22:10:47+03:00'
};
const parse = (body, city = 'ankara', district = '', clock = now) =>
  parseTurkpidya(body, city, district, clock, slugify, activeDutyDates(clock), dutyDateKey);

test('Ankara gerçek Turkpidya biçimi dokuz koordinatsız güncel kaydı kabul eder', () => {
  const result = parse(ankaraFixture);
  assert.equal(result.rows.length, 9);
  assert.equal(result.date, '2026-11-08');
  assert.ok(result.rows.every(row => row.hasCoords === false && row.lat === undefined && row.lon === undefined));
});

test('Çankaya eşleşir, Keçiören filtresi boş güncel sonuç verir', () => {
  assert.equal(parse(ankaraFixture, 'ankara', 'cankaya').rows.length, 9);
  const result = parse(ankaraFixture, 'ankara', 'kecioren');
  assert.equal(result.rows.length, 0);
  assert.equal(result.reason, 'no_current_duty_records');
});

test('Muş kapsam dışı boş cevabı bayat değil güncel boş sonuçtur', () => {
  const result = parse({
    duty_date: '2026-11-08',
    duty_dates: [],
    count: 0,
    cities_served: [],
    pharmacies: []
  }, 'mus');
  assert.equal(result.rows.length, 0);
  assert.equal(result.reason, 'no_current_duty_records');
});

test('eski feed tarihi stale_duty_list döndürür', () => {
  const result = parse({
    duty_date: '2026-10-11',
    count: 3,
    pharmacies: Array.from({ length: 3 }, (_, i) => ({ city: 'ankara', district: 'Cankaya', name: 'Bayat ' + i, duty_date: '2026-10-11' }))
  });
  assert.equal(result.rows.length, 0);
  assert.equal(result.reason, 'stale_duty_list');
});

test('geçerli koordinatlar hasCoords true olur', () => {
  const result = parse({ duty_date: '2026-11-08', pharmacies: [{ city: 'ankara', district: 'Cankaya', name: 'Koordinatlı', lat: 39.9, lng: 32.85 }] });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].hasCoords, true);
  assert.equal(result.rows[0].lat, 39.9);
  assert.equal(result.rows[0].lon, 32.85);
});

test('09:00 öncesi önceki gün kabul edilir, 09:00 itibarıyla reddedilir', () => {
  const beforeNine = new Date('2026-11-09T00:30:00+03:00');
  const atNine = new Date('2026-11-09T09:00:00+03:00');
  const fixture = { duty_date: '2026-11-08', pharmacies: [{ city: 'ankara', district: 'Cankaya', name: 'Gece Nöbetçisi', duty_date: '2026-11-08' }] };
  assert.equal(parse(fixture, 'ankara', '', beforeNine).rows.length, 1);
  const rejected = parse(fixture, 'ankara', '', atNine);
  assert.equal(rejected.rows.length, 0);
  assert.equal(rejected.reason, 'stale_duty_list');
});

test('source_state stale elenir, current kalır', () => {
  const result = parse({ duty_date: '2026-11-08', pharmacies: [
    { city: 'ankara', district: 'Cankaya', name: 'Güncel', source_state: 'current' },
    { city: 'ankara', district: 'Cankaya', name: 'Bayat', source_state: 'stale' }
  ] });
  assert.deepEqual(result.rows.map(row => row.name), ['Güncel']);
});

test('duty_dates nesnesi citySlug anahtarından feed tarihini sağlar', () => {
  const result = parse({ duty_dates: { ankara: '2026-11-08' }, pharmacies: [{ city: 'ankara', district: 'Cankaya', name: 'Nöbetçi' }] });
  assert.equal(result.date, '2026-11-08');
  assert.equal(result.rows.length, 1);
});

test('aynı ad ve adres tekilleştirilir, adı boş satır atılır', () => {
  const result = parse({ duty_date: '2026-11-08', pharmacies: [
    { city: 'ankara', district: 'Cankaya', name: 'Aynı Eczane', address: 'Adres' },
    { city: 'ankara', district: 'Cankaya', name: 'Aynı Eczane', address: 'Adres' },
    { city: 'ankara', district: 'Cankaya', name: '  ' }
  ] });
  assert.equal(result.rows.length, 1);
});
