import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterMessage, verifyWebhookSecret, decideTelegramAction } from '../functions/lib/telegramRoster.ts';

const slugify = (value) => String(value ?? '').replace(/[ıİIğĞşŞçÇöÖüÜâÂîÎûÛ]/g, (char) => ({ 'ı': 'i', 'İ': 'i', 'I': 'i', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ç': 'c', 'Ç': 'c', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u', 'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u' })[char]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ctx = { provinceSlugs: ['mus', 'ankara', 'van'], provinceNames: { mus: 'Muş', ankara: 'Ankara', van: 'Van' }, districtsByProvince: { mus: ['Bulanık', 'Malazgirt', 'Merkez', 'Varto', 'Hasköy', 'Korkut'] }, slugify };

const now = new Date('2026-11-09T06:30:00Z');
const valid = 'Muş 09.11.2026\n[Merkez] Yeni Eczane | İstasyon Caddesi No 4 | +90 (436) 212-34-56\n[Varto] Varto Eczanesi | Cumhuriyet Mahallesi | 0436 711 22 33';

test('valid roster resolves province, date and rows', () => {
  const result = parseRosterMessage(valid, now, ctx);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.province, 'Muş');
  assert.equal(result.province_slug, 'mus');
  assert.equal(result.duty_date, '2026-11-09');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].district_slug, 'merkez');
  assert.equal(result.rows[1].district_slug, 'varto');
});

test('province-only rows have an empty district and phone format is accepted', () => {
  const result = parseRosterMessage('Muş\nYeni Eczane | İstasyon Caddesi | +90 436 212 34 56', now, ctx);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.rows[0].district_slug, '');
    assert.equal(result.rows[0].phone, '+90 436 212 34 56');
  }
});

test('missing date uses Istanbul today at 00:30 and 09:30', () => {
  const early = parseRosterMessage('Muş\nEczane A | Adres A | 0436 111 22 33', new Date('2026-11-08T21:30:00Z'), ctx);
  const late = parseRosterMessage('Muş\nEczane A | Adres A | 0436 111 22 33', new Date('2026-11-09T06:30:00Z'), ctx);
  assert.equal(early.ok && early.duty_date, '2026-11-09');
  assert.equal(late.ok && late.duty_date, '2026-11-09');
});

test('yesterday is rejected and tomorrow is accepted', () => {
  assert.equal(parseRosterMessage('Muş 08.11.2026\nEczane A | Adres A | 0436 111 22 33', now, ctx).ok, false);
  const tomorrow = parseRosterMessage('Muş 10.11.2026\nEczane A | Adres A | 0436 111 22 33', now, ctx);
  assert.equal(tomorrow.ok && tomorrow.duty_date, '2026-11-10');
});

test('an unsupported line rejects the whole message and reports its line number', () => {
  const result = parseRosterMessage('Muş\nEczane A | Adres A | 0436 111 22 33\nBu satır anlaşılmaz', now, ctx);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.lineNumber, 3);
});

test('61 rows are rejected', () => {
  const rows = Array.from({ length: 61 }, (_, i) => 'Eczane ' + i + ' | Adres ' + i + ' | 0436 111 22 33').join('\n');
  assert.equal(parseRosterMessage('Muş\n' + rows, now, ctx).ok, false);
});

test('unknown province is rejected', () => {
  assert.equal(parseRosterMessage('Atlantis\nEczane A | Adres A | 0436 111 22 33', now, ctx).ok, false);
});

test('empty name, address or phone and invalid phone characters are rejected', () => {
  assert.equal(parseRosterMessage('Muş\n | Adres A | 0436 111 22 33', now, ctx).ok, false);
  assert.equal(parseRosterMessage('Muş\nEczane A |  | 0436 111 22 33', now, ctx).ok, false);
  assert.equal(parseRosterMessage('Muş\nEczane A | Adres A | ', now, ctx).ok, false);
  assert.equal(parseRosterMessage('Muş\nEczane A | Adres A | 0436ABC', now, ctx).ok, false);
});

test('webhook secret verifier rejects missing, wrong and different-length values', () => {
  assert.equal(verifyWebhookSecret('expected-secret', null), false);
  assert.equal(verifyWebhookSecret('expected-secret', ''), false);
  assert.equal(verifyWebhookSecret('expected-secret', 'wrong-secret'), false);
  assert.equal(verifyWebhookSecret('long-secret', 'short'), false);
  assert.equal(verifyWebhookSecret('expected-secret', 'expected-secret'), true);
});

test('unlinked chats only accept a six-digit baglan code', () => {
  assert.equal(decideTelegramAction({ linkedChatId: null, incomingChatId: '10', text: 'Merhaba' }), 'ignore');
  assert.equal(decideTelegramAction({ linkedChatId: null, incomingChatId: '10', text: '/baglan 123456' }), 'link');
  assert.equal(decideTelegramAction({ linkedChatId: null, incomingChatId: '10', text: '/baglan abcdef' }), 'ignore');
});

test('linked chat confirmation and cancellation ignore Turkish case', () => {
  const base = { linkedChatId: '10', incomingChatId: '10' };
  assert.equal(decideTelegramAction({ ...base, text: 'onay' }), 'confirm');
  assert.equal(decideTelegramAction({ ...base, text: 'İptal' }), 'cancel');
  assert.equal(decideTelegramAction({ ...base, text: 'Muş\nEczane A | Adres A | 0436 111 22 33' }), 'parse');
});

test('messages from a different chat are ignored even if a link exists', () => {
  assert.equal(decideTelegramAction({ linkedChatId: '10', incomingChatId: '11', text: 'ONAY' }), 'ignore');
});
