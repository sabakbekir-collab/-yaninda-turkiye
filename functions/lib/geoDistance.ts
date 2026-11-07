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

export function countRecordsNearAnother(points: Coordinates[], withinMetres = 25): { recordsWithNeighbour: number; closePairs: number } {
  const limitKm = withinMetres / 1000;
  const matched = new Set<number>();
  let closePairs = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (haversineKm(points[i].lat, points[i].lon, points[j].lat, points[j].lon) <= limitKm) {
        matched.add(i);
        matched.add(j);
        closePairs += 1;
      }
    }
  }
  return { recordsWithNeighbour: matched.size, closePairs };
}
