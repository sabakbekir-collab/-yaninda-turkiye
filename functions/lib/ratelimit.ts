import type {Env} from './types';

export function clientIp(request:Request){
  return request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
}
export async function rateLimited(env:Env,request:Request,name:string,limit:number,windowSec:number):Promise<boolean>{
  if(!env.DB)return false;
  try{
    const bucket=Math.floor(Date.now()/(windowSec*1000));
    const key='rl:'+name+':'+clientIp(request)+':'+bucket;
    const expires=new Date((bucket+1)*windowSec*1000+60000).toISOString();
    await env.DB.prepare("INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=CAST(CAST(payload AS INTEGER)+1 AS TEXT)").bind(key,'1',expires).run();
    const row=await env.DB.prepare('SELECT payload FROM api_cache WHERE cache_key=? LIMIT 1').bind(key).first<{payload:string}>();
    if(Math.random()<0.02)await env.DB.prepare('DELETE FROM api_cache WHERE expires_at<?').bind(new Date().toISOString()).run();
    return Number(row?.payload||0)>limit;
  }catch{return false}
}