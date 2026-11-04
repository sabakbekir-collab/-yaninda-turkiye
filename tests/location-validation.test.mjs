import test from "node:test";
import assert from "node:assert/strict";
import { parseTurkeyCoordinates } from "../functions/lib/locationValidation.ts";
test("valid Turkish coordinates are accepted and converted to numbers", () => {
  assert.deepEqual(parseTurkeyCoordinates("38.7432", "41.5064"), { latitude: 38.7432, longitude: 41.5064 });
});
test("missing, malformed, and out-of-country coordinates are rejected", () => {
  assert.equal(parseTurkeyCoordinates(undefined, "41.5"), null);
  assert.equal(parseTurkeyCoordinates("", "41.5"), null);
  assert.equal(parseTurkeyCoordinates("NaN", "41.5"), null);
  assert.equal(parseTurkeyCoordinates("51.5", "-0.1"), null);
  assert.equal(parseTurkeyCoordinates("38.7", "181"), null);
});
