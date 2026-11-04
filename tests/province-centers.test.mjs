import test from "node:test";
import assert from "node:assert/strict";
import { provinceCenter, isWholeProvince } from "../functions/lib/provinceCenters.ts";

test("Muş province-wide searches use the city centre", () => {
  assert.deepEqual(provinceCenter("Muş"), { lat: 38.7432, lon: 41.5064 });
});

test("province aliases resolve to their canonical capital", () => {
  assert.deepEqual(provinceCenter("maras"), provinceCenter("Kahramanmaraş"));
  assert.deepEqual(provinceCenter("izmit"), provinceCenter("Kocaeli"));
});

test("whole-province selection is distinguished from a named district", () => {
  assert.equal(isWholeProvince("Tüm ilçeler", "Muş"), true);
  assert.equal(isWholeProvince("Merkez", "Muş"), true);
  assert.equal(isWholeProvince("Varto", "Muş"), false);
});

test("unknown province names do not invent coordinates", () => {
  assert.equal(provinceCenter("Bilinmeyen İl"), null);
});
