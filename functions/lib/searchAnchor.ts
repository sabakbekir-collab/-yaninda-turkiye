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

export function chooseSearchCenter(input: SearchCenterInput): SearchCenter | null {
  const { anchor, hasPosition, lat, lon, capital, geocode, province, district } = input;
  const wholeProvince = !district || district.toLocaleLowerCase('tr-TR') === 'merkez' ||
    district.toLocaleLowerCase('tr-TR') === province.toLocaleLowerCase('tr-TR') ||
    district.toLocaleLowerCase('tr-TR') === 'tüm ilçeler';
  const useCapital = Boolean(capital) && wholeProvince && (anchor === 'area' || anchor === 'legacy');
  if (anchor === 'gps') return hasPosition ? { lat, lon, source: 'gps' } : null;
  if (useCapital && capital) return { ...capital, source: 'capital' };
  if (anchor === 'legacy' && hasPosition && wholeProvince) return capital ? { ...capital, source: 'capital' } : { lat, lon, source: 'gps' };
  if (anchor === 'area' || !hasPosition) return geocode ? { ...geocode, source: 'geocode' } : null;
  return { lat, lon, source: 'gps' };
}

export function placesCacheKey(category: string, anchor: SearchAnchor, ...parts: string[]): string {
  return 'places:v18:' + [category, anchor, ...parts].join(':');
}
