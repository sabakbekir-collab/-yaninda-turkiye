import test from "node:test";
import assert from "node:assert/strict";
import { splitPharmacyPlaces, showDutyCount } from "../src/pharmacyView.ts";

const places = [
  { id: "duty-1", isDuty: true },
  { id: "nearby-1", isDuty: false },
  { id: "unknown-1" },
];

test("pharmacy sections keep duty and non-duty pharmacies separate", () => {
  const sections = splitPharmacyPlaces(places);
  assert.deepEqual(sections.duty.map((place) => place.id), ["duty-1"]);
  assert.deepEqual(sections.nearby.map((place) => place.id), ["nearby-1", "unknown-1"]);
  assert.ok(sections.nearby.every((place) => place.isDuty !== true));
});

test("duty count is hidden when zero and shown only for positive verified duty count", () => {
  assert.equal(showDutyCount(0), false);
  assert.equal(showDutyCount(1), true);
  assert.equal(showDutyCount(8), true);
});

test("empty and invalid counts never produce a zero badge", () => {
  assert.equal(showDutyCount(null), false);
  assert.equal(showDutyCount(undefined), false);
  assert.equal(showDutyCount(-1), false);
  assert.equal(showDutyCount(Number.NaN), false);
});
