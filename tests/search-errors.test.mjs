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

import { shouldShowNoResults } from "../src/searchErrors.ts";

test("only a successful zero-result response displays the no-records state", () => {
  assert.equal(shouldShowNoResults(0, ""), true);
  assert.equal(shouldShowNoResults(0, "Harita veri sağlayıcıları şu anda yanıt vermiyor."), false);
  assert.equal(shouldShowNoResults(2, ""), false);
});


import { choosePlan, distanceBasisLabel, shouldShowEmpty } from "../src/searchPlan.ts";

test("choosePlan uses GPS unless the user manually changed the selected area", () => {
  const pos = { lat: 38.74, lon: 41.50 };
  assert.deepEqual(choosePlan({ pos, province: "Muş", district: "Merkez", manualAreaChosen: false }), { anchor: "gps", usePos: true });
  assert.deepEqual(choosePlan({ pos, province: "Muş", district: "Merkez", manualAreaChosen: true }), { anchor: "area", usePos: false });
  assert.deepEqual(choosePlan({ pos: undefined, province: "Muş", district: "Merkez", manualAreaChosen: false }), { anchor: "area", usePos: false });
  assert.deepEqual(choosePlan({ pos: undefined, province: "", district: "", manualAreaChosen: false }), { anchor: "area", usePos: false });
});

test("distanceBasisLabel explains the actual measurement anchor", () => {
  assert.equal(distanceBasisLabel("gps", "Muş / Merkez"), "Konumuna göre, kuş uçuşu");
  assert.equal(distanceBasisLabel("area", "Muş / Merkez"), "Muş / Merkez merkezine göre, kuş uçuşu");
});

test("empty state is shown only for a completed zero-result search of the current category", () => {
  assert.equal(shouldShowEmpty({ status: "success", forCategory: "atm", currentCategory: "atm", resultCount: 0 }), true);
  assert.equal(shouldShowEmpty({ status: "loading", forCategory: "atm", currentCategory: "atm", resultCount: 0 }), false);
  assert.equal(shouldShowEmpty({ status: "success", forCategory: "atm", currentCategory: "fuel", resultCount: 0 }), false);
  assert.equal(shouldShowEmpty({ status: "error", forCategory: "atm", currentCategory: "atm", resultCount: 0 }), false);
  assert.equal(shouldShowEmpty({ status: "success", forCategory: "atm", currentCategory: "atm", resultCount: 2 }), false);
});


import { shouldRerunWithGps, resultsForCategory } from "../src/searchPlan.ts";

test("GPS arrival reruns an area search exactly once unless the user chose an area", () => {
  const base = { gpsArrived: true, lastAnchor: "area", manualAreaChosen: false, hasSearched: true, alreadyRerun: false };
  assert.equal(shouldRerunWithGps({ ...base, gpsArrived: false }), false);
  assert.equal(shouldRerunWithGps({ ...base, lastAnchor: "gps" }), false);
  assert.equal(shouldRerunWithGps({ ...base, manualAreaChosen: true }), false);
  assert.equal(shouldRerunWithGps({ ...base, hasSearched: false }), false);
  assert.equal(shouldRerunWithGps({ ...base, alreadyRerun: true }), false);
  assert.equal(shouldRerunWithGps(base), true);
});

test("resultsForCategory hides results belonging to a different category", () => {
  const places = [{ id: "atm-1" }, { id: "atm-2" }];
  assert.deepEqual(resultsForCategory(places, "atm", "pharmacy"), []);
  assert.deepEqual(resultsForCategory(places, "atm", "atm"), places);
});
