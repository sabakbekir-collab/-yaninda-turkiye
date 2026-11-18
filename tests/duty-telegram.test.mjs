import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/telegram.ts';

function mockDb(rows=[]) {
 const cache=new Map();
 return {prepare(sql){let values=[];return{
  bind(...v){values=v;return this;},
  async first(){if(sql.includes('SELECT payload FROM api_cache'))return {payload:'1'}; if(sql.includes('SELECT payload,expires_at FROM api_cache'))return cache.get(values[0])||null; return null;},
  async all(){if(sql.includes('FROM duty_pharmacies'))return {results:rows};return {results:[]};},
  async run(){if(sql.includes('INSERT INTO api_cache'))cache.set(values[0],{payload:values[1],expires_at:values[2]});return {meta:{changes:1}};}
 };}};
}
function makeRequest(text,chat=12345){
 return new Request('https://worker.test/api/telegram',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'test-secret'},body:JSON.stringify({message:{chat:{id:chat,type:'private'},text}})});
}
async function setup(rows=[]){
 const env={DB:mockDb(rows),TELEGRAM_BOT_TOKEN:'fake-token',TELEGRAM_WEBHOOK_SECRET:'test-secret',TELEGRAM_ADMIN_CHAT_IDS:'12345'};
 const previous=globalThis.fetch;const sent=[];
 globalThis.fetch=async(_url,init)=>{sent.push(JSON.parse(init.body));return Response.json({ok:true});};
 return {env,sent,restore(){globalThis.fetch=previous;}};
}
test('Turkish /nöbet command normalizes and shows only safe pharmacy details with attribution',async()=>{
 const date=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
 const c=await setup([{district:'Kadıköy',name:'Mock Eczane',phone:'02160000000',fetched_at:date}]);
 try{const res=await onRequestPost({request:makeRequest('/nöbet İstanbul'),env:c.env});assert.equal(res.status,200);assert.match(c.sent[0].text,/Mock Eczane/);assert.match(c.sent[0].text,/CC BY 4.0/);assert.doesNotMatch(c.sent[0].text,/adres|kişisel/i);}finally{c.restore();}
});
test('manual duty sync asks for confirmation and stays disabled safely by default',async()=>{
 const c=await setup();
 try{await onRequestPost({request:makeRequest('/nobetsenk'),env:c.env});assert.match(c.sent[0].text,/Emin misin/);await onRequestPost({request:makeRequest('/evet nobet'),env:c.env});assert.match(c.sent[1].text,/kapalı/);}finally{c.restore();}
});
