import test from "node:test";
import assert from "node:assert/strict";
import { buildOverpassQuery } from "../src/osmQuery.ts";

test("ATM search includes common ATM and bank-with-ATM OpenStreetMap tagging schemes", () => {
  const query = buildOverpassQuery("atm", 38.7432, 41.5064, 5);
  assert.match(query, /amenity.*atm/);
  assert.match(query, /amenity.*bank.*atm.*yes/);
  assert.match(query, /atm.*yes/);
  assert.match(query, /atm.*designated/);
  assert.match(query, /around:5000,38\.7432,41\.5064/);
});
