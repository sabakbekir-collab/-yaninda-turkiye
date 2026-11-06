import test from "node:test";
import assert from "node:assert/strict";
import { formatOpeningHours } from "../src/openingHours.ts";

test("real ATM record preserves all known rules and flags skipped uncertainty",()=>{
  assert.deepEqual(formatOpeningHours(
    "Mo-Fr 09:00-12:30,13:30-17:00; Sa-Su off; PH off; PH eve 09:00-12:30",
    "atm"
  ),{
    label:"Şube saatleri",
    value:"Pzt-Cum 09:00-12:30, 13:30-17:00 · Cmt-Paz kapalı · Resmî tatillerde kapalı · Saatler eksik olabilir"
  });
});

test("comma-separated time ranges retain both intervals",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-12:30,13:30-17:00","bank"),{
    label:"Saatler",value:"Pzt-Cum 09:00-12:30, 13:30-17:00"
  });
});

test("public holiday eve rule is explicitly translated",()=>{
  assert.deepEqual(formatOpeningHours("PH eve 09:00-12:30","atm"),{
    label:"Şube saatleri",value:"Resmî tatil arifesi 09:00-12:30"
  });
});

test("comma-separated weekday lists are translated",()=>{
  assert.deepEqual(formatOpeningHours("Mo,We,Fr 09:00-17:00","bank"),{
    label:"Saatler",value:"Pzt, Çar, Cum 09:00-17:00"
  });
});

test("multiline rules preserve source order",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-18:00\nSa 10:00-14:00\nSu off","bank"),{
    label:"Saatler",value:"Pzt-Cum 09:00-18:00 · Cmt 10:00-14:00 · Paz kapalı"
  });
});

test("empty values return null",()=>{
  for(const value of [undefined,"","  ",";\n"])assert.equal(formatOpeningHours(value,"atm"),null);
});

test("malformed text is not displayed",()=>{
  assert.equal(formatOpeningHours("this is not an opening hours rule","atm"),null);
});

test("a single unknown rule is skipped without inventing a schedule",()=>{
  assert.equal(formatOpeningHours("PH maybe","atm"),null);
});

test("unknown rules do not hide known rules and add an uncertainty note",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-17:00; PH maybe","bank"),{
    label:"Saatler",value:"Pzt-Cum 09:00-17:00 · Saatler eksik olabilir"
  });
});

test("legacy 24/7 display remains compatible",()=>{
  assert.deepEqual(formatOpeningHours("24/7","atm"),{label:"Açık",value:"24 saat / 7 gün"});
});

test("legacy weekday hours display remains compatible",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-18:00","bank"),{label:"Saatler",value:"Pzt-Cum 09:00-18:00"});
});

test("legacy ATM branch label remains compatible",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-18:00","atm"),{label:"Şube saatleri",value:"Pzt-Cum 09:00-18:00"});
});

test("legacy weekend closure remains compatible",()=>{
  assert.deepEqual(formatOpeningHours("Sa-Su off","atm"),{label:"Şube saatleri",value:"Cmt-Paz kapalı"});
});

test("legacy public holiday closure remains compatible",()=>{
  assert.deepEqual(formatOpeningHours("PH off","atm"),{label:"Şube saatleri",value:"Resmî tatillerde kapalı"});
});

test("legacy ordered multi-clause schedule remains compatible",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-18:00; Sa-Su off; PH off","atm"),{
    label:"Şube saatleri",value:"Pzt-Cum 09:00-18:00 · Cmt-Paz kapalı · Resmî tatillerde kapalı"
  });
});

test("legacy unsupported-only schedules remain hidden",()=>{
  for(const value of ["garbage","Mo-Fr 9-18","Mo-Fr 25:00-26:00","PH maybe"]){
    assert.equal(formatOpeningHours(value,"atm"),null,value);
  }
});
