import test from 'node:test';
import assert from 'node:assert/strict';
import { eventLabelFor } from '../src/adminRosterEvents.ts';

test('roster event names are displayed in Turkish, never as raw identifiers', () => {
  assert.equal(eventLabelFor('confirmed'), 'Liste yayımlandı');
  assert.equal(eventLabelFor('preview'), 'Önizleme gönderildi');
  assert.equal(eventLabelFor('error'), 'İşlem hatası');
  assert.equal(eventLabelFor('cancelled'), 'İşlem iptal edildi');
  assert.equal(eventLabelFor('linked'), 'Telegram hesabı bağlandı');
  assert.equal(eventLabelFor('reminder'), 'Hatırlatma gönderildi');
  assert.equal(eventLabelFor('unknown_raw_event'), 'Bilinmeyen olay');
});