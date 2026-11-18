import type { Env } from '../lib/types';
import { districtMap } from '../../src/turkeyDistricts.ts';
import { rateLimited } from '../lib/ratelimit.ts';

export const dutyProvinces = Object.keys(districtMap);
const fold=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').toLowerCase().trim();
export const resolveProvince=(raw:string)=>dutyProvinces.find(p=>fold(p)===fold(raw))||null;
export const resolveDistrict=(province:string,raw:string)=>districtMap[province]?.find(d=>fold(d)===fold(raw))||null;
export async function dutyGet({request,env}:{request:Request;env:Env}):Promise<Response>{
 const url=new URL(request.url); if(await rateLimited(env,request,'duty-check',30,60))return Response.json({error:'rate_limited'},{status:429});
 const province=resolveProvince(url.searchParams.get('il')||url.searchParams.get('city')||'');
 if(!province)return Response.json({error:'invalid_province'},{status:400});
 const districtRaw=url.searchParams.get('ilce')||url.searchParams.get('district')||'';
 const district=districtRaw?resolveDistrict(province,districtRaw):null;
 if(districtRaw&&!district)return Response.json({error:'invalid_district'},{status:400});
 const date=new Date(Date.now()+3*60*60*1000).toISOString().slice(0,10);
 try{
  const todayQuery=env.DB!.prepare('SELECT id,duty_date,province,district,name,phone,address,latitude,longitude,source,fetched_at FROM duty_pharmacies WHERE duty_date=? AND province=? AND (? IS NULL OR district=?) ORDER BY district,name LIMIT 200').bind(date,province,district,district);
  let rows=await todayQuery.all<Record<string,unknown>>();
  let stale=false;
  if(!rows.results.length){
   const fallback=env.DB!.prepare('SELECT id,duty_date,province,district,name,phone,address,latitude,longitude,source,fetched_at FROM duty_pharmacies WHERE province=? AND (? IS NULL OR district=?) ORDER BY duty_date DESC,fetched_at DESC,district,name LIMIT 200').bind(province,district,district);
   rows=await fallback.all<Record<string,unknown>>();
   stale=rows.results.length>0;
  }
  const first=rows.results[0];
  return Response.json({ok:true,province,district,date,stale,fetched_at:first?.fetched_at||null,pharmacies:rows.results,source_attribution:'Veri: Eczane Adresi (CC BY 4.0)'},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'duty_data_unavailable'},{status:503});}
}
