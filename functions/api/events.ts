import type {Env} from '../lib/types';

const allowed=new Set(['page_view','search','location_click','pharmacy_click','hospital_click','atm_click','service_click','phone_click','whatsapp_click','directions_click','emergency_click','favorite_click']);

export async function onRequestPost({request,env}:{request:Request;env:Env}){
  try{
    const body=await request.json() as {type?:string;metadata?:Record<string,unknown>};
    if(!body.type||!allowed.has(body.type))return new Response(null,{status:400});
    if(!env.DB)return new Response(null,{status:202});
    const metadata=body.metadata&&typeof body.metadata==='object'
      ? Object.fromEntries(Object.entries(body.metadata).slice(0,10).map(([k,v])=>[String(k).slice(0,40),String(v).slice(0,120)]))
      : {};
    await env.DB.prepare('INSERT INTO events(type,metadata,city) VALUES(?,?,?)').bind(body.type,JSON.stringify(metadata),typeof metadata.city==='string'?metadata.city:null).run();
  }catch{/* analytics must never break the app */}
  return new Response(null,{status:204});
}
