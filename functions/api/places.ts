import type {Env,Place} from '../lib/types';

type OsmEl={type:string;id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};

const filters:Record<string,string>={
  pharmacy:'["amenity"="pharmacy"]',
  hospital:'["amenity"~"hospital|clinic"]',
  atm:'["amenity"="atm"]',
  police:'["amenity"="police"]',
  fire_station:'["amenity"="fire_station"]',
  fuel:'["amenity"="fuel"]',
  taxi:'["amenity"="taxi"]',
  market:'["shop"~"supermarket|convenience"]',
  restaurant:'["amenity"~"restaurant|fast_food"]',
  hotel:'["tourism"~"hotel|hostel|guest_house"]',
  cargo:'["amenity"="post_office"]',
  towing:'["service:vehicle:recovery"="yes"]',
  government:'["office"="government"]',
  electrician:'["craft"="electrician"]',
  plumber:'["craft"="plumber"]',
  locksmith:'["craft"="locksmith"]',
  cleaning:'["craft"="cleaning"]',
  moving:'["craft"="moving_company"]',
  hvac:'["craft"~"hvac|heating_engineer"]',
  painter:'["craft"="painter"]',
  car_repair:'["shop"="car_repair"]',
  tyres:'["shop"="tyres"]',
  phone_repair:'["shop"="mobile_phone"]',
  computer_repair:'["shop"="computer"]',
  furniture:'["craft"="carpenter"]',
  gardener:'["craft"="gardener"]',
  other:'["craft"]',
  service:'["craft"]'
};

const OSM_UA='YanımdaTürkiye/1.0 (+https://yaninda-turkiye.sabakbekir.workers.dev)';
const clean=(s:unknown,n=300)=>typeof s==='string'?s.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,n):undefined;
const slug=(s:string)=>s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ö/g,'o').replace(/ü/g,'u').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const distance=(a:number,b:number,c:number,d:number)=>{const r=6371,to=(x:number)=>x*Math.PI/180,dy=to(c-a),dx=to(d-b),v=Math.sin(dy/2)**2+Math.cos(to(a))*Math.cos(to(c))*Math.sin(dx/2)**2;return 2*r*Math.asin(Math.sqrt(v))};
const cacheKey=(...parts:string[])=>'places:v10:'+parts.join(':');

function tidyAddress(tags:Record<string,string>,fallback?:string){
  const parts=[tags['addr:street'],tags['addr:housenumber'],tags['addr:neighbourhood']||tags['addr:suburb'],tags['addr:district'],tags['addr:city']||tags['addr:town']].filter(Boolean);
  return clean(parts.join(' ')||fallback);
}

async function dbCacheGet(env:Env,key:string){
  if(!env.DB)return null;
  try{
    const row=await env.DB.prepare('SELECT payload,expires_at FROM api_cache WHERE cache_key=? AND expires_at>? LIMIT 1').bind(key,new Date().toISOString()).first<{payload:string;expires_at:string}>();
    return row?JSON.parse(row.payload):null;
  }catch{return null}
}
async function dbCachePut(env:Env,key:string,payload:unknown,ttlMs:number){
  if(!env.DB)return;
  try{
    await env.DB.prepare('INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at')
      .bind(key,JSON.stringify(payload),new Date(Date.now()+ttlMs).toISOString()).run();
  }catch{}
}

async function geocode(env:Env,query:string):Promise<{lat:number;lon:number}|null>{
  const key='geocode:v2:'+slug(query);
  const cached=await dbCacheGet(env,key);
  if(cached&&Number.isFinite(cached.lat)&&Number.isFinite(cached.lon))return {lat:Number(cached.lat),lon:Number(cached.lon)};
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');u.searchParams.set('limit','1');u.searchParams.set('countrycodes','tr');
    u.searchParams.set('q',query);
    const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':env.OSM_CONTACT_EMAIL?OSM_UA+' contact='+env.OSM_CONTACT_EMAIL:OSM_UA},signal:AbortSignal.timeout(7000)});
    if(!r.ok)return null;
    const rows=await r.json() as Array<{lat?:string;lon?:string}>;
    const row=rows[0];if(!row)return null;
    const value={lat:Number(row.lat),lon:Number(row.lon)};
    if(!Number.isFinite(value.lat)||!Number.isFinite(value.lon))return null;
    await dbCachePut(env,key,value,24*60*60*1000);
    return value;
  }catch{return null}
}

