export type Coordinates = { lat: number; lon: number };

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function resolveDistanceOrigin(anchor: "gps" | "area", client: Coordinates, area: Coordinates): Coordinates {
  return anchor === "gps" ? client : area;
}
