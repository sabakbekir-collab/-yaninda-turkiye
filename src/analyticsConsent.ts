import type {AnalyticsEvent} from '../shared/analyticsEvents';
export type AnalyticsConsent='accepted'|'essential'|null;
export function getAnalyticsConsent():AnalyticsConsent{
  try{const v=localStorage.getItem('yt_analytics_consent');return v==='accepted'||v==='essential'?v:null;}catch{return null;}
}
export function setAnalyticsConsent(value:Exclude<AnalyticsConsent,null>){
  try{
    localStorage.setItem('yt_analytics_consent',value);
    if(value==='essential'){
      localStorage.removeItem('yt_analytics_session');
      localStorage.removeItem('yt_analytics_session_created');
    }
  }catch{/* Preference storage may be unavailable. */}
}
export async function requestAnalyticsDeletion():Promise<boolean>{
  try{
    const sessionId=localStorage.getItem('yt_analytics_session')||'';
    if(!sessionId)return false;
    const response=await fetch('/api/delete-request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:sessionId})});
    if(!response.ok)return false;
    localStorage.removeItem('yt_analytics_session');
    localStorage.removeItem('yt_analytics_session_created');
    setAnalyticsConsent('essential');
    return true;
  }catch{return false;}
}
function analyticsSessionId(consent:boolean){
  if(!consent)return '';
  try{
    const key='yt_analytics_session';
    let id=localStorage.getItem(key);const created=Number(localStorage.getItem(key+'_created')||0);
    if(!id||!created||Date.now()-created>30*60*1000){id=typeof crypto.randomUUID==='function'?crypto.randomUUID():`s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(key,id);localStorage.setItem(key+'_created',String(Date.now()));}
    return id;
  }catch{return '';}
}
export function isAnalyticsTrackingEnabled(){return getAnalyticsConsent()!=='essential';}
export function track(event:AnalyticsEvent,props:Record<string,string|number|boolean>={}){
  if(!isAnalyticsTrackingEnabled())return;
  const consent=getAnalyticsConsent()==='accepted';
  const safeProps=consent?props:{};
  const payload=JSON.stringify({event,props:safeProps,consent,path:typeof location!=='undefined'?location.pathname:'/',referrer:consent&&typeof document!=='undefined'?document.referrer:'',session_id:analyticsSessionId(consent)});
  try{
    const blob=new Blob([payload],{type:'application/json'});
    if(typeof navigator!=='undefined'&&typeof navigator.sendBeacon==='function'&&navigator.sendBeacon('/api/track',blob))return;
  }catch{/* Beacon unavailable; use keepalive fetch below. */}
  fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:payload,keepalive:true}).catch(()=>undefined);
}
