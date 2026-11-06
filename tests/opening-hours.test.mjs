import test from "node:test";
import assert from "node:assert/strict";
import { formatOpeningHours } from "../src/openingHours.ts";

test("24/7 is shown as continuously open",()=>{
  assert.deepEqual(formatOpeningHours("24/7","atm"),{label:"Açık",value:"24 saat / 7 gün"});
});

test("weekday opening hours are translated to Turkish",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-18:00","bank"),{label:"Saatler",value:"Pzt-Cum 09:00-18:00"});
});

test("ATM branch hours use the branch-hours label",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-18:00","atm"),{label:"Şube saatleri",value:"Pzt-Cum 09:00-18:00"});
});

test("weekend closure is translated",()=>{
  assert.deepEqual(formatOpeningHours("Sa-Su off","atm"),{label:"Şube saatleri",value:"Cmt-Paz kapalı"});
});

test("public holiday closure is translated",()=>{
  assert.deepEqual(formatOpeningHours("PH off","atm"),{label:"Şube saatleri",value:"Resmî tatillerde kapalı"});
});

test("multiple known rules are translated in order",()=>{
  assert.deepEqual(formatOpeningHours("Mo-Fr 09:00-18:00; Sa-Su off; PH off","atm"),{
    label:"Şube saatleri",value:"Pzt-Cum 09:00-18:00 · Cmt-Paz kapalı · Resmî tatillerde kapalı"
  });
});

test("malformed or unsupported schedules are hidden",()=>{
  for(const value of ["garbage","Mo-Fr 9-18","Mo-Fr 25:00-26:00","PH maybe",""]){
    assert.equal(formatOpeningHours(value,"atm"),null,value);
  }
  assert.equal(formatOpeningHours(undefined,"atm"),null);
});
