import test from "node:test";
import assert from "node:assert/strict";
import { needsGpsRequest, accuracyWarning } from "../src/searchPlan.ts";
import { haversineKm, resolveDistanceOrigin, countRecordsNearAnother } from "../functions/lib/geoDistance.ts";

test("a user gesture requests GPS when no position exists and permission is prompt or granted", () => {
  assert.equal(needsGpsRequest({ pos: undefined, permission: "prompt", userGesture: true }), true);
  assert.equal(needsGpsRequest({ pos: undefined, permission: "granted", userGesture: true }), true);
  assert.equal(needsGpsRequest({ pos: undefined, permission: "denied", userGesture: true }), false);
  assert.equal(needsGpsRequest({ pos: undefined, permission: "unsupported", userGesture: true }), false);
  assert.equal(needsGpsRequest({ pos: undefined, permission: "prompt", userGesture: false }), false);
  assert.equal(needsGpsRequest({ pos: { lat: 38.74, lon: 41.50 }, permission: "prompt", userGesture: true }), false);
});

test("accuracy warning is shown only above 150 metres", () => {
  assert.equal(accuracyWarning(150), null);
  assert.equal(accuracyWarning(151), "Konum doğruluğu düşük (±151 m)");
  assert.equal(accuracyWarning(undefined), null);
  assert.equal(accuracyWarning(Number.NaN), null);
});

test("haversine distance for the known Muş coordinate pair is within one percent", () => {
  const actual = haversineKm(38.7432, 41.5064, 38.7404, 41.4957);
  const expected = 0.9788380327692372;
  assert.ok(Math.abs(actual - expected) / expected <= 0.01, `expected about ${expected} km, got ${actual}`);
});

test("GPS distance origin is the exact client coordinate, not the area centre", () => {
  const client = { lat: 38.7432, lon: 41.5064 };
  const area = { lat: 38.7432, lon: 41.5064 };
  const result = resolveDistanceOrigin("gps", client, area);
  assert.deepEqual(result, client);
  assert.equal(haversineKm(result.lat, result.lon, 38.7404, 41.4957), haversineKm(client.lat, client.lon, 38.7404, 41.4957));
});

test("area searches use their area centre when GPS is not selected", () => {
  const client = { lat: 38.7432, lon: 41.5064 };
  const area = { lat: 38.7500, lon: 41.5000 };
  assert.deepEqual(resolveDistanceOrigin("area", client, area), area);
});

test("25m proximity measurement counts neighbouring records without removing duplicates", () => {
  const points = [
    { lat: 38.7432, lon: 41.5064 },
    { lat: 38.7432, lon: 41.5065 },
    { lat: 38.7500, lon: 41.5064 },
    { lat: 38.7501, lon: 41.5064 },
  ];
  assert.deepEqual(countRecordsNearAnother(points, 25), { recordsWithNeighbour: 4, closePairs: 2 });
});
