import type {Env} from '../lib/types';
const clean=(v:unknown,n:number)=>typeof v==='string'?v.trim().replace(/[<>]/g,'').slice(0,n):'';
const reasons=new Set(['wrong_info','wrong_phone','wrong_address','closed']);
export async function onRequestPost({request,env}:{request:Request;env:Env}){
  try{
    const b=await request.json() as Record<string,unknown>;
    const placeId=clean(b.placeId,160),placeName=clean(b.placeName,160),reason=clean(b.reason,30);
    if(!placeId||!placeName||!reasons.has(reason))return Response.json({error:'invalid_input'},{status:400});
    if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
    await env.DB.prepare('INSERT INTO reports(place_id,place_name,reason,details) VALUES(?,?,?,?)').bind(placeId,placeName,reason,clean(b.details,500)||null).run();
    return Response.json({ok:true},{status:201});
  }catch{return Response.json({error:'service_unavailable'},{status:503});}
}
