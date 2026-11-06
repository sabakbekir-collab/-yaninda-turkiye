export function locationValidationErrorMessage(code: string): string | null {
  if (code === "invalid_coordinates" || code === "invalid_anchor_or_coordinates" || code === "gps_coordinates_required") {
    return "Konum bilgisi geçersiz, lütfen konumu yeniden alın.";
  }
  return null;
}
