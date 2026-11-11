import type {Env} from '../lib/types';
import {sameOrigin} from '../lib/auth';
import {rateLimited,clientIp} from '../lib/ratelimit';

const clean=(v:unknown)=>typeof v==='string'?v.trim().slice(0,100):'';
async function hashIp(ip:string,salt:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function onRequestPost({request,env}:{request:Request;env:Env}){
 if(!sameOrigin(request))return Response.json({error:'forbidden'},{status:403});
 if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
 if(await rateLimited(env,request,'delete-request',5,3600))return Response.json({error:'rate_limited'},{status:429});
 let body:Record<string,unknown>;
 try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({error:'invalid_json'},{status:400});}
 const sessionId=clean(body.session_id);
 if(!/^[a-zA-Z0-9_-]{12,100}$/.test(sessionId))return Response.json({error:'valid_session_required'},{status:400});
 try{
  const result=await env.DB.prepare('DELETE FROM events WHERE session_id=?').bind(sessionId).run() as {meta?:{changes?:number}};
  const ipHash=await hashIp(clientIp(request),env.ADMIN_SESSION_SECRET||'delete-request-audit');
  await env.DB.prepare('INSERT INTO admin_logs(action,target_id,detail,ip) VALUES(?,?,?,?)')
   .bind('analytics_delete_request',null,`session:${sessionId.slice(0,8)}; deleted:${Number(result?.meta?.changes||0)}`,ipHash).run();
  return Response.json({ok:true,deleted:Number(result?.meta?.changes||0)});
 }catch{return Response.json({error:'delete_failed'},{status:500});}
}
