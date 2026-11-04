import type {Env} from '../lib/types';
import {cookieHeader,clearCookie,makeSession,strictSameOrigin,validSession,secureCompare} from '../lib/auth';
import {rateLimited,clientIp} from '../lib/ratelimit';
import {parseTurkeyCoordinates} from '../lib/locationValidation';

const json=async(r:Request)=>await r.json() as Record<string,unknown>;
const clean=(v:unknown,n=300)=>typeof v==='string'?v.trim().replace(/[<>]/g,'').slice(0,n):'';

async function isAdmin(request:Request,env:Env){return validSession(request,env);}

/** Only plain http(s) URLs are accepted for ads: blocks javascript:/data: URLs. */
function safeUrl(v:string):string{
  if(!v)return '';
  try{const u=new URL(v);return u.protocol==='https:'||u.protocol==='http:'?u.toString():'__invalid__'}catch{return '__invalid__'}
}
async function audit(env:Env,request:Request,action:string,targetId:number|null,detail?:string){
  try{await env.DB?.prepare('INSERT INTO admin_logs(action,target_id,detail,ip) VALUES(?,?,?,?)').bind(action,targetId,detail?detail.slice(0,300):null,clientIp(request)).run();}catch{/* audit must not break the action */}
}
/** Real id only: Number(null) === 0 and Number(undefined) === NaN must not count as an id. */
const parseId=(v:unknown):number|null=>typeof v==='number'&&Number.isInteger(v)&&v>0?v:null;

