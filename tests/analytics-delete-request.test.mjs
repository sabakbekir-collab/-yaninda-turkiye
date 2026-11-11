import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/delete-request.ts';

function makeEnv(){
 const calls=[];
 const env={ADMIN_SESSION_SECRET:'audit-secret',DB:{prepare(sql){return {bind(...values){return {async run(){calls.push({sql,values});return {meta:{changes:3}};},async first(){return {payload:'1'};},async all(){return {results:[]};}};}};}}};
 return {env,calls};
}
test('deletion endpoint removes the supplied anonymous session and writes hashed-IP audit log',async()=>{
 const {env,calls}=makeEnv();
 const request=new Request('https://example.test/api/delete-request',{method:'POST',headers:{Origin:'https://example.test','CF-Connecting-IP':'203.0.113.7','content-type':'application/json'},body:JSON.stringify({session_id:'session-123456789'})});
 const response=await onRequestPost({request,env});
 assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.deleted,3);
 const deletion=calls.find(x=>x.sql==='DELETE FROM events WHERE session_id=?');
 assert.deepEqual(deletion.values,['session-123456789']);
 const audit=calls.find(x=>x.sql.includes('INSERT INTO admin_logs'));
 assert.ok(audit);assert.equal(audit.values[0],'analytics_delete_request');
 assert.match(audit.values[3],/^[a-f0-9]{64}$/);
});
test('deletion endpoint rejects malformed session identifiers',async()=>{
 const {env,calls}=makeEnv();
 const request=new Request('https://example.test/api/delete-request',{method:'POST',headers:{Origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({session_id:'x'})});
 const response=await onRequestPost({request,env});
 assert.equal(response.status,400);
 assert.equal(calls.some(x=>x.sql==='DELETE FROM events WHERE session_id=?'),false);
});
