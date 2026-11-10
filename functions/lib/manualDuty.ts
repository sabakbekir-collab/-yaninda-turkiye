import { trSlug } from '../../src/text.ts';

export function sourceLabelFor(_provinceSlug: string): string {
  return 'Elle girildi';
}

export function manualDutySourceFor(provinceSlug: string): string {
  return sourceLabelFor(provinceSlug);
}

export function selectManualDutyRows<T extends { district_slug: string }>(rows: readonly T[], selectedDistrict: string): { rows: T[]; districtFallback: boolean } {
  if (!selectedDistrict) return { rows: rows.slice(), districtFallback: false };
  const district = trSlug(selectedDistrict);
  const districtRows = rows.filter(row => row.district_slug && trSlug(row.district_slug) === district);
  const provinceRows = rows.filter(row => !row.district_slug);
  return { rows: [...provinceRows, ...districtRows], districtFallback: districtRows.length === 0 };
}

export function manualDutyDistrictNote(districtFallback: boolean): string | null {
  return districtFallback ? 'Seçili ilçe için kayıt yok; diğer ilçelerin kayıtları gösterilmiyor.' : null;
}

export function manualDutyPlaceFor(row: { id: string | number; province_slug: string; district_slug: string; name: string; address: string; phone: string; duty_note?: string | null }) {
  return {
    id: 'manual-duty-' + row.id,
    name: row.name,
    category: 'pharmacy',
    source: manualDutySourceFor(row.province_slug),
    coordsUnknown: true,
    dutyNote: row.duty_note || undefined,
    address: row.address,
    phone: row.phone,
    district: row.district_slug || undefined,
    isDuty: true,
  };
}