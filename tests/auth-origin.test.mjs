import test from "node:test";
import assert from "node:assert/strict";
import { strictSameOrigin } from "../functions/lib/auth.ts";

const url = "https://yaninda.example/api/admin";

test("strict same-origin rejects a POST with no Origin and no Fetch Metadata", () => {
  const request = new Request(url, { method: "POST" });
  assert.equal(strictSameOrigin(request), false);
});

test("strict same-origin accepts an exact same-origin Origin", () => {
  const request = new Request(url, { method: "POST", headers: { Origin: "https://yaninda.example" } });
  assert.equal(strictSameOrigin(request), true);
});

test("strict same-origin rejects a hostile Origin", () => {
  const request = new Request(url, { method: "POST", headers: { Origin: "https://attacker.example" } });
  assert.equal(strictSameOrigin(request), false);
});

test("strict same-origin accepts missing Origin only with Sec-Fetch-Site same-origin", () => {
  const request = new Request(url, { method: "POST", headers: { "Sec-Fetch-Site": "same-origin" } });
  assert.equal(strictSameOrigin(request), true);
});

test("strict same-origin rejects cross-site Fetch Metadata without Origin", () => {
  const request = new Request(url, { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } });
  assert.equal(strictSameOrigin(request), false);
});

test("strict same-origin rejects malformed Origin", () => {
  const request = new Request(url, { method: "POST", headers: { Origin: "not a URL" } });
  assert.equal(strictSameOrigin(request), false);
});
