import test from "node:test";
import assert from "node:assert/strict";
import { chooseSearchCenter, placesCacheKey, resolveSearchAnchor } from "../functions/lib/searchAnchor.ts";
import { parseTurkeyCoordinates } from "../functions/lib/locationValidation.ts";

const capital = { lat: 38.7432, lon: 41.5064 };
const gps = { lat: 38.7432, lon: 41.5235 }; // Muş merkezden yaklaşık 1,5 km doğuda

test("REGRESSION: explicit GPS at Muş Merkez stays at device coordinates", () => {
  // Before the fix, province-wide/Merkez selection replaced this GPS point with capital.
  // The previous implementation's effective output was {lat: capital.lat, lon: capital.lon}.
  const result = chooseSearchCenter({
    anchor: "gps", hasPosition: true, ...gps, capital, province: "Muş", district: "Merkez",
  });
  assert.deepEqual(result, { ...gps, source: "gps" });
  assert.notDeepEqual({ lat: capital.lat, lon: capital.lon }, { lat: result.lat, lon: result.lon });
});

test("explicit area + Merkez uses provincial capital even if GPS was sent", () => {
  assert.deepEqual(chooseSearchCenter({
    anchor: "area", hasPosition: true, ...gps, capital, province: "Muş", district: "Merkez",
  }), { ...capital, source: "capital" });
});

test("explicit area + Varto uses geocoded district centre", () => {
  const geocode = { lat: 39.17, lon: 41.45 };
  assert.deepEqual(chooseSearchCenter({
    anchor: "area", hasPosition: true, ...gps, capital: null, province: "Muş", district: "Varto", geocode,
  }), { ...geocode, source: "geocode" });
});

test("legacy whole-province + GPS temporarily preserves historical capital behavior", () => {
  assert.deepEqual(chooseSearchCenter({
    anchor: "legacy", hasPosition: true, ...gps, capital, province: "Muş", district: "",
  }), { ...capital, source: "capital" });
});

test("half coordinates and coordinates outside Türkiye are rejected", () => {
  assert.equal(resolveSearchAnchor("gps", true, false), null);
  assert.equal(resolveSearchAnchor("gps", false, true), null);
  assert.equal(parseTurkeyCoordinates("38.7432", ""), null);
  assert.equal(parseTurkeyCoordinates("51.5072", "-0.1276"), null);
  assert.deepEqual(parseTurkeyCoordinates("38.7432", "41.5064"), { latitude: 38.7432, longitude: 41.5064 });
});

test("anchor participates in the cache key for otherwise identical searches", () => {
  const gpsKey = placesCacheKey("atm", "gps", "38.7432", "41.5064", "Muş", "Merkez");
  const areaKey = placesCacheKey("atm", "area", "38.7432", "41.5064", "Muş", "Merkez");
  assert.notEqual(gpsKey, areaKey);
  assert.match(gpsKey, /:gps:/);
  assert.match(areaKey, /:area:/);
});

test("invalid anchor and unmatched coordinate pairs are rejected", () => {
  assert.equal(resolveSearchAnchor("device", true, true), null);
  assert.equal(resolveSearchAnchor("", false, false), null);
  assert.equal(resolveSearchAnchor(null, true, false), null);
  assert.equal(resolveSearchAnchor(null, false, false), "legacy");
});


// places.ts passes `capital` only when isWholeProvince(district, province) is true
// (it folds diacritics/case, e.g. "MUS" === "Muş"). chooseSearchCenter must trust
// that and must not repeat the check with different string rules.
test("a supplied capital is authoritative: diacritic/case variants of the province name still use it", () => {
  assert.deepEqual(chooseSearchCenter({
    anchor: "area", hasPosition: true, ...gps, capital, province: "Muş", district: "MUS",
  }), { ...capital, source: "capital" });
  assert.deepEqual(chooseSearchCenter({
    anchor: "legacy", hasPosition: true, ...gps, capital, province: "Muş", district: "Mus",
  }), { ...capital, source: "capital" });
});

test("without a capital, legacy keeps GPS and area asks for a geocode", () => {
  assert.deepEqual(chooseSearchCenter({
    anchor: "legacy", hasPosition: true, ...gps, capital: null, province: "Muş", district: "Varto",
  }), { ...gps, source: "gps" });
  assert.equal(chooseSearchCenter({
    anchor: "area", hasPosition: true, ...gps, capital: null, province: "Muş", district: "Varto",
  }), null);
});
