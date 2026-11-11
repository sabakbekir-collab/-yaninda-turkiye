import test from 'node:test';
import assert from 'node:assert/strict';
import {setAnalyticsConsent,track,isAnalyticsTrackingEnabled} from '../src/analyticsConsent.ts';

class MemoryStorage{
 values=new Map();
 getItem(k){return this.values.has(k)?this.values.get(k):null;}
 setItem(k,v){this.values.set(k,String(v));}
 removeItem(k){this.values.delete(k);}
}
test('withdrawing consent clears session and prevents all subsequent tracking requests',()=>{
 const previousStorage=globalThis.localStorage,previousFetch=globalThis.fetch;
 const storage=new MemoryStorage();storage.setItem('yt_analytics_session','session-123456789');storage.setItem('yt_analytics_session_created','123');
 globalThis.localStorage=storage;
 let sends=0;globalThis.fetch=()=>{sends++;return Promise.resolve(new Response(null,{status:204}));};
 try{
  setAnalyticsConsent('essential');
  assert.equal(storage.getItem('yt_analytics_session'),null);
  assert.equal(storage.getItem('yt_analytics_session_created'),null);
  assert.equal(isAnalyticsTrackingEnabled(),false);
  track('page_view',{path:'/nearby'});
  assert.equal(sends,0);
 }finally{
  if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;
  globalThis.fetch=previousFetch;
 }
});
