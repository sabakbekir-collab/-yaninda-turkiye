export function parseTurkeyCoordinates(latitude: unknown, longitude: unknown): { latitude: number; longitude: number } | null {
  if ((typeof latitude !== "string" && typeof latitude !== "number") ||
      (typeof longitude !== "string" && typeof longitude !== "number")) return null;
  if ((typeof latitude === "string" && !latitude.trim()) ||
      (typeof longitude === "string" && !longitude.trim())) return null;
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 35 || lat > 43 || lon < 25 || lon > 46) return null;
  return { latitude: lat, longitude: lon };
}
