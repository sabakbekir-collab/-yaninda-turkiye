import test from 'node:test';
import assert from 'node:assert/strict';
import { dutyGet, resolveProvince, resolveDistrict } from '../functions/api/duty.ts';

test('Turkish province/district normalization accepts casing and diacritics',()=>{
 assert.equal(resolveProvince('ISTANBUL'),'İstanbul');
 assert.equal(resolveProvince('istanbul'),'İstanbul');
 assert.equal(resolveProvince('İstanbul'),'İstanbul');
 assert.equal(resolveProvince('muS'),'Muş');
 assert.equal(resolveDistrict('İstanbul','kadıköy'),'Kadıköy');
});

function dbMock(rows){
 return {prepare(sql){let bound=[];return{bind(...v){bound=v;return this;},async run(){return{meta:{changes:1}};},async first(){return sql.includes('SELECT payload')?{payload:'1'}:null;},async all(){return {results:rows};}};}};
}
test('duty API returns data and source attribution for Turkish city slug',async()=>{
 const today=new Date(Date.now()+3*60*60*1000).toISOString().slice(0,10);
 const env={DB:dbMock([{id:1,duty_date:today,province:'İstanbul',district:'Kadıköy',name:'Mock Pharmacy',phone:'02160000000',fetched_at:today}])};
 const request=new Request('https://example.test/api/duty?il=ISTANBUL');
 const response=await dutyGet({request,env});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.province,'İstanbul');
 assert.equal(data.stale,false);
 assert.equal(data.pharmacies[0].name,'Mock Pharmacy');
 assert.match(data.source_attribution,/CC BY 4.0/);
});
