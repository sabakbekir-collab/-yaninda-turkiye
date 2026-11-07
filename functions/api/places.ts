// Yanımda Türkiye places.ts — strict-null-safe production build
import type {Env,Place} from '../lib/types';
import {provinceCenter,isWholeProvince} from '../lib/provinceCenters';
import {resolveSearchAnchor,chooseSearchCenter,placesCacheKey} from '../lib/searchAnchor';
import {isCentralDistrict,trSlug,resolveName} from '../../src/text';
import {districtMap,districtsFor} from '../../src/turkeyDistricts';
import {OSM_FILTERS,UNNAMED_LABELS,buildOverpassQuery} from '../../src/osmQuery';
import {activeDutyDates,dutyDateKey,isActiveDutyDate} from '../lib/dutyDates';
import {classifyOverpassBody} from '../lib/overpassBody';
import {cachePolicyFor} from '../lib/placesCachePolicy';

type OsmEl={type:string;id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};

const filters=OSM_FILTERS;

// Explicit UTF-8 JSON responses prevent Turkish place names from being decoded
// with a legacy character set by embedded browsers and WebViews.
function jsonResponse(data:unknown,init?:ResponseInit){
  const headers=new Headers(init?.headers);
  headers.set('Content-Type','application/json; charset=utf-8');
  return new Response(JSON.stringify(data),{...init,headers});
}

// HTTP header values must be ASCII; Turkish dotless ı makes fetch() reject the request before sending it.
const OSM_UA='YanimdaTurkiye/1.0 (+https://yaninda-turkiye.sabakbekir.workers.dev)';
const clean=(s:unknown,n=300)=>typeof s==='string'?s.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,n):undefined;
const slug=trSlug;
const areaQuery=(district:string,province:string)=>[district&&!isCentralDistrict(district)?district:'',province,'Türkiye'].filter(Boolean).join(', ');
const distance=(a:number,b:number,c:number,d:number)=>{const r=6371,to=(x:number)=>x*Math.PI/180,dy=to(c-a),dx=to(d-b),v=Math.sin(dy/2)**2+Math.cos(to(a))*Math.cos(to(c))*Math.sin(dx/2)**2;return 2*r*Math.asin(Math.sqrt(v))};

function tidyAddress(tags:Record<string,string>,fallback?:string){
  const full=tags['addr:full']||tags['contact:address'];
  if(full)return clean(full);
  const parts=[tags['addr:street'],tags['addr:housenumber'],tags['addr:neighbourhood']||tags['addr:suburb'],tags['addr:district'],tags['addr:city']||tags['addr:town'],tags['addr:postcode']].filter(Boolean);
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
  const key='geocode:v3:'+slug(query);
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
  const name=clean(tags.name||tags['name:tr']||tags.brand||tags.operator)||UNNAMED_LABELS[category];
  if(!name||name.length<2||/^isimsiz( açık veri kaydı)?$/i.test(name))return null;
  const d=distance(lat,lon,p.lat,p.lon);
  const district=clean(tags['addr:district']||tags['addr:suburb']||tags['addr:town']||tags['addr:city']);
  return {
    id:'osm-'+x.type+'-'+x.id,name,category,lat:p.lat,lon:p.lon,
    address:tidyAddress(tags,tags.display_name),
    phone:clean(tags.phone||tags['contact:phone']||tags['contact:mobile']||tags.mobile,60),
    openingHours:clean(tags.opening_hours,180),
    website:clean(tags.website||tags['contact:website'],300),
    operator:clean(tags.operator||tags.brand,160),
    source:'OpenStreetMap',
    distance:d,
    district
  };
}