function osmPlace(x:OsmEl,category:string,lat:number,lon:number):Place|null{
  const p=x.center||{lat:x.lat!,lon:x.lon!};
  const tags=x.tags||{};
  const name=clean(tags.name||tags['name:tr']||tags.brand||tags.operator);
  if(!name||name.length<2||/^isimsiz( açık veri kaydı)?$/i.test(name))return null;
  const d=distance(lat,lon,p.lat,p.lon);
  const district=clean(tags['addr:district']||tags['addr:suburb']||tags['addr:town']||tags['addr:city']);
  return {
    id:'osm-'+x.type+'-'+x.id,name,category,lat:p.lat,lon:p.lon,
    address:tidyAddress(tags,tags.display_name),
    phone:clean(tags.phone||tags['contact:phone'],60),
    openingHours:clean(tags.opening_hours,180),
    website:clean(tags.website,300),
    operator:clean(tags.operator||tags.brand,160),
    source:'OpenStreetMap',
    distance:d,
    district
  };
}

async function overpass(category:string,lat:number,lon:number,radiusKm:number):Promise<Place[]>{
  const f=filters[category];
  const meters=Math.max(2000,Math.min(30000,Math.round(radiusKm*1000)));
  const query=category==='government'
    ? `[out:json][timeout:20];(node["office"="government"](around:${meters},${lat},${lon});way["office"="government"](around:${meters},${lat},${lon});relation["office"="government"](around:${meters},${lat},${lon});node["amenity"~"townhall|courthouse|public_building"](around:${meters},${lat},${lon});way["amenity"~"townhall|courthouse|public_building"](around:${meters},${lat},${lon});relation["amenity"~"townhall|courthouse|public_building"](around:${meters},${lat},${lon}););out center tags 80;`
    : `[out:json][timeout:20];(node${f}(around:${meters},${lat},${lon});way${f}(around:${meters},${lat},${lon});relation${f}(around:${meters},${lat},${lon}););out center tags 60;`;
  const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  for(const endpoint of endpoints){
    try{
      const r=await fetch(endpoint,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','User-Agent':OSM_UA},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(10000)});
      if(!r.ok)continue;
      const data=await r.json() as {elements?:OsmEl[]};
      if(Array.isArray(data.elements)){
        return data.elements.map(x=>osmPlace(x,category,lat,lon)).filter((x):x is Place=>Boolean(x)).sort((a,b)=>(a.distance??999)-(b.distance??999));
      }
    }catch{}
  }
  return [];
}

const nomTerms:Record<string,string>={
  pharmacy:'eczane',hospital:'hastane',atm:'ATM',fuel:'akaryakıt istasyonu',market:'market',restaurant:'restoran',
  taxi:'taksi',hotel:'otel',police:'polis',fire_station:'itfaiye',cargo:'kargo',government:'resmi kurum',
  electrician:'elektrikçi',plumber:'tesisatçı',locksmith:'çilingir',cleaning:'temizlik',moving:'nakliye',
  hvac:'klima kombi',painter:'boya badana',car_repair:'oto servis',tyres:'lastikçi',phone_repair:'telefon tamiri',
  computer_repair:'bilgisayar tamiri',furniture:'mobilya',gardener:'bahçe',other:'hizmet',service:'hizmet',towing:'oto çekici'
};

async function nominatimFallback(env:Env,category:string,area:string,lat:number,lon:number,radiusKm:number):Promise<Place[]>{
  const term=nomTerms[category];if(!term)return [];
  const box=Math.max(0.018,Math.min(0.18,radiusKm/80));
  const key='nompoi:v3:'+slug([category,area,lat.toFixed(3),lon.toFixed(3),String(radiusKm)].join('|'));
  const cached=await dbCacheGet(env,key);
  if(Array.isArray(cached))return cached as Place[];
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');u.searchParams.set('q',term+', '+area);
    u.searchParams.set('limit','20');u.searchParams.set('countrycodes','tr');u.searchParams.set('layer','poi');
    u.searchParams.set('viewbox',`${(lon-box).toFixed(5)},${(lat+box).toFixed(5)},${(lon+box).toFixed(5)},${(lat-box).toFixed(5)}`);
    u.searchParams.set('bounded','1');u.searchParams.set('addressdetails','1');u.searchParams.set('accept-language','tr');
    const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':env.OSM_CONTACT_EMAIL?OSM_UA+' contact='+env.OSM_CONTACT_EMAIL:OSM_UA},signal:AbortSignal.timeout(7000)});
    if(!r.ok)return [];
    const rows=await r.json() as Array<Record<string,unknown>>;
    const result=rows.map((x,i)=>{
      const la=Number(x.lat),lo=Number(x.lon),a=(x.address||{}) as Record<string,unknown>,extra=(x.extratags||{}) as Record<string,unknown>;
      const name=clean(x.name)||clean(x.namedetails&&typeof x.namedetails==='object'?(x.namedetails as Record<string,unknown>).name:undefined)||clean(x.display_name)?.split(',')[0];
      if(!name||!Number.isFinite(la)||!Number.isFinite(lo))return null;
      const p:Place={
        id:'nominatim-'+category+'-'+String(x.osm_type||'x')+'-'+String(x.osm_id??i),name,category,lat:la,lon:lo,
        address:clean([a.road,a.house_number,a.neighbourhood||a.suburb,a.district,a.city||a.town].filter(Boolean).join(' ')),
        phone:clean(extra.phone||extra['contact:phone'],60),openingHours:clean(extra.opening_hours,180),
        website:clean(extra.website,300),operator:clean(extra.operator||extra.brand,160),
        source:'OpenStreetMap / Nominatim',distance:distance(lat,lon,la,lo),district:clean(a.district||a.suburb||a.town||a.city)
      };
      return p.distance!<=radiusKm?p:null;
    }).filter((x):x is Place=>Boolean(x)).sort((a,b)=>(a.distance??999)-(b.distance??999));
    await dbCachePut(env,key,result,15*60*1000);
    return result;
  }catch{return []}
}

