import { districtMap, districtsFor } from "../../src/turkeyDistricts.ts";
import { trSlug } from "../../src/text.ts";
import type { RosterContext } from "../lib/telegramRoster";

export function buildRosterContext(): RosterContext {
  const provinceNames = Object.keys(districtMap);
  if (provinceNames.length !== 81) throw new Error("roster_province_count_invalid");
  const provinceSlugs = provinceNames.map(trSlug);
  const districtsByProvince: Record<string, readonly string[]> = {};
  for (const province of provinceNames) {
    const slug = trSlug(province);
    const districts = districtsFor(province);
    if (!slug || districts.length === 0) throw new Error("roster_province_districts_invalid");
    districtsByProvince[slug] = districts.slice();
  }
  return { provinceSlugs, provinceNames: Object.fromEntries(provinceNames.map(name => [trSlug(name), name])), districtsByProvince, slugify: trSlug };
}
