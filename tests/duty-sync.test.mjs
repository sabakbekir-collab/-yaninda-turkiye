import test from 'node:test';
import assert from 'node:assert/strict';
import { syncDutyChunk } from '../functions/lib/dutySync.ts';

function fakeDb(existing=[]){
 const rows=new Map(existing.map(r=>[r.duty_date+'|'+r.province+'|'+r.district+'|'+r.name,r]));
 const syncRuns=[];
 return {rows,syncRuns,prepare(sql){let vals=[];return{
  bind(...v){vals=v;return this;},
  async run(){
   if(sql.startsWith('INSERT INTO duty_pharmacies')){
    const key=vals.slice(0,4).join('|');
    rows.set(key,{duty_date:vals[0],province:vals[1],district:vals[2],name:vals[3],phone:vals[4],address:vals[5],lat:vals[6],lon:vals[7],source:vals[8],fetched_at:'now'});
    return {meta:{changes:1}};
   }
   if(sql.startsWith('INSERT INTO duty_sync_runs')){syncRuns.push(vals);return {meta:{changes:1}};}
   return {meta:{changes:1}};
  },
  async first(){return null;},
  async all(){return {results:[]};}
 };}};
}
test('mocked provider validates bad rows, counts failures and upserts idempotently',async()=>{
 const db=fakeDb();const env={DB:db,DUTY_SYNC_ENABLED:'true'};
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{
  calls++;
  if(calls===1)return Response.json({pharmacies:[
   {name:'Valid Pharmacy',district:'Ceyhan',phone:'03220000000',address:'Test address',lat:37.1,lon:35.3},
   {name:'Bad district',district:'Unknown',phone:'03220000000',address:'bad'},
   {name:'Bad phone',district:'Ceyhan',phone:'bad',address:'bad'}
  ]});
  if(calls===2)return new Response(null,{status:503});
  return Response.json({pharmacies:[]});
 };
 try{
  const first=await syncDutyChunk(env,0);
  assert.equal(first.rows,1,JSON.stringify(first));
  assert.ok(first.errors>=1);
  assert.equal(db.rows.size,1);
  const second=await syncDutyChunk(env,0);
  assert.equal(second.rows,1);
  assert.equal(db.rows.size,1);
  assert.equal(calls,82);
  assert.equal(db.syncRuns.length,2);
 }finally{globalThis.fetch=originalFetch;}
});
test('provider sync disabled by default makes no external requests',async()=>{
 const db=fakeDb();const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('unexpected network');};
 try{const result=await syncDutyChunk({DB:db},0);assert.deepEqual(result,{provinces:0,rows:0,errors:0});assert.equal(calls,0);}finally{globalThis.fetch=originalFetch;}
});
