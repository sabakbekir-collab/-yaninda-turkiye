import test from "node:test";
import assert from "node:assert/strict";
import { activeDutyDates, dutyDateKey, isActiveDutyDate, dutyRowAllowed } from "../functions/lib/dutyDates.ts";
test("night duty keeps yesterday active until 09:00 Istanbul time", () => {
  assert.deepEqual(activeDutyDates(new Date("2026-11-04T05:59:00Z")), ["2026-11-04", "2026-11-03"]);
  assert.deepEqual(activeDutyDates(new Date("2026-11-04T06:00:00Z")), ["2026-11-04"]);
  assert.equal(isActiveDutyDate("2026-11-03", new Date("2026-11-04T05:59:00Z")), true);
});
test("date-only and Turkish day-month-year formats are normalised", () => {
  assert.equal(dutyDateKey("2026-11-05"), "2026-11-05");
  assert.equal(dutyDateKey("05.11.2026"), "2026-11-05");
  assert.equal(dutyDateKey("5/11/2026"), "2026-11-05");
});
test("ISO timestamps are converted to Istanbul calendar day", () => {
  assert.equal(dutyDateKey("2026-11-04T22:30:00Z"), "2026-11-05");
  assert.equal(dutyDateKey("2026-11-05T01:00:00+03:00"), "2026-11-05");
});
test("epoch seconds and milliseconds are supported", () => {
  assert.equal(dutyDateKey(1793836800), "2026-11-05");
  assert.equal(dutyDateKey(1793836800000), "2026-11-05");
});
test("invalid and impossible dates are rejected", () => {
  assert.equal(dutyDateKey("31.02.2026"), null);
  assert.equal(dutyDateKey("2026-13-01"), null);
  assert.equal(dutyDateKey("2026-02-31T12:00:00Z"), null);
  assert.equal(dutyDateKey("2026-04-31T12:00:00+03:00"), null);
  assert.equal(dutyDateKey("not-a-date"), null);
  assert.equal(dutyDateKey({ date: "2026-11-05" }), null);
});
test("active duty checks use supplied clock deterministically", () => {
  const now = new Date("2026-11-04T05:00:00Z");
  assert.equal(isActiveDutyDate("2026-11-03", now), false);
  assert.equal(isActiveDutyDate("2026-11-04", now), true);
  assert.equal(isActiveDutyDate("2026-11-02", now), false);
});

test("duty row requires an active feed date and an active row date", () => {
  const beforeNine = new Date("2026-11-09T05:00:00Z");
  const atNine = new Date("2026-11-09T06:00:00Z");
  assert.equal(dutyRowAllowed("2026-11-08", "2026-11-08", beforeNine), true);
  assert.equal(dutyRowAllowed("2026-11-09", "2026-11-09", beforeNine), true);
  assert.equal(dutyRowAllowed("2026-11-08", "2026-11-08", atNine), false);
  assert.equal(dutyRowAllowed("2026-11-09", "2026-11-09", atNine), true);
  assert.equal(dutyRowAllowed("2026-11-09", null, beforeNine), false);
  assert.equal(dutyRowAllowed(null, "2026-11-09", beforeNine), false);
});