async function reverseArea(lat:number,lon:number):Promise<{province:string;district:string}|null>{
  try{
    const u=new URL('https://nominatim.openstreetmap.org/reverse');
    u.searchParams.set('format','jsonv2');u.searchParams.set('lat',String(lat));u.searchParams.set('lon',String(lon));
    // Zoom 12 exposes district/municipality details more reliably than zoom 10.
    u.searchParams.set('zoom','12');u.searchParams.set('addressdetails','1');u.searchParams.set('accept-language','tr');
    const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':OSM_UA},signal:AbortSignal.timeout(9000)});
    if(!r.ok)return null;
    const x=await r.json() as {address?:Record<string,string>};
    const a=x.address||{};
    const knownProvinces=Object.keys(districtMap);
    const province=[a.province,a.state,a.city,a.county,a.region].map(v=>v?resolveName(v,knownProvinces):undefined).find(Boolean)||'';
    if(!province)return null;
    const options=districtsFor(province);
    const candidates=[a.city_district,a.district,a.county,a.town,a.municipality,a.city].filter((v):v is string=>Boolean(v));
    let district='';
    for(const candidate of candidates){const hit=resolveName(candidate,options);if(hit){district=hit;break;}}
    if(!district&&candidates.some(v=>slug(v)===slug(province))&&options.some(v=>slug(v)==='merkez'))district='Merkez';
    return {province,district};
  }catch{return null}
}

