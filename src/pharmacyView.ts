import type { Place } from "./types";

export function splitPharmacyPlaces(places: Place[]): { duty: Place[]; nearby: Place[] } {
  return {
    duty: places.filter((place) => place.isDuty === true),
    nearby: places.filter((place) => place.isDuty !== true).map((place) => ({ ...place, isDuty: false })),
  };
}

export function showDutyCount(count: number | null | undefined): boolean {
  return typeof count === "number" && Number.isInteger(count) && count > 0;
}
