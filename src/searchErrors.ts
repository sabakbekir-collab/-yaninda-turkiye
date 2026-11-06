export function locationValidationErrorMessage(code: string): string | null {
  if (code === "invalid_coordinates" || code === "invalid_anchor_or_coordinates" || code === "gps_coordinates_required") {
    return "Konum bilgisi geçersiz, lütfen konumu yeniden alın.";
  }
  return null;
}


/**
 * Maps a failed /api/places response to a user-facing message for location
 * validation errors only. Returns null for every other case so the caller's
 * other error flows (geocode failure, duty-pharmacy messages, ...) stay intact.
 */
export function mapPlacesError(status: number, data: unknown): string | null {
  if (status !== 400 || !data || typeof data !== "object" || !("error" in data)) return null;
  const code = (data as { error?: unknown }).error;
  return typeof code === "string" ? locationValidationErrorMessage(code) : null;
}
