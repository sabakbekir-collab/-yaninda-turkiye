import type {Env} from '../lib/types';
import {sameOrigin} from '../lib/auth';
import {rateLimited} from '../lib/ratelimit';
import {districtsFor,districtMap} from '../../src/turkeyDistricts';
import {resolveName} from '../../src/text';
import {OSM_FILTERS} from '../../src/osmQuery';
const text=(v:unknown,n=300)=>typeof v==='string'?v.trim().replace(/[<>]/g,'').slice(0,n):'';
export async function onRequestPost({request,env}:{request:Request;env:Env}){
  if(!sameOrigin(request))return new Response(null,{status:403});
  if(await rateLimited(env,request,'submissions',5,3600))return new Response(null,{status:429,headers:{'Retry-After':'3600'}});
  try{
    const b=await request.json() as Record<string,unknown>;
    const name=text(b.name,120),category=text(b.category,50),phone=text(b.phone,25),address=text(b.address,300),rawProvince=text(b.province,50),rawDistrict=text(b.district,80);
    const province=resolveName(rawProvince,Object.keys(districtMap));
    const district=province?resolveName(rawDistrict,districtsFor(province)):undefined;
    if(name.length<2||address.length<10||!province||!district||!OSM_FILTERS[category]||!/^[-+() 0-9]{10,20}$/.test(phone))return Response.json({error:'invalid_input'},{status:400});
    if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
    await env.DB.prepare('INSERT INTO submissions(name,category,phone,whatsapp,address,province,district,description,hours) VALUES(?,?,?,?,?,?,?,?,?)').bind(name,category,phone,text(b.whatsapp,25)||null,address,province,district,text(b.description,800)||null,text(b.hours,150)||null).run();
    return Response.json({ok:true},{status:201});
  }catch{return Response.json({error:'service_unavailable'},{status:503});}
}
