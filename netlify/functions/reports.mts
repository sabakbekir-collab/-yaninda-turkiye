import type{Config}from'@netlify/functions';import{db}from'../../db/index.js';import{reports}from'../../db/schema.js';
const clean=(v:unknown,n:number)=>typeof v==='string'?v.trim().replace(/[<>]/g,'').slice(0,n):'';
const reasons=new Set(['wrong_info','wrong_phone','wrong_address','closed']);
export default async(req:Request)=>{if(req.method!=='POST')return new Response(null,{status:405});try{const b=await req.json(),placeId=clean(b.placeId,160),placeName=clean(b.placeName,160),reason=clean(b.reason,30);if(!placeId||!placeName||!reasons.has(reason))return Response.json({error:'invalid_input'},{status:400});await db.insert(reports).values({placeId,placeName,reason,details:clean(b.details,500)||null});return Response.json({ok:true},{status:201})}catch{return Response.json({error:'service_unavailable'},{status:503})}};
export const config:Config={path:'/api/reports'};
