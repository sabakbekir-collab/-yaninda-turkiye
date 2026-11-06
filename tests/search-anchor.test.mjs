import test from "node:test";
import assert from "node:assert/strict";
import { resolveSearchAnchor } from "../functions/api/places.ts";

test("explicit GPS anchor is preserved for province-wide labels", () => {
  assert.equal(resolveSearchAnchor("gps", true, true), "gps");
  // A resolved district label such as Muş / Merkez must not silently turn GPS into area mode.
  assert.equal(resolveSearchAnchor("gps", true, true), "gps");
});

test("manual area anchor stays distinct from GPS even when coordinates are supplied", () => {
  assert.equal(resolveSearchAnchor("area", true, true), "area");
  assert.notEqual(resolveSearchAnchor("gps", true, true), resolveSearchAnchor("area", true, true));
});

test("legacy clients retain the legacy decision and invalid coordinate pairs are rejected", () => {
  assert.equal(resolveSearchAnchor(null, true, true), "legacy");
  assert.equal(resolveSearchAnchor(null, false, false), "legacy");
  assert.equal(resolveSearchAnchor(null, true, false), null);
  assert.equal(resolveSearchAnchor("gps", true, false), null);
  assert.equal(resolveSearchAnchor("area", false, true), null);
});

test("unknown anchor values are rejected", () => {
  assert.equal(resolveSearchAnchor("device", true, true), null);
  assert.equal(resolveSearchAnchor("", false, false), null);
});
