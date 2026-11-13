import test from "node:test";
import assert from "node:assert/strict";
import { parsePragmaOutput } from "../scripts/live/parse-pragma.mjs";

const rows = [
  { cid: 0, name: "id", type: "INTEGER" },
  { cid: 1, name: "type", type: "TEXT" },
  { cid: 2, name: "metadata", type: "TEXT" },
  { cid: 3, name: "city", type: "TEXT" },
  { cid: 4, name: "created_at", type: "TEXT" },
];

test("remote Wrangler array envelope: table and column present", () => {
  assert.equal(parsePragmaOutput(JSON.stringify([{ results: rows, success: true }]), "city"), true);
});

test("local Wrangler object envelope: table and column present", () => {
  assert.equal(parsePragmaOutput(JSON.stringify({ results: rows, success: true }), "created_at"), true);
});

test("both Wrangler envelope forms report a missing column without parser failure", () => {
  assert.equal(parsePragmaOutput(JSON.stringify([{ results: rows, success: true }]), "missing"), false);
  assert.equal(parsePragmaOutput(JSON.stringify({ results: rows, success: true }), "missing"), false);
});

test("malformed JSON is a hard parser error", () => {
  assert.throws(() => parsePragmaOutput("{not-json", "id"), /ayrıştırılamadı/);
});

test("empty output is a hard parser error", () => {
  assert.throws(() => parsePragmaOutput("  ", "id"), /boş/);
});

test("missing results field is a hard parser error", () => {
  assert.throws(() => parsePragmaOutput(JSON.stringify([{ success: true }]), "id"), /results alanı/);
});
