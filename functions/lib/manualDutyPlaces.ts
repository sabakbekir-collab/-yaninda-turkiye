import type { Env, Place } from './types';
import { currentManualDutyRows } from './telegramD1Store.ts';
import { manualDutyDistrictNote, manualDutyPlaceFor, selectManualDutyRows } from './manualDuty.ts';

export async function currentManualDutyPlaces(
  env: Env,
  provinceSlug: string,
  district: string,
  dutyDate: string,
): Promise<{ places: Place[]; districtFallback: boolean } | null> {
  const rows = await currentManualDutyRows(env, provinceSlug, dutyDate);
  if (!rows.length) return null;
  const selected = selectManualDutyRows(rows, district);
  const note = manualDutyDistrictNote(selected.districtFallback);
  return {
    places: selected.rows.map(row => ({
      ...manualDutyPlaceFor(row),
      verifiedAt: row.duty_date,
      dutyNote: note || undefined,
    })),
    districtFallback: selected.districtFallback,
  };
}
