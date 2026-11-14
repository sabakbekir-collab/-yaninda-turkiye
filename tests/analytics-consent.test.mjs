import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/track.ts';

function makeEnv(){
 const calls=[];
 const env={ADMIN_SESSION_SECRET:'test-secret',DB:{prepare(sql){return {bind(...values){return {async run(){calls.push({sql,values});return {meta:{changes:1}};},async first(){return sql.includes('analytics_session_revocations')?null:{payload:'1'};},async all(){return {results:[]};}};}};}}};
 return {env,calls};
}
function request(body){
 return new Request('https://example.test/api/track',{method:'POST',headers:{Origin:'https://example.test','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1','CF-Connecting-IP':'203.0.113.4','content-type':'application/json'},body:JSON.stringify(body)});
}
function inserted(calls){return calls.find(x=>x.sql.startsWith('INSERT INTO events'));}
test('without consent stores only event, path and date with no session/device/heatmap fields',async()=>{
 const {env,calls}=makeEnv();
 await onRequestPost({request:request({event:'page_view',path:'/nearby',consent:false,session_id:'must-not-store',props:{x:42,y:21,device:'phone'}}),env});
 const row=inserted(calls);assert.ok(row);
 assert.equal(row.values[0],'page_view');
 assert.equal(row.values[2],null);assert.equal(row.values[6],null);
 assert.equal(row.values[7],'page_view');assert.equal(row.values[8],'/nearby');
 assert.equal(row.values[9],null);assert.equal(row.values[10],null);assert.equal(row.values[11],null);
 assert.equal(row.values[12],'{}');assert.equal(row.values[13],null);assert.equal(row.values[14],null);assert.equal(row.values[15],null);assert.equal(row.values[16],null);
});
test('with consent stores session, device and heatmap coordinates',async()=>{
 const {env,calls}=makeEnv();
 await onRequestPost({request:request({event:'heatmap_click',path:'/nearby',consent:true,session_id:'session-123456789',props:{x:42,y:21}}),env});
 const row=inserted(calls);assert.ok(row);
 assert.equal(row.values[5],'session-123456789');
 assert.equal(row.values[12],JSON.stringify({x:42,y:21}));
 assert.equal(row.values[13],'mobil');assert.equal(row.values[14],'Safari');
});
