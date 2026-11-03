import type {Place} from './types';
import {OSM_FILTERS,UNNAMED_LABELS,buildOverpassQuery} from './osmQuery';
const ENDPOINTS=[
 'https://overpass-api.de/api/interpreter',
 'https://overpass.private.coffee/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass.openstreetmap.fr/api/interpreter',
 'https://lz4.overpass-api.de/api/interpreter'
];
type OsmEl={type:string;id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};
function km(a:number,b:number,c:number,d:number){const r=6371,to=(x:number)=>x*Math.PI/180,dy=to(c-a),dx=to(d-b),v=Math.sin(dy/2)**2+Math.cos(to(a))*Math.cos(to(c))*Math.sin(dx/2)**2;return 2*r*Math.asin(Math.sqrt(v))}
const txt=(v:unknown,n=200)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,n)||undefined:undefined;
export async function overpassFromBrowser(category:string,lat:number,lon:number,radiusKm:number):Promise<Place[]>{
 if(!OSM_FILTERS[category]||category==='pharmacy')throw new Error('unsupported_category');
 const query=buildOverpassQuery(category,lat,lon,radiusKm);
 const ask=async(endpoint:string):Promise<OsmEl[]>=>{
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('overpass_'+r.status);
  const d=await r.json() as {elements?:OsmEl[]};if(!Array.isArray(d.elements))throw new Error('overpass_bad_body');return d.elements;
 };
 let elements:OsmEl[];
 try{elements=await Promise.any(ENDPOINTS.map(ask))}
 catch{
  await new Promise(res=>setTimeout(res,1500));
  elements=await Promise.any(ENDPOINTS.map(ask));
 }
 const out:Place[]=[];
 for(const x of elements){
  const p=x.center||(x.lat!==undefined&&x.lon!==undefined?{lat:x.lat,lon:x.lon}:null),t=x.tags||{};
  const name=txt(t.name||t['name:tr']||t.brand||t.operator,160)||UNNAMED_LABELS[category];
  if(!p||!name||name.length<2)continue;
  const distance=km(lat,lon,p.lat,p.lon);if(distance>radiusKm)continue;
  const street=[t['addr:street'],t['addr:housenumber'],t['addr:neighbourhood']||t['addr:suburb'],t['addr:district'],t['addr:city']||t['addr:town']].filter(Boolean).join(' ');
  out.push({id:'osm-'+x.type+'-'+x.id,name,category,lat:p.lat,lon:p.lon,address:txt(t['addr:full']||t['contact:address']||street,300),phone:txt(t.phone||t['contact:phone']||t['contact:mobile']||t.mobile,60),openingHours:txt(t.opening_hours,180),website:txt(t.website||t['contact:website'],300),operator:txt(t.operator||t.brand,160),source:'OpenStreetMap',distance,district:txt(t['addr:district']||t['addr:suburb']||t['addr:town']||t['addr:city'],80)});
 }
 out.sort((a,b)=>(a.distance??999)-(b.distance??999));return out.slice(0,40);
}
