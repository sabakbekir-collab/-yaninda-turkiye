import type{Config}from'@netlify/functions';import{getUser,verifyRequestOrigin}from'@netlify/identity';import{and,count,desc,eq,gte}from'drizzle-orm';import{db}from'../../db/index.js';import{events,submissions}from'../../db/schema.js';
export default async(req:Request)=>{
  const user=await getUser();
  if(!user)return new Response('Unauthorized',{status:401});
  if(!user.roles.includes('admin'))return new Response('Forbidden',{status:403});

  if(req.method==='POST'){
    try{
      verifyRequestOrigin(req);
      const body=await req.json() as {action?:string;id?:number};
      if(!Number.isInteger(body.id))return Response.json({error:'invalid_id'},{status:400});

      if(body.action==='approve_submission'){
        const rows=await db.select().from(submissions).where(eq(submissions.id,body.id)).limit(1);
        const submission=rows[0];
        if(!submission)return Response.json({error:'not_found'},{status:404});
        let latitude:number|undefined;
        let longitude:number|undefined;
        try{
          const q=encodeURIComponent(`${submission.address}, ${submission.district}, ${submission.province}, Türkiye`);
          const g=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${q}`,{
            headers:{'User-Agent':`YanimdaTurkiye/1.0 (${process.env.OSM_CONTACT_EMAIL||'public-web-app'})`},
            signal:AbortSignal.timeout(7000),
          });
          const found=(await g.json())[0] as {lat?:string;lon?:string}|undefined;
          if(found){latitude=Number(found.lat);longitude=Number(found.lon);}
        }catch{}
        await db.update(submissions).set({status:'approved',latitude,longitude}).where(eq(submissions.id,body.id));
      }else if(body.action==='reject_submission'){
        await db.update(submissions).set({status:'rejected'}).where(eq(submissions.id,body.id));
      }else if(body.action==='resolve_report'){
        await db.update(reports).set({status:'resolved'}).where(eq(reports.id,body.id));
      }else{
        return Response.json({error:'invalid_action'},{status:400});
      }
      return Response.json({ok:true});
    }catch{
      return Response.json({error:'action_failed'},{status:500});
    }
  }

  if(req.method!=='GET')return new Response('Method not allowed',{status:405});

  const start=new Date();start.setUTCHours(0,0,0,0);
  const total=async(type:string,since?:Date)=>{
    const where=since?and(eq(events.type,type),gte(events.createdAt,since)):eq(events.type,type);
    const[r]=await db.select({value:count()}).from(events).where(where);
    return r.value;
  };
  const[visitorsToday,visitorsTotal,searchesToday,searchesTotal,phoneClicks,directionsClicks,emergencyClicks,favoriteClicks,recent,recentReports]=await Promise.all([
    total('page_view',start),total('page_view'),total('search',start),total('search'),total('phone_click'),total('directions_click'),total('emergency_click'),total('favorite_click'),
    db.select().from(submissions).orderBy(desc(submissions.createdAt)).limit(20),
    db.select().from(reports).where(eq(reports.status,'open')).orderBy(desc(reports.createdAt)).limit(20)
  ]);
  return Response.json({stats:{visitorsToday,visitorsTotal,searchesToday,searchesTotal,phoneClicks,directionsClicks,emergencyClicks,favoriteClicks},submissions:recent,reports:recentReports});
};
export const config:Config={path:'/api/admin'};
