import test from 'node:test';
import assert from 'node:assert/strict';
import { selectManualDutyRows, manualDutyDistrictNote } from '../functions/lib/manualDuty.ts';

const rows = [
  { id: 'province', district_slug: '', name: 'İl Geneli Eczanesi' },
  { id: 'varto', district_slug: 'varto', name: 'Varto Eczanesi' },
  { id: 'merkez', district_slug: 'merkez', name: 'Merkez Eczanesi' },
];

test('Varto shows its district records and province-wide records', () => {
  const result = selectManualDutyRows(rows, 'varto');
  assert.deepEqual(result.rows.map(row => row.id), ['province', 'varto']);
  assert.equal(result.districtFallback, false);
  assert.equal(manualDutyDistrictNote(result.districtFallback), null);
});

test('Bulanık shows province-wide records but excludes records from other districts', () => {
  const result = selectManualDutyRows(rows, 'bulanik');
  assert.deepEqual(result.rows.map(row => row.id), ['province']);
  assert.equal(result.districtFallback, true);
  assert.equal(manualDutyDistrictNote(result.districtFallback), 'Seçili ilçe için kayıt yok; diğer ilçelerin kayıtları gösterilmiyor.');
});

test('no selected district shows all rows without a fallback note', () => {
  const result = selectManualDutyRows(rows, '');
  assert.deepEqual(result.rows, rows);
  assert.equal(result.districtFallback, false);
  assert.equal(manualDutyDistrictNote(result.districtFallback), null);
});