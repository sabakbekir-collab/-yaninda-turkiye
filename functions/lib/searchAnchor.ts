export type SearchAnchor = 'gps' | 'area' | 'legacy';
export type SearchCenterInput = {
  anchor: SearchAnchor;
  hasPosition: boolean;
  lat: number;
  lon: number;
  capital: { lat: number; lon: number } | null;
  province: string;
  district: string;
  geocode?: { lat: number; lon: number } | null;
};
export type SearchCenter = { lat: number; lon: number; source: 'gps' | 'capital' | 'geocode' };

export function resolveSearchAnchor(raw: string | null, hasLat: boolean, hasLon: boolean): SearchAnchor | null {
  if (hasLat !== hasLon) return null;
  if (raw === null) return 'legacy';
  return raw === 'gps' || raw === 'area' ? raw : null;
}

/**
 * Picks the coordinates a nearby search is centred on.
 *
 * `capital` must be non-null only when the caller has already decided the
 * request is province-wide / central-district (places.ts uses isWholeProvince,
 * which folds case and diacritics). This function trusts that and does not
 * repeat the check with different string rules.
 */
export function chooseSearchCenter(input: SearchCenterInput): SearchCenter | null {
  const { anchor, hasPosition, lat, lon, capital, geocode } = input;
  if (anchor === 'gps') return hasPosition ? { lat, lon, source: 'gps' } : null;
  if (capital && (anchor === 'area' || anchor === 'legacy')) return { ...capital, source: 'capital' };
  if (anchor === 'area' || !hasPosition) return geocode ? { ...geocode, source: 'geocode' } : null;
  return { lat, lon, source: 'gps' };
}

export function placesCacheKey(category: string, anchor: SearchAnchor, ...parts: string[]): string {
  return 'places:v19:' + [category, anchor, ...parts].join(':');
}
