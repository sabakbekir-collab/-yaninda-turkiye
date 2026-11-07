import test from "node:test";
import assert from "node:assert/strict";
import { needsGpsRequest } from "../src/searchPlan.ts";

test("needsGpsRequest silently reads GPS only when permission is already granted and no position exists", () => {
  assert.equal(needsGpsRequest({ permissionState: "granted", hasPosition: false, manualAreaChosen: false }), true);
  assert.equal(needsGpsRequest({ permissionState: "prompt", hasPosition: false, manualAreaChosen: false }), false);
  assert.equal(needsGpsRequest({ permissionState: "denied", hasPosition: false, manualAreaChosen: false }), false);
  assert.equal(needsGpsRequest({ permissionState: "unknown", hasPosition: false, manualAreaChosen: false }), false);
  assert.equal(needsGpsRequest({ permissionState: "unsupported", hasPosition: false, manualAreaChosen: false }), false);
});

test("needsGpsRequest does not override an existing position or a manual area choice", () => {
  assert.equal(needsGpsRequest({ permissionState: "granted", hasPosition: true, manualAreaChosen: false }), false);
  assert.equal(needsGpsRequest({ permissionState: "granted", hasPosition: false, manualAreaChosen: true }), false);
});

test("an explicit location-button action can force a fresh GPS request", () => {
  assert.equal(needsGpsRequest({ permissionState: "denied", hasPosition: false, manualAreaChosen: true, force: true }), true);
});
