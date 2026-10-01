import type {Env} from '../lib/types';
import {cookieHeader,clearCookie,makeSession,sameOrigin,validSession} from '../lib/auth';

const json=async(r:Request)=>await r.json() as Record<string,unknown>;
const clean=(v:unknown,n=300)=>typeof v==='string'?v.trim().replace(/[<>]/g,'').slice(0,n):'';

async function isAdmin(request:Request,env:Env){return validSession(request,env);}

export async function onRequestPost({request,env}:{request:Request;env:Env}){
  if(!sameOrigin(request))return new Response('Forbidden',{status:403});
  try{
    const body=await json(request);
    const action=clean(body.action,40);
    if(action==='login'){
      const email=clean(body.email,160).toLowerCase();
      const password=typeof body.password==='string'?body.password:'';
      if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD||!env.ADMIN_SESSION_SECRET)return Response.json({error:'admin_not_configured'},{status:503});
      if(email!==env.ADMIN_EMAIL.toLowerCase()||password!==env.ADMIN_PASSWORD)return Response.json({error:'invalid_credentials'},{status:401});
      const token=await makeSession(env.ADMIN_SESSION_SECRET);
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','set-cookie':cookieHeader(token)}});
    }
    if(action==='logout')return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','set-cookie':clearCookie()}});
    if(!(await isAdmin(request,env)))return new Response('Unauthorized',{status:401});
    if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
    const id=Number(body.id);
    if(action==='save_ad'){
      const title=clean(body.title,120);
      const text=clean(body.text,300);
      const imageUrl=clean(body.image_url,1000);
      const targetUrl=clean(body.target_url,1000);
      const placement=clean(body.placement,30)||'home_top';
      if(!title)return Response.json({error:'title_required'},{status:400});
      if(Number.isInteger(id)){
        await env.DB.prepare('UPDATE ads SET title=?,text=?,image_url=?,target_url=?,placement=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(title,text,imageUrl,targetUrl,placement,id).run();
      }else{
        await env.DB.prepare('INSERT INTO ads(title,text,image_url,target_url,placement,status) VALUES(?,?,?,?,?,\'active\')').bind(title,text,imageUrl,targetUrl,placement).run();
      }
    }else if(action==='toggle_ad'){
      if(!Number.isInteger(id))return Response.json({error:'invalid_id'},{status:400});
      await env.DB.prepare("UPDATE ads SET status=CASE WHEN status='active' THEN 'paused' ELSE 'active' END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    }else if(action==='delete_ad'){
      if(!Number.isInteger(id))return Response.json({error:'invalid_id'},{status:400});
      await env.DB.prepare('DELETE FROM ads WHERE id=?').bind(id).run();
    }else if(action==='approve_submission'){
      if(!Number.isInteger(id))return Response.json({error:'invalid_id'},{status:400});
      const row=await env.DB.prepare('SELECT * FROM submissions WHERE id=? LIMIT 1').bind(id).first<Record<string,unknown>>();
      if(!row)return Response.json({error:'not_found'},{status:404});
      let latitude:number|undefined,longitude:number|undefined;
      try{
        const q=encodeURIComponent(`${row.address}, ${row.district}, ${row.province}, Türkiye`);
        const g=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${q}`,{headers:{'User-Agent':`YanimdaTurkiye/1.0 (${env.OSM_CONTACT_EMAIL||'public-web-app'})`},signal:AbortSignal.timeout(7000)});
        const found=(await g.json() as Array<{lat?:string;lon?:string}>)[0];
        if(found){latitude=Number(found.lat);longitude=Number(found.lon);}
      }catch{}
      await env.DB.prepare('UPDATE submissions SET status=\'approved\',latitude=?,longitude=? WHERE id=?').bind(latitude??null,longitude??null,id).run();
    }else if(action==='reject_submission'){
      await env.DB.prepare('UPDATE submissions SET status=\'rejected\' WHERE id=?').bind(id).run();
    }else if(action==='resolve_report'){
      if(!Number.isInteger(id))return Response.json({error:'invalid_id'},{status:400});
      await env.DB.prepare('UPDATE reports SET status=\'resolved\' WHERE id=?').bind(id).run();
    }else{return Response.json({error:'invalid_action'},{status:400});}
    return Response.json({ok:true});
  }catch{return Response.json({error:'action_failed'},{status:500});}
}

export async function onRequestGet({request,env}:{request:Request;env:Env}){
  if(!(await isAdmin(request,env)))return new Response('Unauthorized',{status:401});
  if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
  const today=new Date().toISOString().slice(0,10);
  const count=async(type:string,since?:string)=>{
    const q=since?'SELECT COUNT(*) AS value FROM events WHERE type=? AND created_at>=?':'SELECT COUNT(*) AS value FROM events WHERE type=?';
    const row=await env.DB!.prepare(q).bind(...(since?[type,since]:[type])).first<{value:number}>();
    return Number(row?.value||0);
  };
  const [visitorsToday,visitorsTotal,searchesToday,searchesTotal,phoneClicks,directionsClicks,emergencyClicks,favoriteClicks,submissions,reports]=await Promise.all([
    count('page_view',today),count('page_view'),count('search',today),count('search'),count('phone_click'),count('directions_click'),count('emergency_click'),count('favorite_click'),
    env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 50').all(),
    env.DB.prepare("SELECT * FROM reports WHERE status='open' ORDER BY created_at DESC LIMIT 50").all(),
    env.DB.prepare('SELECT * FROM ads ORDER BY updated_at DESC LIMIT 50').all()
  ]);
  return Response.json({stats:{visitorsToday,visitorsTotal,searchesToday,searchesTotal,phoneClicks,directionsClicks,emergencyClicks,favoriteClicks},submissions:submissions.results,reports:reports.results,ads:ads.results});
}