export async function onRequestAreaGet({request}:{request:Request}){
  const u=new URL(request.url);
  const lat=Number(u.searchParams.get('lat'));
  const lon=Number(u.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<35||lat>43||lon<25||lon>46){
    return jsonResponse({error:'invalid_coordinates'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
  const area=await reverseArea(lat,lon);
  if(!area)return jsonResponse({error:'area_not_found'},{status:503,headers:{'Cache-Control':'no-store'}});
  return jsonResponse(area,{headers:{'Cache-Control':'no-store'}});
}

/**
 * Independent secondary roster. Turkpidya documents provincial pharmacists'
 * chambers and municipality lists as its source. Coverage is partial; accept
 * only dated records with coordinates, and never infer a duty date.
 */
async function turkpidyaDutyFallback(province:string,district:string,lat:number,lon:number):Promise<{places:Place[];ok:boolean;date?:string;reason?:string}>{
  try{
    const u=new URL('https://turkpidya.com/wp-json/turkpidya-data/v1/pharmacies/on-duty');
    u.searchParams.set('city',slug(province));
    const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':OSM_UA},signal:AbortSignal.timeout(9000)});
    if(!r.ok)return {places:[],ok:false,reason:'secondary_http_'+r.status};
    const body=await r.json() as unknown;
    const root=body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:{};
    const nested=root.data&&typeof root.data==='object'&&!Array.isArray(root.data)?root.data as Record<string,unknown>:{};
    const rows=Array.isArray(body)?body:Array.isArray(root.pharmacies)?root.pharmacies:Array.isArray(root.data)?root.data:Array.isArray(nested.pharmacies)?nested.pharmacies:Array.isArray(nested.items)?nested.items:Array.isArray(root.results)?root.results:[];
    const rootDate=root.rosterDate??root.roster_date??root.sourceDate??root.source_date??root.date??root.tarih??nested.rosterDate??nested.roster_date??nested.date??nested.tarih;
    const out:Place[]=[];
    for(const [i,value] of rows.entries()){
      if(!value||typeof value!=='object'||Array.isArray(value))continue;
      const x=value as Record<string,unknown>;
      const recordDate=dutyDateKey(x.rosterDate??x.roster_date??x.sourceDate??x.source_date??x.dutyDate??x.duty_date??x.date??x.tarih??rootDate);
      if(!recordDate||!activeDutyDates().includes(recordDate))continue;
      const recordCity=clean(x.city??x.province??x.il);
      if(recordCity&&slug(recordCity)!==slug(province))continue;
      const recordDistrict=clean(x.district??x.ilce??x.county);
      if(district&&(!recordDistrict||slug(recordDistrict)!==slug(district)))continue;
      const location=x.location&&typeof x.location==='object'?x.location as Record<string,unknown>:{};
      const la=Number(x.lat??x.latitude??location.lat),lo=Number(x.lng??x.lon??x.longitude??location.lng??location.lon);
      const name=clean(x.name??x.pharmacyName??x.pharmacy_name??x.title??x.ad);
      if(!name||!Number.isFinite(la)||!Number.isFinite(lo)||la < 35||la > 43||lo < 25||lo > 46)continue;
      out.push({id:'turkpidya-duty-'+String(x.id??x.pharmacyId??x.pharmacy_id??i),name,category:'pharmacy',lat:la,lon:lo,
        address:clean(x.address??x.adres),phone:clean(x.phone??x.telephone??x.telefon,60),
        openingHours:clean(x.hours??x.dutyHours??x.duty_hours,180),
        source:'Veri: Turkpidya — il eczacı odaları ve belediyeler; tarihli kaynak listesi',
        distance:distance(lat,lon,la,lo),district:recordDistrict||undefined,isDuty:true,
        officialUrl:'https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama',
        verifiedAt:recordDate,dutyUpdatedAt:new Date().toISOString()});
    }
    out.sort((a,b)=>(a.distance??999)-(b.distance??999));
    const sourceDate=dutyDateKey(rootDate)||undefined;
    const hasDatedRows=rows.some(value=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return false;
      const x=value as Record<string,unknown>;
      return Boolean(x.rosterDate??x.roster_date??x.sourceDate??x.source_date??x.dutyDate??x.duty_date??x.date??x.tarih??rootDate);
    });
    const hasActiveDatedRows=rows.some(value=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return false;
      const x=value as Record<string,unknown>;
      return isActiveDutyDate(x.rosterDate??x.roster_date??x.sourceDate??x.source_date??x.dutyDate??x.duty_date??x.date??x.tarih??rootDate);
    });
    const stale=!out.length&&Boolean(
      (sourceDate&&!activeDutyDates().includes(sourceDate))||
      (hasDatedRows&&!hasActiveDatedRows)
    );
    return {places:out.slice(0,25),ok:!stale,date:sourceDate,reason:stale?'stale_duty_list':undefined};
  }catch(e){
    const timeout=e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError');
    return {places:[],ok:false,reason:timeout?'secondary_timeout':'secondary_error'};
  }
}

export async function dutyPharmacies(env:Env,province:string,district:string,lat:number,lon:number,_radiusKm:number):Promise<{places:Place[];ok:boolean;date?:string;reason?:string;providerStatus?:number}>{
  const buildPlaces=(data:{date?:string;pharmacies?:Array<Record<string,unknown>>},idPrefix:string,applyDistrictFilter:boolean)=>{
    if(!Array.isArray(data.pharmacies))return [];
    const out:Place[]=[];
    for(const [i,x] of data.pharmacies.entries()){
      // Provider JSON is untrusted: malformed null/primitive rows must not crash the whole response.
      if(!x||typeof x!=='object'||Array.isArray(x))continue;
      const coordinate=(...values:unknown[])=>{
        const value=values.find(v=>v!==null&&v!==undefined);
        if(typeof value==='string'&&!value.trim())return NaN;
        return Number(value);
      };
      const la=coordinate(x.lat,x.latitude),lo=coordinate(x.lng,x.lon,x.longitude),name=clean(x.name);
      if(!name||!Number.isFinite(la)||!Number.isFinite(lo)||la < 35||la > 43||lo < 25||lo > 46)continue;
      // Each record may carry its own duty date; otherwise the feed date applies. Unknown or stale dates are never shown as "nöbetçi".
      const recordDate=x.date??x.duty_date??x.dutyDate??x.nobet_tarihi;
      if(!isActiveDutyDate(recordDate??data.date))continue;
      const recordDistrict=clean(x.district);
      if(district&&recordDistrict&&slug(recordDistrict)!==slug(district))continue;
      if(!applyDistrictFilter&&district&&!recordDistrict)continue;
      const d=distance(lat,lon,la,lo);
      out.push({
        id:idPrefix+String(x.id??i),name,category:'pharmacy',lat:la,lon:lo,
        address:clean(x.address),phone:clean(x.phone,60),
        openingHours:clean(x.hours||x.opening_hours||x.duty_hours,180),
        source:'Veri: Eczane Adresi (CC BY 4.0) — resmî doğrulama değildir',distance:d,
        district:recordDistrict||undefined,isDuty:true,
        officialUrl:'https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama',
        verifiedAt:dutyDateKey(recordDate??data.date)||undefined,dutyUpdatedAt:new Date().toISOString()
      });
    }
    out.sort((a,b)=>(a.distance??999)-(b.distance??999));
    return out;
  };
  // Duty pharmacies are selected by province/district, never by a GPS radius.
  // GPS is used only to sort results by distance for convenience.
  if(!province)return {places:[],ok:false};
  try{
    let lastStatus:number|undefined;
    const fetchFeed=async(withDistrict:boolean)=>{
      const u=new URL('https://eczaneadresi.com/api/public/v1/duty-pharmacies');
      u.searchParams.set('city',slug(province));
      if(withDistrict&&district)u.searchParams.set('district',slug(district));
      u.searchParams.set('limit','200');
      const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':OSM_UA},signal:AbortSignal.timeout(10000)});
      if(!r.ok){lastStatus=r.status;return null}
      lastStatus=undefined;
      return await r.json() as {date?:string;pharmacies?:Array<Record<string,unknown>>};
    };
    let data=await fetchFeed(Boolean(district));
    let all=data?buildPlaces(data,'duty-pharmacy-district-',true):[];
    if(!all.length&&district){
      data=await fetchFeed(false);
      all=data?buildPlaces(data,'duty-pharmacy-province-',false):[];
    }
    if(!data){
      const st=lastStatus;
      const reason=st===429?'provider_rate_limited':st===403||st===401?'provider_forbidden':st===404?'provider_not_found':st&&st>=500?'provider_server_error':'provider_error';
      return {places:[],ok:false,reason,providerStatus:st};
    }
    // A feed dated neither today nor (before 09:00 TR) yesterday is stale: never show it as "nöbetçi".
    const anyActive=Array.isArray(data.pharmacies)&&data.pharmacies.some(x=>x&&typeof x==='object'&&isActiveDutyDate((x as Record<string,unknown>).date??(x as Record<string,unknown>).duty_date??(x as Record<string,unknown>).dutyDate??(x as Record<string,unknown>).nobet_tarihi??data.date));
    const feedDate=dutyDateKey(data.date);
    // An old feed date is stale even when the provider returns an empty array.
    // Previously an empty October feed was incorrectly reported as a healthy
    // "no records today" response for a November lookup.
    if(!all.length&&!anyActive&&(
      (feedDate!==null&&!activeDutyDates().includes(feedDate))||
      (Array.isArray(data.pharmacies)&&data.pharmacies.length>0)
    ))return {places:[],ok:false,date:String(data.date??''),reason:'stale_duty_list'};
    return {places:all.slice(0,25),ok:true,date:data.date};
  }catch(e){
    const timeout=e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError');
    return {places:[],ok:false,reason:timeout?'provider_timeout':'provider_error'};
  }
}

type PoiResult={places:Place[];ok:boolean;attempts?:string[];raw?:number;local?:boolean;partial?:boolean};

// D1-backed OSM snapshot. It is used only after the import marker exists;
// absent metadata means "not imported", never an authoritative empty result.
async function localPois(env:Env,category:string,lat:number,lon:number,radiusKm:number):Promise<PoiResult|null>{
  if(!env.DB)return null;
  try{
    const meta=await env.DB.prepare('SELECT n FROM poi_meta WHERE category=? LIMIT 1').bind(category).first<{n:number}>();
    if(!meta||!Number.isFinite(meta.n))return null;
    const dLat=radiusKm/111.32;
    const dLon=radiusKm/(111.32*Math.max(0.2,Math.cos(lat*Math.PI/180)));
    const rows=await env.DB.prepare('SELECT type,osm_id,lat,lon,tags FROM poi WHERE category=? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 10000')
      .bind(category,lat-dLat,lat+dLat,lon-dLon,lon+dLon).all<{type:string;osm_id:number;lat:number;lon:number;tags:string}>();
    const places:Place[]=[];
    for(const row of rows.results){
      let tags:Record<string,string>={};
      try{const parsed=JSON.parse(row.tags);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))tags=parsed as Record<string,string>}catch{/* malformed tags are ignored */}
      const p=osmPlace({type:row.type,id:Number(row.osm_id),lat:Number(row.lat),lon:Number(row.lon),tags},category,lat,lon);
      if(p&&(p.distance??Infinity)<=radiusKm)places.push(p);
    }
    places.sort((a,b)=>(a.distance??999)-(b.distance??999));
    return {ok:true,places:places.slice(0,250),raw:rows.results.length,local:true};
  }catch{return null}
}

