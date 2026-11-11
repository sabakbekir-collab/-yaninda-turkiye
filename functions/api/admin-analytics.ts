import type {Env} from '../lib/types';
import {validSession} from '../lib/auth';

type Row=Record<string,unknown>;
const iso=(v:string|null,fallback:string)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:fallback;
const all=async(env:Env,sql:string,...values:unknown[])=>{if(!env.DB)return [];const r=await env.DB.prepare(sql).bind(...values).all<Row>();return r.results||[];};
export async function onRequestGet({request,env}:{request:Request;env:Env}){
 if(!(await validSession(request,env)))return Response.json({error:'unauthorized'},{status:401});
 if(!env.DB)return Response.json({error:'database_unavailable'},{status:503});
 const url=new URL(request.url),now=new Date(),today=now.toISOString().slice(0,10);
 const from=iso(url.searchParams.get('from'),today),to=iso(url.searchParams.get('to'),today);
 if(from>to)return Response.json({error:'invalid_date_range'},{status:400});
 const start=from+'T00:00:00.000Z',end=new Date(Date.parse(to+'T00:00:00Z')+86400000).toISOString();
 const previousEnd=start,previousStart=new Date(Date.parse(start)-(Date.parse(end)-Date.parse(start))).toISOString();
 try{
  const [summary,topTargets,searches,zeroSearches,categories,locations,actions,pages,heatmap,ads,ai,traffic,devices,browsers,sources,live]=await Promise.all([
   all(env,"SELECT COUNT(CASE WHEN event='page_view' THEN 1 END) page_views,COUNT(DISTINCT session_id) sessions,COUNT(DISTINCT ip_hash) visitors,COUNT(CASE WHEN event='search' THEN 1 END) searches,COUNT(CASE WHEN event='search_zero_results' THEN 1 END) zero_searches,ROUND((SELECT AVG(total_seconds) FROM (SELECT session_id,SUM(CAST(json_extract(props_json,'$.duration_seconds') AS REAL)) total_seconds FROM events WHERE ts>=? AND ts<? AND event='time_on_page' AND session_id IS NOT NULL GROUP BY session_id)),1) avg_seconds,(SELECT CASE WHEN COUNT(*)=0 THEN 0 ELSE ROUND(100.0*SUM(CASE WHEN views=1 THEN 1 ELSE 0 END)/COUNT(*),1) END FROM (SELECT session_id,COUNT(*) views FROM events WHERE ts>=? AND ts<? AND event='page_view' AND session_id IS NOT NULL GROUP BY session_id)) bounce_rate FROM events WHERE ts>=? AND ts<?",start,end,start,end,start,end),
   all(env,"SELECT target_id id,target_label name,target_type category,COUNT(*) clicks,COUNT(CASE WHEN event='phone_click' THEN 1 END) calls,COUNT(CASE WHEN event='directions_click' THEN 1 END) directions,COUNT(CASE WHEN event='favorite_click' THEN 1 END) favorites FROM events WHERE ts>=? AND ts<? AND event IN ('place_click','phone_click','directions_click','favorite_click') AND target_id IS NOT NULL GROUP BY target_id,target_label,target_type ORDER BY clicks DESC LIMIT 20",start,end),
   all(env,"SELECT json_extract(props_json,'$.query') query,COUNT(*) count FROM events WHERE ts>=? AND ts<? AND event='search' GROUP BY query ORDER BY count DESC LIMIT 20",start,end),
   all(env,"SELECT json_extract(props_json,'$.query') query,COUNT(*) count FROM events WHERE ts>=? AND ts<? AND event='search_zero_results' GROUP BY query ORDER BY count DESC LIMIT 20",start,end),
   all(env,"SELECT json_extract(props_json,'$.category') category,COUNT(*) count FROM events WHERE ts>=? AND ts<? AND event='category_click' GROUP BY category ORDER BY count DESC LIMIT 20",start,end),
   all(env,"SELECT city,COUNT(*) count FROM events WHERE ts>=? AND ts<? AND city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 20",start,end),
   all(env,"SELECT event,COUNT(*) count FROM events WHERE ts>=? AND ts<? GROUP BY event ORDER BY count DESC LIMIT 30",start,end),
   all(env,"SELECT path,COUNT(CASE WHEN event='page_view' THEN 1 END) views,ROUND(AVG(CASE WHEN event='time_on_page' THEN CAST(json_extract(props_json,'$.duration_seconds') AS REAL) END),1) avg_seconds,MAX(CASE WHEN event='scroll_depth' THEN CAST(json_extract(props_json,'$.depth') AS INTEGER) END) max_scroll FROM events WHERE ts>=? AND ts<? GROUP BY path ORDER BY views DESC LIMIT 30",start,end),
   all(env,"SELECT path,CAST(json_extract(props_json,'$.x') AS REAL) x,CAST(json_extract(props_json,'$.y') AS REAL) y,COUNT(*) weight FROM events WHERE ts>=? AND ts<? AND event='heatmap_click' GROUP BY path,x,y ORDER BY weight DESC LIMIT 500",start,end),
   all(env,"SELECT json_extract(props_json,'$.placement') placement,COUNT(CASE WHEN event='ad_impression' THEN 1 END) impressions,COUNT(CASE WHEN event='ad_click' THEN 1 END) clicks FROM events WHERE ts>=? AND ts<? AND event IN ('ad_impression','ad_click') GROUP BY placement ORDER BY impressions DESC",start,end),
   all(env,"SELECT event,COUNT(*) count,json_extract(props_json,'$.topic') topic FROM events WHERE ts>=? AND ts<? AND event IN ('ai_open','ai_message') GROUP BY event,topic ORDER BY count DESC LIMIT 20",start,end),
   all(env,"SELECT substr(ts,1,13) hour,COUNT(*) count FROM events WHERE ts>=? AND ts<? GROUP BY hour ORDER BY hour",start,end),
   all(env,"SELECT device,COUNT(*) count FROM events WHERE ts>=? AND ts<? GROUP BY device ORDER BY count DESC",start,end),
   all(env,"SELECT browser,COUNT(*) count FROM events WHERE ts>=? AND ts<? GROUP BY browser ORDER BY count DESC",start,end),
   all(env,"SELECT referrer,COUNT(*) count FROM events WHERE ts>=? AND ts<? AND referrer IS NOT NULL AND referrer<>'' GROUP BY referrer ORDER BY count DESC LIMIT 20",start,end),
   all(env,"SELECT ts,event,path,target_label,city,device FROM events WHERE ts>=? AND ts<? ORDER BY ts DESC LIMIT 50",start,end)
  ]);
  const previousSummary=await all(env,"SELECT COUNT(CASE WHEN event='page_view' THEN 1 END) page_views,COUNT(DISTINCT session_id) sessions,COUNT(DISTINCT ip_hash) visitors,COUNT(CASE WHEN event='search' THEN 1 END) searches FROM events WHERE ts>=? AND ts<?",previousStart,previousEnd);
  return Response.json({range:{from,to},summary:summary[0]||{},previousSummary:previousSummary[0]||{},topTargets,searches,zeroSearches,categories,locations,actions,pages,heatmap,ads,ai,traffic,devices,browsers,sources,live},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'analytics_query_failed'},{status:503});}
}
