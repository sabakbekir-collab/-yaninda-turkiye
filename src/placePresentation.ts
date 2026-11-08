export type PlacePresentationInput = { id?: string; name?: string; address?: string; lat?: number; lon?: number; coordsUnknown?: boolean; distance?: number };

export const TURKPIDYA_DUTY_SOURCE_URL = 'https://turkpidya.com/istanbul-duty-pharmacies/?utm_source=api&utm_medium=credit&utm_campaign=pharmacies';

export function placeDistancePresentation(place: PlacePresentationInput, distanceLabel?: string) {
  if (place.coordsUnknown || typeof place.distance !== 'number' || !Number.isFinite(place.distance)) return null;
  return { distance: place.distance, label: distanceLabel || 'Konumuna göre, kuş uçuşu' };
}

export function placeCanUseCoordinates(place: PlacePresentationInput): boolean {
  return place.coordsUnknown !== true;
}

export function placeDirectionsUrl(place: PlacePresentationInput): string {
  if (place.coordsUnknown) {
    const query = [place.name, place.address].filter(Boolean).join(' ').trim();
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }
  return 'https://www.google.com/maps/dir/?api=1&destination=' + place.lat + ',' + place.lon;
}

export function placeShareMapUrl(place: PlacePresentationInput): string {
  if (place.coordsUnknown) {
    const query = [place.name, place.address].filter(Boolean).join(' ').trim();
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }
  return 'https://www.google.com/maps/search/?api=1&query=' + place.lat + ',' + place.lon;
}

export function turkpidyaSourceLinkForPlaces(places: Array<{ id: string }>): string | null {
  return places.some(place => place.id.startsWith('turkpidya-duty-')) ? TURKPIDYA_DUTY_SOURCE_URL : null;
}
