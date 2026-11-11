import type {Env} from '../lib/types';
import {sameOrigin,secureCompare} from '../lib/auth';
import {rateLimited,clientIp} from '../lib/ratelimit';

const MAX_BYTES=4096;
const allowed=new Set(['page_view','search','search_zero_results','category_click','place_click','phone_click','directions_click','whatsapp_click','website_click','favorite_click','share_click','ad_impression','ad_click','ai_open','ai_message','location_permission','scroll_depth','time_on_page','error','heatmap_click']);
const clean=(v:unknown,max=180)=>typeof v==='string'?v.replace(/[\u0000-\u001f<>]/g,'').slice(0,max):'';
const uaClass=(ua:string)=>/android|iphone|ipad|mobile/i.test(ua)?'mobil':'masaüstü';
const browserClass=(ua:string)=>/edg\//i.test(ua)?'Edge':/firefox\//i.test(ua)?'Firefox':/chrome\//i.test(ua)?'Chrome':/safari\//i.test(ua)?'Safari':'Diğer';
async function hashIp(ip:string,salt:string){const data=new TextEncoder().encode(salt+':'+ip);const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function onRequestPost({request,env}:{request:Request;env:Env}){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const ua=request.headers.get('User-Agent')||'';
 if(!ua||/bot|crawler|spider|headless/i.test(ua))return new Response(null,{status:204});
 const length=Number(request.headers.get('Content-Length')||0);if(length>MAX_BYTES)return Response.json({error:'payload_too_large'},{status:413});
 if(await rateLimited(env,request,'track',90,60))return new Response(null,{status:429,headers:{'Retry-After':'60'}});
 if(!env.DB)return new Response(null,{status:202});
 try{
  const body=await request.json() as Record<string,unknown>;
  const event=clean(body.event,48);if(!allowed.has(event))return new Response(null,{status:400});
  const props=body.props&&typeof body.props==='object'&&!Array.isArray(body.props)?body.props as Record<string,unknown>:{};
  const safeProps=Object.fromEntries(Object.entries(props).slice(0,16).map(([k,v])=>[clean(k,40),typeof v==='number'&&Number.isFinite(v)?v:typeof v==='boolean'?v:clean(String(v),160)]));
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const ipHash=env.ADMIN_SESSION_SECRET?await hashIp(ip,env.ADMIN_SESSION_SECRET):null;
  const path=clean(body.path,240)||new URL(request.url).pathname;
  const session=clean(body.session_id,80);
  const targetType=clean(body.target_type,40)||null,targetId=clean(body.target_id,100)||null,targetLabel=clean(body.target_label,160)||null;
  const city=clean(body.city,80)||null,referrer=clean(body.referrer,300)||null;
  const device=uaClass(ua),browser=browserClass(ua),ts=new Date().toISOString(),propsJson=JSON.stringify(safeProps);
  await env.DB.prepare('INSERT INTO events(type,metadata,city,created_at,ts,session_id,user_id,event,path,target_type,target_id,target_label,props_json,device,browser,referrer,ip_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(event,propsJson,city,ts,ts,session||null,null,event,path,targetType,targetId,targetLabel,propsJson,device,browser,referrer,ipHash).run();
 }catch{return new Response(null,{status:204});}
 return new Response(null,{status:204});
}
