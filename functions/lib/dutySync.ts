import type { Env } from '../lib/types';
import { dutyProvinces } from './duty';

const SOURCE='Eczane Adresi API';
const slug=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
type Pharmacy={name?:unknown;district?:unknown;phone?:unknown;address?:unknown;latitude?:unknown;longitude?:unknown;lat?:unknown;lon?:unknown};
function safePhone(v:unknown){if(typeof v!=='string')return null;const p=v.trim().replace(/[^0-9+]/g,'');return p.length>=7&&p.length<=20?p:null;}
function validCoords(lat:unknown,lon:unknown):[number|null,number|null]{const a=Number(lat),b=Number(lon);return Number.isFinite(a)&&a>=35&&a<=43&&Number.isFinite(b)&&b>=25&&b<=46?[a,b]:[null,null];}
export async function syncDutyChunk(env:Env,chunk:number):Promise<{provinces:number;rows:number;errors:number}>{
 if(!env.DB)return {provinces:0,rows:0,errors:1};
 const start=new Date(); const chosen=dutyProvinces.filter((_,i)=>i%2===chunk).slice(0,41);
 let good=0,total=0,errors=0;
 for(const province of chosen){
  try{
   const u=new URL('https://eczaneadresi.com/api/public/v1/duty-pharmacies');
   u.searchParams.set('city',slug(province));u.searchParams.set('limit','200');
   const response=await fetch(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!response.ok){errors++;continue;}
   const data=await response.json() as {pharmacies?:Pharmacy[]};
   if(!Array.isArray(data.pharmacies)){errors++;continue;}
   let accepted=0;
   for(const p of data.pharmacies){
    const name=typeof p.name==='string'?p.name.trim().slice(0,160):'';
    const district=typeof p.district==='string'?p.district.trim(): '';
    const phone=safePhone(p.phone),address=typeof p.address==='string'?p.address.trim().slice(0,400):null;
    const [latitude,longitude]=validCoords(p.latitude??p.lat,p.longitude??p.lon);
    if(!name||!district||district.length>80)continue;
    const date=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
    await env.DB.prepare('INSERT INTO duty_pharmacies(duty_date,province,district,name,phone,address,latitude,longitude,source,fetched_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(duty_date,province,district,name) DO UPDATE SET phone=excluded.phone,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,source=excluded.source,fetched_at=excluded.fetched_at').bind(date,province,district,name,phone,address,latitude,longitude,SOURCE).run();
    accepted++;total++;
   }
   if(accepted>=0)good++;
  }catch{errors++;}
 }
 const finish=new Date();
 await env.DB.prepare('INSERT INTO duty_sync_runs(started_at,finished_at,source,province_count,row_count,status,error_kind) VALUES(?,?,?,?,?,?,?)').bind(start.toISOString(),finish.toISOString(),SOURCE,good,total,errors?'partial':'success',errors?'provider_error':null).run();
 return {provinces:good,rows:total,errors};
}
