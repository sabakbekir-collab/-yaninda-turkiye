export type TurkpidyaRow = { name: string; address?: string; phone?: string; district?: string; dutyDate: string; hasCoords: boolean; lat?: number; lon?: number; id: string };
export type TurkpidyaResult = { rows: TurkpidyaRow[]; date?: string; reason?: 'stale_duty_list' | 'no_current_duty_records' };

export function parseTurkpidya(body: unknown, citySlug: string, districtSlug: string, now: Date, slugify: (s: string) => string, activeKeys: string[], toKey: (v: unknown) => string | null): TurkpidyaResult {
  const root = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const dutyDates = root.duty_dates && typeof root.duty_dates === 'object' && !Array.isArray(root.duty_dates) ? root.duty_dates as Record<string, unknown> : {};
  const feedValue = root.duty_date ?? dutyDates[citySlug] ?? root.date ?? root.rosterDate ?? root.tarih;
  const feedDate = toKey(feedValue) || undefined;
  const pharmacies = Array.isArray(root.pharmacies) ? root.pharmacies : Array.isArray(body) ? body : [];
  const feedIsActive = Boolean(feedDate && activeKeys.includes(feedDate));
  if (!feedIsActive) return { rows: [], date: feedDate, reason: 'stale_duty_list' };
  const rows: TurkpidyaRow[] = [];
  const seen = new Set<string>();
  for (const [index, value] of pharmacies.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    const address = typeof row.address === 'string' && row.address.trim() ? row.address.trim() : undefined;
    const phone = typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : undefined;
    const rowDate = toKey(row.duty_date ?? row.dutyDate ?? feedDate);
    if (!rowDate || !activeKeys.includes(rowDate)) continue;
    if (row.source_state !== undefined && row.source_state !== 'current') continue;
    const city = typeof row.city === 'string' ? row.city : '';
    if (slugify(city) !== citySlug) continue;
    const rowDistrict = typeof (row.district ?? row.subDistrict) === 'string' ? String(row.district ?? row.subDistrict).trim() : '';
    if (districtSlug && slugify(rowDistrict) !== districtSlug) continue;
    const location = row.location && typeof row.location === 'object' && !Array.isArray(row.location) ? row.location as Record<string, unknown> : {};
    const number = (input: unknown) => input === null || input === undefined || input === '' ? NaN : Number(input);
    const lat = number(row.lat ?? row.latitude ?? location.lat);
    const lon = number(row.lng ?? row.lon ?? row.longitude ?? location.lng ?? location.lon);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && lat >= 35 && lat <= 43 && lon >= 25 && lon <= 46;
    const key = slugify(name) + '|' + slugify(address || '');
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: String(row.id ?? row.pharmacyId ?? row.pharmacy_id ?? index),
      name,
      ...(address ? { address } : {}),
      ...(phone ? { phone } : {}),
      ...(rowDistrict ? { district: rowDistrict } : {}),
      dutyDate: rowDate,
      hasCoords,
      ...(hasCoords ? { lat, lon } : {})
    });
  }
  rows.sort((a, b) => {
    if (a.hasCoords !== b.hasCoords) return a.hasCoords ? -1 : 1;
    return a.name.localeCompare(b.name, 'tr');
  });
  return rows.length ? { rows, date: feedDate } : { rows: [], date: feedDate, reason: 'no_current_duty_records' };
}