export async function onRequestGet({request,env}:{request:Request;env:Env}){
  const u=new URL(request.url);
  const category=clean(u.searchParams.get('category')||'pharmacy')||'pharmacy';
  const province=clean(u.searchParams.get('province')||'')||'';
  const district=clean(u.searchParams.get('district')||'')||'';
  const radiusRequested=Number(u.searchParams.get('radius')||'5');
  const radiusKm=Math.max(2,Math.min(20,Number.isFinite(radiusRequested)?radiusRequested:5));
  const nearbyDistricts=u.searchParams.get('nearbyDistricts')==='1';

  if(!filters[category])return Response.json([]);

  let lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
  const hasPosition=Number.isFinite(lat)&&Number.isFinite(lon);
  if(!hasPosition){
    if(!province)return Response.json([]);
    const area=[district,province,'Türkiye'].filter(Boolean).join(', ');
    const point=await geocode(env,area);
    if(!point)return Response.json([]);
    lat=point.lat;lon=point.lon;
  }
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<35||lat>43||lon<25||lon>46)return Response.json([]);

  // A manual province search is broader; a selected district is centered on that district.
  // The explicit nearby-district toggle controls the radius used around the selected point.
  const effectiveRadius=hasPosition?radiusKm:(district?(nearbyDistricts?radiusKm:2):(nearbyDistricts?radiusKm:20));

  // Never label an OSM pharmacy as "nöbetçi". Official duty integration is deliberately
  // disabled until a structured, current official feed is available.
  if(category==='pharmacy'){
    const key=cacheKey(category,lat.toFixed(3),lon.toFixed(3),province,district,String(effectiveRadius),nearbyDistricts?'1':'0');
    const cached=await dbCacheGet(env,key);
    if(Array.isArray(cached))return Response.json(cached,{headers:{'Cache-Control':'public,max-age=300','X-Data-Source':'OpenStreetMap cache'}});
  }

  const key=cacheKey(category,lat.toFixed(3),lon.toFixed(3),province,district,String(effectiveRadius),nearbyDistricts?'1':'0');
  const cached=await dbCacheGet(env,key);
  if(Array.isArray(cached)&&cached.length)return Response.json(cached,{headers:{'Cache-Control':'public,max-age=900','X-Data-Source':'cache'}});

  let places=await overpass(category,lat,lon,effectiveRadius);
  if(!places.length)places=await nominatimFallback(env,category,[district,province,'Türkiye'].filter(Boolean).join(', '),lat,lon,effectiveRadius);

  let approved:Place[]=[];
  if(env.DB){
    try{
      const sql=province&&district
        ? "SELECT id,name,category,latitude,longitude,address,phone,hours FROM submissions WHERE status='approved' AND category=? AND province=? AND district=?"
        : "SELECT id,name,category,latitude,longitude,address,phone,hours FROM submissions WHERE status='approved' AND category=?";
      const rows=await env.DB.prepare(sql).bind(...(province&&district?[category,province,district]:[category])).all<Record<string,unknown>>();
      approved=rows.results.map(x=>({
        id:'approved-'+x.id,name:String(x.name),category:String(x.category),lat:Number(x.latitude),lon:Number(x.longitude),
        address:clean(x.address),phone:clean(x.phone,60),openingHours:clean(x.hours,180),
        source:'Yanımda Türkiye — onaylı kayıt',distance:distance(lat,lon,Number(x.latitude),Number(x.longitude)),
        district:district||undefined
      })).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.distance!==undefined&&p.distance<=effectiveRadius);
      approved=approved.filter(p=>p.name.trim().length>=2);
    }catch{}
  }

  const result=[...approved,...places]
    .filter(p=>p.name.trim().length>=2&&!/^isimsiz( açık veri kaydı)?$/i.test(p.name.trim()))
    .filter(p=>typeof p.distance!=='number'||p.distance<=effectiveRadius)
    .sort((a,b)=>(a.distance??999)-(b.distance??999))
    .slice(0,40);

  await dbCachePut(env,key,result,15*60*1000);
  return Response.json(result,{headers:{'Cache-Control':'public,max-age=300','X-Data-Source':'OpenStreetMap'}});
}
