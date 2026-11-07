import test from "node:test";
import assert from "node:assert/strict";
import { needsGpsRequest } from "../src/searchPlan.ts";

test("needsGpsRequest requests GPS only for an explicit user action", () => {
  assert.equal(needsGpsRequest({ userInitiated: true, manualAreaChosen: false }), true);
  assert.equal(needsGpsRequest({ userInitiated: false, manualAreaChosen: false }), false);
  assert.equal(needsGpsRequest({ userInitiated: true, manualAreaChosen: true }), false);
});

test("needsGpsRequest never requests GPS when the user selected an area", () => {
  for (const userInitiated of [true, false]) {
    assert.equal(needsGpsRequest({ userInitiated, manualAreaChosen: true }), false);
  }
});