export async function onRequestPost({request,env}:{request:Request;env:Env}){
  if(!strictSameOrigin(request))return new Response('Forbidden',{status:403});
  try{
    const body=await json(request);
    const action=clean(body.action,40);
    if(action==='login'){
      const email=clean(body.email,160).toLowerCase();
      const password=typeof body.password==='string'?body.password.slice(0,200):'';
      if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD||!env.ADMIN_SESSION_SECRET)return Response.json({error:'admin_not_configured'},{status:503});
      // Brute-force protection: 8 attempts / 10 minutes / IP; D1 errors fail closed.
      if(await rateLimited(env,request,'admin-login',8,600))return Response.json({error:'too_many_attempts'},{status:429,headers:{'Retry-After':'600'}});
      const emailOk=await secureCompare(email,env.ADMIN_EMAIL.toLowerCase(),env.ADMIN_SESSION_SECRET);
      const passOk=await secureCompare(password,env.ADMIN_PASSWORD,env.ADMIN_SESSION_SECRET);
      if(!(emailOk&&passOk)){await audit(env,request,'login_failed',null);return Response.json({error:'invalid_credentials'},{status:401});}
      await audit(env,request,'login_ok',null);
      const token=await makeSession(env.ADMIN_SESSION_SECRET);
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','set-cookie':cookieHeader(token)}});
    }
    if(action==='logout')return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','set-cookie':clearCookie()}});
    if(!(await isAdmin(request,env)))return new Response('Unauthorized',{status:401});
    if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,text TEXT,image_url TEXT,target_url TEXT,placement TEXT NOT NULL DEFAULT 'home_top',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    const id=parseId(body.id);
    if(action==='save_ad'){
      const title=clean(body.title,120);
      const text=clean(body.text,300);
      const imageUrl=safeUrl(clean(body.image_url,1000));
      const targetUrl=safeUrl(clean(body.target_url,1000));
      if(imageUrl==='__invalid__'||targetUrl==='__invalid__')return Response.json({error:'invalid_url'},{status:400});
      const placement=clean(body.placement,30)||'home_top';
      if(!title)return Response.json({error:'title_required'},{status:400});
      if(id!==null){
        await env.DB.prepare('UPDATE ads SET title=?,text=?,image_url=?,target_url=?,placement=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(title,text,imageUrl,targetUrl,placement,id).run();
      }else{
        await env.DB.prepare('INSERT INTO ads(title,text,image_url,target_url,placement,status) VALUES(?,?,?,?,?,\'active\')').bind(title,text,imageUrl,targetUrl,placement).run();
      }
    }else if(action==='toggle_ad'){
      if(id===null)return Response.json({error:'invalid_id'},{status:400});
      await env.DB.prepare("UPDATE ads SET status=CASE WHEN status='active' THEN 'paused' ELSE 'active' END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    }else if(action==='delete_ad'){
      if(id===null)return Response.json({error:'invalid_id'},{status:400});
      await env.DB.prepare('DELETE FROM ads WHERE id=?').bind(id).run();
    }else if(action==='approve_submission'){
      if(id===null)return Response.json({error:'invalid_id'},{status:400});
      const row=await env.DB.prepare('SELECT * FROM submissions WHERE id=? LIMIT 1').bind(id).first<Record<string,unknown>>();
      if(!row)return Response.json({error:'not_found'},{status:404});
      let latitude:number;
      let longitude:number;
      const hasManualLatitude=Object.prototype.hasOwnProperty.call(body,'latitude');
      const hasManualLongitude=Object.prototype.hasOwnProperty.call(body,'longitude');
      if(hasManualLatitude||hasManualLongitude){
        // Manual coordinates must be actual finite JSON numbers; strings/null/partial pairs are invalid.
        if(typeof body.latitude!=='number'||!Number.isFinite(body.latitude)||typeof body.longitude!=='number'||!Number.isFinite(body.longitude)){
          return Response.json({error:'invalid_coordinates'},{status:400});
        }
        if(body.latitude<35||body.latitude>43||body.longitude<25||body.longitude>46){
          return Response.json({error:'coordinates_out_of_range'},{status:400});
        }
        latitude=body.latitude;
        longitude=body.longitude;
      }else{
        const q=new URL('https://nominatim.openstreetmap.org/search');
        q.searchParams.set('format','jsonv2');
        q.searchParams.set('limit','1');
        q.searchParams.set('countrycodes','tr');
        q.searchParams.set('q',`${row.address}, ${row.district}, ${row.province}, Türkiye`);
        let g:Response;
        try{
          g=await fetch(q,{headers:{'Accept':'application/json','User-Agent':`YanimdaTurkiye/1.0 (${env.OSM_CONTACT_EMAIL||'public-web-app'})`},signal:AbortSignal.timeout(7000)});
        }catch{
          return Response.json({error:'geocoding_unavailable'},{status:503});
        }
        if(!g.ok)return Response.json({error:'geocoding_unavailable'},{status:503});
        let found:Array<{lat?:unknown;lon?:unknown}>;
        try{found=await g.json() as Array<{lat?:unknown;lon?:unknown}>;}catch{
          return Response.json({error:'geocoding_unavailable'},{status:503});
        }
        const coordinates=Array.isArray(found)&&found.length?parseTurkeyCoordinates(found[0].lat,found[0].lon):null;
        // An empty or invalid geocoder result is not an approved listing.
        if(!coordinates)return Response.json({error:'geocode_failed'},{status:422});
        latitude=coordinates.latitude;
        longitude=coordinates.longitude;
      }
      await env.DB.prepare("UPDATE submissions SET status='approved',latitude=?,longitude=? WHERE id=?").bind(latitude,longitude,id).run();
    }else if(action==='reject_submission'){
      if(id===null)return Response.json({error:'invalid_id'},{status:400});
      await env.DB.prepare('UPDATE submissions SET status=\'rejected\' WHERE id=?').bind(id).run();
    }else if(action==='resolve_report'){
      if(id===null)return Response.json({error:'invalid_id'},{status:400});
      await env.DB.prepare('UPDATE reports SET status=\'resolved\' WHERE id=?').bind(id).run();
    }else{return Response.json({error:'invalid_action'},{status:400});}
    await audit(env,request,action,id);
    return Response.json({ok:true});
  }catch{return Response.json({error:'action_failed'},{status:500});}
}

export async function onRequestGet({request,env}:{request:Request;env:Env}){
  if(!(await isAdmin(request,env)))return new Response('Unauthorized',{status:401});
  if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,text TEXT,image_url TEXT,target_url TEXT,placement TEXT NOT NULL DEFAULT 'home_top',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  // created_at is stored in UTC; "today" is the Istanbul calendar day (UTC+3, no DST) -> starts 21:00 UTC the day before.
  const istDay=new Date(Date.now()+3*3600*1000).toISOString().slice(0,10);
  const today=new Date(Date.parse(istDay+'T00:00:00Z')-3*3600*1000).toISOString().slice(0,19).replace('T',' ');
  const count=async(type:string,since?:string)=>{
    const q=since?'SELECT COUNT(*) AS value FROM events WHERE type=? AND created_at>=?':'SELECT COUNT(*) AS value FROM events WHERE type=?';
    const row=await env.DB!.prepare(q).bind(...(since?[type,since]:[type])).first<{value:number}>();
    return Number(row?.value||0);
  };
  const [visitorsToday,visitorsTotal,searchesToday,searchesTotal,phoneClicks,directionsClicks,emergencyClicks,favoriteClicks,submissions,reports,ads]=await Promise.all([
    count('page_view',today),count('page_view'),count('search',today),count('search'),count('phone_click'),count('directions_click'),count('emergency_click'),count('favorite_click'),
    env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 50').all(),
    env.DB.prepare("SELECT * FROM reports WHERE status='open' ORDER BY created_at DESC LIMIT 50").all(),
    env.DB.prepare('SELECT * FROM ads ORDER BY updated_at DESC LIMIT 50').all()
  ]);
  return Response.json({stats:{visitorsToday,visitorsTotal,searchesToday,searchesTotal,phoneClicks,directionsClicks,emergencyClicks,favoriteClicks},submissions:submissions.results,reports:reports.results,ads:ads.results});
}
