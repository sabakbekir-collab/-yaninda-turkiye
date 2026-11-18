import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('manual duty CSV import validates rows, escapes SQL and writes output only',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'duty-import-test-'));
 try{
  const csv=path.join(dir,'in.csv'),out=path.join(dir,'out.sql');
  fs.writeFileSync(csv,'il,ilce,ad,telefon,adres,tarih\nİstanbul,Kadıköy,Test Eczane,02160000000,"O\'Brien, Cadde 1",2026-11-18\nUnknown,Merkez,Bad,5551234567,Address,2026-11-18\nMuş,Merkez,Invalid date,5551234567,Address,not-a-date\n');
  const run=spawnSync(process.execPath,['scripts/duty-import.mjs',csv,out],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const sql=fs.readFileSync(out,'utf8');
  assert.match(sql,/Valid rows: 1; rejected: 2/);
  assert.match(sql,/O''Brien, Cadde 1/);
  assert.match(sql,/ON CONFLICT\(duty_date,province,district,name\) DO UPDATE/);
  assert.doesNotMatch(run.stdout,/02160000000|O'Brien/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
