import test from "node:test";
import assert from "node:assert/strict";
import { healthResponse } from "../functions/lib/health.ts";

test("health is healthy only when D1 exists and SELECT succeeds", async () => {
  const response = healthResponse(true, true, "test");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, database: true, commit: "test" });
});

test("health is unavailable when D1 binding is missing", async () => {
  const response = healthResponse(false, false, "test");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, database: false, error: "d1_not_bound", commit: "test" });
});

test("health is unavailable when the D1 query fails", async () => {
  const response = healthResponse(true, false, "test");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, database: false, error: "d1_unavailable", commit: "test" });
});
