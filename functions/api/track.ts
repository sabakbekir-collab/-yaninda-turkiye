import type {Env} from '../lib/types';
import {ANALYTICS_EVENTS} from '../../shared/analyticsEvents.ts';
import {sameOrigin} from '../lib/auth.ts';
import {rateLimited} from '../lib/ratelimit.ts';
import {notifyRepeatedClientError} from '../lib/telegram.ts';

const MAX_BYTES=4096;
const allowed=new Set<string>(ANALYTICS_EVENTS);
const clean=(v:unknown,max=180)=>typeof v==='string'?[...v].filter(ch=>{const code=ch.charCodeAt(0);return code>=32&&ch!=='<'&&ch!=='>';}).join('').slice(0,max):'';
const uaClass=(ua:string)=>/android|iphone|ipad|mobile/i.test(ua)?'mobil':'masaüstü';
const browserClass=(ua:string)=>/edg\//i.test(ua)?'Edge':/firefox\//i.test(ua)?'Firefox':/chrome\//i.test(ua)?'Chrome':/safari\//i.test(ua)?'Safari':'Diğer';
async function hashIp(ip:string,salt:string){const data=new TextEncoder().encode(salt+':'+ip);const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function isRevokedSession(env:Env,sessionId:string){
 if(!sessionId||!env.DB)return false;
 const row=await env.DB.prepare('SELECT 1 FROM analytics_session_revocations WHERE session_id=? LIMIT 1').bind(sessionId).first<Record<string,unknown>>();
 return Boolean(row);
}
export async function onRequestPost({request,env}:{request:Request;env:Env}){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const ua=request.headers.get('User-Agent')||'';
 if(!ua||/bot|crawler|spider|headless/i.test(ua))return new Response(null,{status:204});
 const length=Number(request.headers.get('Content-Length')||0);if(length>MAX_BYTES)return Response.json({error:'payload_too_large'},{status:413});
 if(await rateLimited(env,request,'track',90,60))return new Response(null,{status:429,headers:{'Retry-After':'60'}});
 if(!env.DB)return new Response(null,{status:202});
 try{
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)return Response.json({error:'payload_too_large'},{status:413});
  const body=JSON.parse(raw) as Record<string,unknown>;
  const event=clean(body.event,48);if(!allowed.has(event))return new Response(null,{status:400});
  const consent=body.consent===true;
  const props=consent&&body.props&&typeof body.props==='object'&&!Array.isArray(body.props)?body.props as Record<string,unknown>:{};
  const safeProps=Object.fromEntries(Object.entries(props).slice(0,16).map(([k,v])=>[clean(k,40),typeof v==='number'&&Number.isFinite(v)?v:typeof v==='boolean'?v:clean(String(v),160)]));
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const ipHash=consent&&env.ADMIN_SESSION_SECRET?await hashIp(ip,env.ADMIN_SESSION_SECRET):null;
  const path=clean(body.path,240)||new URL(request.url).pathname;
  const session=consent?clean(body.session_id,80):'';
  if(consent&&session&&await isRevokedSession(env,session))return new Response(null,{status:204});
  const targetType=consent?clean(body.target_type??safeProps.target_type,40)||null:null,targetId=consent?clean(body.target_id??safeProps.target_id,100)||null:null,targetLabel=consent?clean(body.target_label??safeProps.target_label,160)||null:null;
  const cf=(request as Request & {cf?:{city?:string;region?:string}}).cf;
  const city=consent?clean(cf?.city||cf?.region||'',80)||null:null,referrer=consent?clean(body.referrer,300)||null:null;
  const device=consent?uaClass(ua):null,browser=consent?browserClass(ua):null,ts=new Date().toISOString(),propsJson=consent?JSON.stringify(safeProps):'{}';
  await env.DB.prepare('INSERT INTO events(type,metadata,city,created_at,ts,session_id,user_id,event,path,target_type,target_id,target_label,props_json,device,browser,referrer,ip_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(event,propsJson,city,ts,ts,session||null,null,event,path,targetType,targetId,targetLabel,propsJson,device,browser,referrer,ipHash).run();
  if(event==='error')await notifyRepeatedClientError(env,safeProps.error_code??safeProps.code);
 }catch{return new Response(null,{status:204});}
 return new Response(null,{status:204});
}