async function getPois(env:Env,category:string,lat:number,lon:number,radiusKm:number):Promise<PoiResult>{
  const local=await localPois(env,category,lat,lon,radiusKm);
  // D1 is only an imported snapshot and may be incomplete. An empty local
  // snapshot must not suppress a live OpenStreetMap lookup (notably ATMs).
  if(local?.places.length)return local;
  const live=await overpass(category,lat,lon,radiusKm);
  if(live.ok&&live.places.length)return live;
  // An empty imported snapshot is not evidence that the area has no POIs.
  // If live providers fail, preserve that failure instead of converting it to a false zero.
  return live;
}

async function overpass(category:string,lat:number,lon:number,radiusKm:number):Promise<PoiResult>{
  const query=buildOverpassQuery(category,lat,lon,radiusKm);
  const endpoints=[
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
  ];
  const ask=async(endpoint:string):Promise<{elements:OsmEl[];partial:boolean}>=>{
    const r=await fetch(endpoint,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','User-Agent':OSM_UA},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(9000)});
    if(!r.ok)throw new Error('overpass_'+r.status);
    const classification=classifyOverpassBody(await r.json());
    if(classification.kind==='error')throw new Error(classification.reason);
    if(classification.kind==='empty')throw new Error('overpass_empty');
    return {elements:classification.elements as OsmEl[],partial:classification.kind==='partial'};
  };
  const runRound=()=>Promise.any(endpoints.map(ask));
  try{
    let response:{elements:OsmEl[];partial:boolean};
    try{response=await runRound();}
    catch(first){
      await new Promise(resolve=>setTimeout(resolve,1500));
      try{response=await runRound();}
      catch(second){
        const errors=[...(first instanceof AggregateError?first.errors:[first]),...(second instanceof AggregateError?second.errors:[second])];
        const attempts=errors.map(x=>x instanceof Error?x.message:String(x));
        // Only a remarkless empty response from every replica is a genuine zero.
        if(attempts.length&&attempts.every(x=>x==='overpass_empty'))return {ok:true,places:[],raw:0,attempts};
        return {ok:false,places:[],attempts:attempts.slice(0,10)};
      }
    }
    const mapped:Place[]=[];
    for(const x of response.elements){const p=osmPlace(x,category,lat,lon);if(p!==null)mapped.push(p)}
    mapped.sort((a,b)=>(a.distance??999)-(b.distance??999));
    return {ok:true,places:mapped,raw:response.elements.length,partial:response.partial};
  }catch(e){
    const attempts=e instanceof AggregateError?e.errors.map(x=>x instanceof Error?x.message:String(x)):[e instanceof Error?e.message:'overpass_error'];
    return {ok:false,places:[],attempts};
  }
}

const nomTerms:Record<string,string>={
  pharmacy:'eczane',hospital:'hastane',atm:'ATM',fuel:'akaryakıt istasyonu',market:'market',restaurant:'restoran',
  taxi:'taksi',hotel:'otel',police:'polis',fire_station:'itfaiye',cargo:'kargo',government:'resmi kurum',
  electrician:'elektrikçi',plumber:'tesisatçı',locksmith:'çilingir',cleaning:'temizlik',moving:'nakliye',
  hvac:'klima kombi',painter:'boya badana',car_repair:'oto servis',tyres:'lastikçi',phone_repair:'telefon tamiri',
  computer_repair:'bilgisayar tamiri',furniture:'mobilya',gardener:'bahçe',other:'hizmet',service:'hizmet',towing:'oto çekici'
};

async function nominatimFallback(env:Env,category:string,area:string,lat:number,lon:number,radiusKm:number):Promise<{places:Place[];ok:boolean}>{
  const term=nomTerms[category];if(!term)return {places:[],ok:true};
  const box=Math.max(0.018,Math.min(0.18,radiusKm/80));
  const key='nompoi:v4:'+slug([category,area,lat.toFixed(3),lon.toFixed(3),String(radiusKm)].join('|'));
  const cached=await dbCacheGet(env,key);
  if(Array.isArray(cached))return {places:cached as Place[],ok:true};
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');u.searchParams.set('q',area?term+', '+area:term);
    u.searchParams.set('limit','20');u.searchParams.set('countrycodes','tr');u.searchParams.set('layer','poi');
    u.searchParams.set('viewbox',`${(lon-box).toFixed(5)},${(lat+box).toFixed(5)},${(lon+box).toFixed(5)},${(lat-box).toFixed(5)}`);
    u.searchParams.set('bounded','1');u.searchParams.set('addressdetails','1');u.searchParams.set('accept-language','tr');
    const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':env.OSM_CONTACT_EMAIL?OSM_UA+' contact='+env.OSM_CONTACT_EMAIL:OSM_UA},signal:AbortSignal.timeout(7000)});
    if(!r.ok)return {places:[],ok:false};
    const rows=await r.json() as Array<Record<string,unknown>>;
    const mapped: Place[] = [];
    for (const [i, x] of rows.entries()) {
      const la=Number(x.lat),lo=Number(x.lon),a=(x.address||{}) as Record<string,unknown>,extra=(x.extratags||{}) as Record<string,unknown>;
      const name=clean(x.name)||clean(x.namedetails&&typeof x.namedetails==='object'?(x.namedetails as Record<string,unknown>).name:undefined)||clean(x.display_name)?.split(',')[0];
      if(!name||!Number.isFinite(la)||!Number.isFinite(lo))continue;
      const p:Place={
        id:'nominatim-'+category+'-'+String(x.osm_type||'x')+'-'+String(x.osm_id??i),name,category,lat:la,lon:lo,
        address:clean([a.road,a.house_number,a.neighbourhood||a.suburb,a.district,a.city||a.town].filter(Boolean).join(' ')),
        phone:clean(extra.phone||extra['contact:phone'],60),openingHours:clean(extra.opening_hours,180),
        website:clean(extra.website,300),operator:clean(extra.operator||extra.brand,160),
        source:'OpenStreetMap / Nominatim',distance:distance(lat,lon,la,lo),district:clean(a.district||a.suburb||a.town||a.city)
      };
      if (p.distance!<=radiusKm) mapped.push(p);
    }
    const result: Place[] = mapped;
    result.sort((a,b)=>(a.distance??999)-(b.distance??999));
    if(result.length)await dbCachePut(env,key,result,15*60*1000);
    return {places:result,ok:true};
  }catch{return {places:[],ok:false}}
}

