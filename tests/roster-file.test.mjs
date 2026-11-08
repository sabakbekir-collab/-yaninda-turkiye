import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterFile, planReminders, monthlyEntryNote, dailyEntryNote } from '../functions/lib/rosterFile.ts';

const slugify = (value) => String(value ?? '').replace(/[ıİIğĞşŞçÇöÖüÜâÂîÎûÛ]/g, (char) => ({ 'ı': 'i', 'İ': 'i', 'I': 'i', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ç': 'c', 'Ç': 'c', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u', 'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u' })[char]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ctx = { provinceSlugs: ['mus', 'ankara', 'van'], provinceNames: { mus: 'Muş', ankara: 'Ankara', van: 'Van' }, districtsByProvince: { mus: ['Bulanık', 'Malazgirt', 'Merkez', 'Varto', 'Hasköy', 'Korkut'], van: ['Merkez', 'Edremit', 'Erciş'] }, slugify };

const now = new Date('2026-11-09T06:30:00Z');
const sample = 'Muş\n01.12.2026;Merkez;Demir Eczanesi;Atatürk Bulvarı No:5;04362121212\n01.12.2026;Merkez;Işık Eczanesi;Kışla Cad. No:12;04362131313\n02.12.2026;Varto;Şehir Eczanesi;Cumhuriyet Cad. No:3;04362141414';

test('sample monthly list parses dates, districts and rows', () => {
  const result = parseRosterFile(sample, now, ctx);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.province_slug, 'mus');
    assert.equal(result.rows.length, 3);
    assert.equal(result.dates.length, 2);
    assert.equal(result.rows[2].district_slug, 'varto');
    assert.deepEqual(result.missing_dates, []);
  }
});

test('quoted semicolons, BOM, CRLF and header are supported', () => {
  const value = String.fromCharCode(65279) + 'Muş\r\ntarih;ilçe;ad;adres;telefon\r\n01.12.2026;Merkez;Demir Eczanesi;"Atatürk Bulvarı; No:5";04362121212\r\n';
  const result = parseRosterFile(value, now, ctx);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.rows[0].address, 'Atatürk Bulvarı; No:5');
});

test('missing calendar dates are reported', () => {
  const result = parseRosterFile('Muş\n01.12.2026;Merkez;A;Adres A;04362121212\n03.12.2026;Merkez;B;Adres B;04362131313', now, ctx);
  assert.equal(result.ok && result.missing_dates[0], '2026-12-02');
});

test('past date and date beyond 45 days are rejected', () => {
  assert.equal(parseRosterFile('Muş\n08.11.2026;Merkez;A;Adres A;04362121212', now, ctx).ok, false);
  assert.equal(parseRosterFile('Muş\n25.12.2026;Merkez;A;Adres A;04362121212', now, ctx).ok, false);
});

test('601 rows are rejected', () => {
  const rows = Array.from({ length: 601 }, (_, index) => '01.12.2026;Merkez;Eczane ' + index + ';Adres ' + index + ';04362121212').join('\n');
  assert.equal(parseRosterFile('Muş\n' + rows, now, ctx).ok, false);
});

test('a malformed row rejects the entire file and returns line numbers', () => {
  const result = parseRosterFile('Muş\n01.12.2026;Merkez;A;Adres A;04362121212\nbozuk satır\n02.12.2026;Varto;B;Adres B;04362131313', now, ctx);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.lineNumbers, [3]);
});

test('duplicate province, date, name and address is deduplicated', () => {
  const result = parseRosterFile('Muş\n01.12.2026;Merkez;A;Adres A;04362121212\n01.12.2026;Merkez;A;Adres A;04362121212', now, ctx);
  assert.equal(result.ok && result.rows.length, 1);
  assert.equal(result.ok && result.duplicate_count, 1);
});

test('known other province is accepted and unknown province is rejected', () => {
  assert.equal(parseRosterFile('Van\n01.12.2026;Merkez;A;Adres A;04362121212', now, ctx).ok, true);
  assert.equal(parseRosterFile('Atlantis\n01.12.2026;Merkez;A;Adres A;04362121212', now, ctx).ok, false);
});

test('a filled district missing from the province context is rejected with its line number', () => {
  const result = parseRosterFile('Muş\n01.12.2026;UnknownTown;A;Adres A;04362121212', now, ctx);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, 'unknown_district');
    assert.deepEqual(result.lineNumbers, [2]);
  }
});

test('an empty district is accepted as a province-wide row', () => {
  const result = parseRosterFile('Muş\n01.12.2026;;A;Adres A;04362121212', now, ctx);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.rows[0].district_slug, '');
});

test('monthly and daily notes are explicit', () => {
  assert.match(monthlyEntryNote(now), /Aylık listeye göre/);
  assert.match(dailyEntryNote(now), /Güncellendi:/);
});

test('reminders cover missing today and near month end', () => {
  assert.equal(planReminders(now, []).length, 1);
  const full = [{ duty_date: '2026-11-09' }, { duty_date: '2026-11-12' }];
  assert.equal(planReminders(now, full)[0].kind, 'month_end');
  assert.equal(planReminders(now, [{ duty_date: '2026-11-09' }, { duty_date: '2026-11-20' }]).length, 0);
});
