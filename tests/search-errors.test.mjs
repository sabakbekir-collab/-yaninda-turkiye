import test from "node:test";
import assert from "node:assert/strict";
import { locationValidationErrorMessage } from "../src/searchErrors.ts";

test("invalid coordinate and anchor 400 errors use the location-specific message", () => {
  for (const code of ["invalid_coordinates", "invalid_anchor_or_coordinates", "gps_coordinates_required"]) {
    assert.equal(locationValidationErrorMessage(code), "Konum bilgisi geçersiz, lütfen konumu yeniden alın.");
  }
});

test("unrelated errors do not get the location-specific message", () => {
  assert.equal(locationValidationErrorMessage("duty_pharmacy_unavailable"), null);
  assert.equal(locationValidationErrorMessage("no_current_duty_records"), null);
});