export async function onRequestGet({request,env}:{request:Request;env:Env}){
  const u=new URL(request.url);
  const category=clean(u.searchParams.get('category')||'pharmacy')||'pharmacy';
  const rawProvince=clean(u.searchParams.get('province')||'')||'';
  const province=rawProvince?resolveName(rawProvince,Object.keys(districtMap))||'':'';
  const rawDistrict=clean(u.searchParams.get('district')||'')||'';
  // Older clients may send a neighbourhood in the district field. Only pass
  // official province-specific district names to geocoding and duty providers.
  const knownDistricts=province?districtsFor(province):[];
  const district=rawDistrict?(resolveName(rawDistrict,knownDistricts)||''):'';
  const radiusRequested=Number(u.searchParams.get('radius')||'5');
  const radiusKm=Math.max(2,Math.min(20,Number.isFinite(radiusRequested)?radiusRequested:5));
  const nearbyDistricts=u.searchParams.get('nearbyDistricts')==='1';
  const debug=u.searchParams.get('debug')==='1';

  if(!filters[category])return jsonResponse([]);

  const rawLat=u.searchParams.get('lat'),rawLon=u.searchParams.get('lon');
  const hasLat=rawLat!==null&&rawLat.trim()!=='',hasLon=rawLon!==null&&rawLon.trim()!=='';
  const anchor=resolveSearchAnchor(u.searchParams.get('anchor'),hasLat,hasLon);
  if(!anchor)return jsonResponse({error:'invalid_anchor_or_coordinates'},{status:400,headers:{'Cache-Control':'no-store'}});
  const numParam=(name:string)=>{const raw=u.searchParams.get(name);return raw!==null&&raw.trim()!==''?Number(raw):NaN};
  let lat=numParam('lat'),lon=numParam('lon');
  const hasPosition=hasLat&&hasLon&&Number.isFinite(lat)&&Number.isFinite(lon);
  if(hasLat&&hasLon&&!hasPosition)return jsonResponse({error:'invalid_coordinates'},{status:400,headers:{'Cache-Control':'no-store'}});
  if(hasPosition&&(lat<35||lat>43||lon<25||lon>46))return jsonResponse({error:'invalid_coordinates'},{status:400,headers:{'Cache-Control':'no-store'}});
  if(anchor==='gps'&&!hasPosition)return jsonResponse({error:'gps_coordinates_required'},{status:400,headers:{'Cache-Control':'no-store'}});
  const wholeProvince=!!province&&isWholeProvince(district,province);
  const capital=wholeProvince?provinceCenter(province):null;
  // Explicit GPS always wins. Explicit area uses the capital for Merkez/whole-province,
  // otherwise the geocoded district. Legacy clients retain the historic capital rule.
  let center=chooseSearchCenter({anchor,hasPosition,lat,lon,capital,province,district,geocode:null});
  if(!center){
    if(!province)return jsonResponse([]);
    const point=await geocode(env,areaQuery(district,province));
    if(!point)return jsonResponse({error:'location_geocode_failed',area:areaQuery(district,province),category},{status:503,headers:{'Cache-Control':'no-store'}});
    center=chooseSearchCenter({anchor,hasPosition,lat,lon,capital,province,district,geocode:point});
  }
  if(!center)return jsonResponse({error:'location_geocode_failed',area:areaQuery(district,province),category},{status:503,headers:{'Cache-Control':'no-store'}});
  lat=center.lat;lon=center.lon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<35||lat>43||lon<25||lon>46)return jsonResponse({error:'invalid_coordinates'},{status:400,headers:{'Cache-Control':'no-store'}});

  // Manual district searches are centered on the district and always honor the selected
  // radius. If nearby districts are enabled, broaden that radius by at least 1.5x.
  // Kullanıcının seçtiği yarıçap her aramada korunur. Yakın ilçeler açılırsa yalnızca kontrollü şekilde genişletilir.
  const effectiveRadius=nearbyDistricts?Math.min(30,radiusKm*1.5):radiusKm;

  // Never label an OSM pharmacy as "nöbetçi". Official duty integration is deliberately
  // disabled until a structured, current official feed is available.
  const key=placesCacheKey(category,anchor,lat.toFixed(4),lon.toFixed(4),province,district,String(effectiveRadius),nearbyDistricts?'1':'0');
  const cached=debug?null:await dbCacheGet(env,key);
  if(cached&&typeof cached==='object'&&!Array.isArray(cached)&&Array.isArray((cached as {places?:unknown}).places)){
    const snapshot=cached as {places:Place[];partial?:boolean};
    const policy=cachePolicyFor({ok:true,resultCount:snapshot.places.length,partial:snapshot.partial});
    return jsonResponse(snapshot.places,{headers:{'Cache-Control':policy.cacheControl,'X-Data-Source':'cache'}});
  }
  if(Array.isArray(cached)){
    const policy=cachePolicyFor({ok:true,resultCount:cached.length});
    return jsonResponse(cached,{headers:{'Cache-Control':policy.cacheControl,'X-Data-Source':'cache'}});
  }

  // Eczane kategorisi yalnızca güncel nöbet verisini kullanır.
  // OSM'deki genel eczaneler nöbetçi gibi gösterilmez.
  if(category==='pharmacy'){
    let dutyProvince=province;
    let dutyDistrict=district;
    if(!dutyProvince){
      const area=await reverseArea(lat,lon);
      dutyProvince=area?.province||'';
      dutyDistrict=area?.district||'';
    }
    if(!dutyProvince)return jsonResponse(debug?{ok:false,error:'duty_pharmacy_location_unknown',input:{province,district},coordinates:{lat,lon},geocodedArea:null,activeDutyDates:activeDutyDates()}:{error:'duty_pharmacy_location_unknown'},{status:400,headers:{'Cache-Control':'no-store'}});
    const primaryDuty=await dutyPharmacies(env,dutyProvince,dutyDistrict,lat,lon,effectiveRadius);
    // Fall back to a separate chamber/municipality-backed roster only if the
    // primary provider has no current dated entries. Do not merge rosters.
    let dutyResult=primaryDuty.places.slice(0,40);
    let dutySource='Eczane Adresi';
    let dutyDate=primaryDuty.date;
    let secondaryReason:string|undefined;
    let secondaryDate:string|undefined;
    if(!dutyResult.length){
      const secondary=await turkpidyaDutyFallback(dutyProvince,dutyDistrict,lat,lon);
      secondaryReason=secondary.reason;
      secondaryDate=secondary.date;
      if(secondary.places.length){
        dutyResult=secondary.places;
        dutySource='Turkpidya (il eczacı odaları ve belediyeler)';
        dutyDate=secondary.date;
      }
    }
    if(!dutyResult.length){
      const stale=primaryDuty.reason==='stale_duty_list'||secondaryReason==='stale_duty_list';
      const failed=!primaryDuty.ok||Boolean(secondaryReason)||stale;
      const reason=stale?'stale_duty_list':primaryDuty.reason||secondaryReason||'no_current_duty_records';
      const status=failed&&primaryDuty.reason==='provider_rate_limited'?429:failed?503:200;
      const body=debug?{ok:!failed,error:failed?'duty_pharmacy_unavailable':'no_current_duty_records',reason,secondaryReason,providerStatus:primaryDuty.providerStatus,feedDate:dutyDate||null,sourceDates:{eczaneAdresi:dutyDate||null,turkpidya:secondaryDate||null},query:{category,province,district,normalizedProvince:slug(dutyProvince),normalizedDistrict:slug(dutyDistrict)},coordinates:{lat,lon},activeDutyDates:activeDutyDates(),resultCount:0,sourcesTried:['Eczane Adresi','Turkpidya']}:{error:failed?'duty_pharmacy_unavailable':'no_current_duty_records',reason,secondaryReason,date:dutyDate||secondaryDate};
      return jsonResponse(body,{status,headers:{'Cache-Control':'no-store'}});
    }
    if(debug)return jsonResponse({ok:true,source:dutySource,query:{category,province,district,normalizedProvince:slug(dutyProvince),normalizedDistrict:slug(dutyDistrict)},coordinates:{lat,lon},feedDate:dutyDate||null,activeDutyDates:activeDutyDates(),resultCount:dutyResult.length,reason:null,sample:dutyResult.slice(0,5)}, {headers:{'Cache-Control':'no-store','X-Data-Source':dutySource}});
    // Never cache an empty duty result: an upstream "today" miss must not
    // become a persistent false zero.
    if(dutyResult.length)await dbCachePut(env,key,dutyResult,5*60*1000);
    const headers=new Headers({'Cache-Control':dutyResult.length?'public,max-age=300':'no-store','X-Data-Source':'Eczane Adresi'});
    headers.set('X-Data-Source',dutySource);
    if(dutyDate)headers.set('X-Duty-Date',dutyDate);
    return jsonResponse(dutyResult,{headers});
  }

  const primary=await getPois(env,category,lat,lon,effectiveRadius);
  let places=primary.places;
  let upstreamOk=primary.ok;
  const attempts=primary.attempts||[];
  const rawCount=primary.raw;
  if(!places.length){
    // GPS searches may not have a manually selected province/district.
    // Resolve the area for the text-search fallback, but keep coordinate-based
    // search working even if reverse geocoding is temporarily unavailable.
    let fallbackArea=areaQuery(district,province);
    if(!fallbackArea){
      const resolved=await reverseArea(lat,lon);
      fallbackArea=areaQuery(resolved?.district||'',resolved?.province||'');
    }
    const fallback=await nominatimFallback(env,category,fallbackArea,lat,lon,effectiveRadius);
    places=fallback.places;
    // A successful empty provider response is a valid zero-result response;
    // only report upstream failure when every source failed.
    if(fallback.places.length)upstreamOk=true;
  }

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

  if(!result.length&&!upstreamOk)return jsonResponse({error:'upstream_unavailable',attempts,center:{lat,lon}},{status:503,headers:{'Cache-Control':'no-store'}});
  const partial=Boolean(primary.partial);
  const policy=cachePolicyFor({ok:true,resultCount:result.length,partial});
  if(policy.shouldCache)await dbCachePut(env,key,{places:result,partial},policy.ttlMs);
  return jsonResponse(result,{headers:{'Cache-Control':policy.cacheControl,'X-Data-Source':primary.local?'OpenStreetMap (D1 yerel kopya)':'OpenStreetMap','X-Upstream-Raw':String(rawCount??'')}});
}
