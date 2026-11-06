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


import { mapPlacesError } from "../src/searchErrors.ts";

const LOCATION_MESSAGE = "Konum bilgisi geçersiz, lütfen konumu yeniden alın.";

test("mapPlacesError: 400 + invalid_coordinates gives the location message", () => {
  assert.equal(mapPlacesError(400, { error: "invalid_coordinates" }), LOCATION_MESSAGE);
});

test("mapPlacesError: 400 + gps_coordinates_required gives the location message", () => {
  assert.equal(mapPlacesError(400, { error: "gps_coordinates_required" }), LOCATION_MESSAGE);
});

test("mapPlacesError: 400 + unknown error code is not handled here", () => {
  assert.equal(mapPlacesError(400, { error: "something_else" }), null);
});

test("mapPlacesError: 503 + location_geocode_failed keeps its separate message flow", () => {
  assert.equal(mapPlacesError(503, { error: "location_geocode_failed" }), null);
});

test("mapPlacesError: 200 and malformed payloads give null", () => {
  assert.equal(mapPlacesError(200, { error: "invalid_coordinates" }), null);
  assert.equal(mapPlacesError(400, undefined), null);
  assert.equal(mapPlacesError(400, null), null);
  assert.equal(mapPlacesError(400, "invalid_coordinates"), null);
  assert.equal(mapPlacesError(400, { error: 42 }), null);
});
