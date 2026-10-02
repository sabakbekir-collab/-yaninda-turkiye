import type {Env,Place} from '../lib/types';

type OsmEl={type:string;id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};
const filters:Record<string,string>={pharmacy:'["amenity"="pharmacy"]',hospital:'["amenity"~"hospital|clinic"]',atm:'["amenity"="atm"]',police:'["amenity"="police"]',fire_station:'["amenity"="fire_station"]',fuel:'["amenity"="fuel"]',taxi:'["amenity"="taxi"]',market:'["shop"~"supermarket|convenience"]',restaurant:'["amenity"~"restaurant|fast_food"]',hotel:'["tourism"~"hotel|hostel|guest_house"]',cargo:'["amenity"="post_office"]',towing:'["service:vehicle:recovery"="yes"]',government:'["office"="government"]',electrician:'["craft"="electrician"]',plumber:'["craft"="plumber"]',locksmith:'["craft"="locksmith"]',cleaning:'["craft"="cleaning"]',moving:'["craft"="moving_company"]',hvac:'["craft"~"hvac|heating_engineer"]',painter:'["craft"="painter"]',car_repair:'["shop"="car_repair"]',tyres:'["shop"="tyres"]',phone_repair:'["shop"="mobile_phone"]',computer_repair:'["shop"="computer"]',furniture:'["craft"="carpenter"]',gardener:'["craft"="gardener"]',other:'["craft"]',service:'["craft"]'};
const distance=(a:number,b:number,c:number,d:number)=>{const r=6371,to=(x:number)=>x*Math.PI/180,dy=to(c-a),dx=to(d-b),v=Math.sin(dy/2)**2+Math.cos(to(a))*Math.cos(to(c))*Math.sin(dx/2)**2;return 2*r*Math.asin(Math.sqrt(v))};
const clean=(s:unknown,n=300)=>typeof s==='string'?s.replace(/[<>]/g,'').slice(0,n):undefined;
const slug=(s:string)=>s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ö/g,'o').replace(/ü/g,'u').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const dutyPharmacies=async(lat:number|undefined,lon:number|undefined,province:string,district:string):Promise<Place[]>=>{
  const url=new URL('https://eczaneadresi.com/api/public/v1/'+(lat!==undefined&&lon!==undefined?'nearest-pharmacies':'duty-pharmacies'));
  if(lat!==undefined&&lon!==undefined){
    url.searchParams.set('lat',String(lat));url.searchParams.set('lng',String(lon));url.searchParams.set('limit','15');
  }else{
    url.searchParams.set('city',slug(province));if(district)url.searchParams.set('district',slug(district));url.searchParams.set('limit','50');
  }
  try{
    const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'YanimdaTurkiye/1.0'},signal:AbortSignal.timeout(5500)});
    if(!r.ok)return [];
    const raw=await r.json() as Record<string,unknown>;
    const rows=Array.isArray(raw.pharmacies)?raw.pharmacies:Array.isArray(raw.data)?raw.data:[];
    return rows.map((p:Record<string,unknown>,i)=>({
      id:`duty-pharmacy-${String(p.id??i)}`,name:clean(p.name??p.title,160)||'Nöbetçi Eczane',category:'pharmacy',
      lat:Number(p.lat??(p.location as Record<string,unknown>|undefined)?.lat),lon:Number(p.lng??p.lon??(p.location as Record<string,unknown>|undefined)?.lng),
      address:clean(p.address,300),phone:clean(p.phone,50),openingHours:clean(p.duty_hours??p.opening_hours,150),
      website:clean(p.url,300),source:'Eczane Adresi',isDuty:true
    })).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>({...p,distance:lat!==undefined&&lon!==undefined?distance(lat,lon,p.lat,p.lon):undefined}));
  }catch{return []}
};

export async function onRequestGet({request,env}:{request:Request;env:Env}){
  const u=new URL(request.url),category=u.searchParams.get('category')||'pharmacy',province=clean(u.searchParams.get('province')||'')||'',district=clean(u.searchParams.get('district')||'')||'';
  if(!filters[category])return Response.json([]);
  let lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)){
    if(!province)return Response.json([]);
    try{
      const q=encodeURIComponent(`${district?district+', ':''}${province}, Türkiye`);
      const g=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${q}`,{headers:{'User-Agent':`YanimdaTurkiye/1.0 (${env.OSM_CONTACT_EMAIL||'public-web-app'})`},signal:AbortSignal.timeout(7000)});
      const found=(await g.json() as Array<{lat?:string;lon?:string}>)[0];if(!found)return Response.json([]);
      lat=Number(found.lat);lon=Number(found.lon);
    }catch{return Response.json([])}
  }
  if(lat<35||lat>43||lon<25||lon>46)return Response.json([]);
  if(category==='pharmacy'){
    let duty:Place[]=[];
    if(u.searchParams.has('lat')&&u.searchParams.has('lon')){
      duty=await dutyPharmacies(lat,lon,province,district);
    }else{
      // Run the district and city requests together. If the district endpoint
      // has a transient slug/index problem, the city response gives us a fast
      // second chance without doubling the wait time.
      const [districtRows,cityRows]=await Promise.all([
        dutyPharmacies(undefined,undefined,province,district),
        dutyPharmacies(undefined,undefined,province,''),
      ]);
      duty=districtRows;
      if(!duty.length&&cityRows.length){
        const wanted=slug(district);
        duty=cityRows.filter(p=>slug(p.address||'').includes(wanted));
      }
    }
    // If the duty-pharmacy source has no data, do not stop here.
    // Fall through to the general nearby-place search so the user still gets
    // real nearby pharmacies from OpenStreetMap instead of a misleading 0.
    // These fallback results are intentionally not marked as duty pharmacies.
    if(duty.length)return Response.json(duty.slice(0,40),{headers:{'Cache-Control':'public,max-age=300','X-Data-Source':'Eczane Adresi'}});
  }
  const key=`places:v8:${category}:${lat.toFixed(3)}:${lon.toFixed(3)}:${province}:${district}`;
  if(env.DB){
    try{
      const cached=await env.DB.prepare('SELECT payload,expires_at FROM api_cache WHERE cache_key=? AND expires_at>? LIMIT 1').bind(key,new Date().toISOString()).first<{payload:string;expires_at:string}>();
      if(cached){const parsed=JSON.parse(cached.payload);if(Array.isArray(parsed)&&parsed.length){const named=parsed.filter((p:unknown)=>{const n=typeof (p as {name?:unknown})?.name==='string'?String((p as {name:string}).name).trim():'';return n.length>=2&&!/^isimsiz( açık veri kaydı)?$/i.test(n);});if(named.length)return Response.json(named,{headers:{'X-Data-Source':'cache','X-Places-Version':'v8'}});}}
    }catch{}
  }
  try{
    const f=filters[category];
    const query=category==='government'
      ? `[out:json][timeout:20];(node["office"="government"](around:12000,${lat},${lon});way["office"="government"](around:12000,${lat},${lon});relation["office"="government"](around:12000,${lat},${lon});node["amenity"~"townhall|courthouse|public_building"](around:12000,${lat},${lon});way["amenity"~"townhall|courthouse|public_building"](around:12000,${lat},${lon});relation["amenity"~"townhall|courthouse|public_building"](around:12000,${lat},${lon}););out center tags 60;`
      : `[out:json][timeout:18];(node${f}(around:12000,${lat},${lon});way${f}(around:12000,${lat},${lon});relation${f}(around:12000,${lat},${lon}););out center tags 40;`;
    let body:{elements:OsmEl[]}|null=null;
    const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
    // Use GET for the first Overpass attempt. It is the simplest and most
    // portable form for a small read-only query and avoids request-body
    // handling differences on some edge/network paths.
    const responses=await Promise.all(endpoints.map(async endpoint=>{
      // Try POST first (the canonical Overpass form), then GET as a transport
      // fallback. This protects the search from edge/proxy differences.
      try{
        const response=await fetch(endpoint,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','User-Agent':'YanimdaTurkiye/1.0'},body:`data=${encodeURIComponent(query)}`,signal:AbortSignal.timeout(9000)});
        if(response.ok){
          const candidate=await response.json() as {elements?:OsmEl[]};
          if(Array.isArray(candidate.elements))return {elements:candidate.elements};
        }
      }catch{}
      try{
        const u=new URL(endpoint);
        u.searchParams.set('data',query);
        const response=await fetch(u.toString(),{method:'GET',headers:{Accept:'application/json','User-Agent':'YanimdaTurkiye/1.0'},signal:AbortSignal.timeout(9000),cache:'no-store'});
        if(!response.ok)return null;
        const candidate=await response.json() as {elements?:OsmEl[]};
        return Array.isArray(candidate.elements)?{elements:candidate.elements}:null;
      }catch{return null}
    }));
    body=responses.find(Boolean)||null;
    const elements=body?.elements||[];
    let places=elements.filter(x=>{const tags=x.tags||{};if(category==='pharmacy')return tags.amenity==='pharmacy';if(category==='hospital')return tags.amenity==='hospital'||tags.amenity==='clinic';if(category==='market')return tags.shop==='supermarket'||tags.shop==='convenience';if(category==='restaurant')return tags.amenity==='restaurant'||tags.amenity==='fast_food';if(category==='hotel')return tags.tourism==='hotel'||tags.tourism==='hostel'||tags.tourism==='guest_house';if(category==='government')return tags.office==='government'||['townhall','courthouse','public_building'].includes(tags.amenity||'');return Boolean(filters[category])}).map(x=>{const p=x.center||{lat:x.lat!,lon:x.lon!},tags=x.tags||{};const name=clean(tags.name||tags['name:tr']||tags.brand||tags.operator||tags.display_name);if(!name)return null;return{id:`osm-${x.type}-${x.id}`,name,category,lat:p.lat,lon:p.lon,address:clean([tags['addr:street'],tags['addr:housenumber'],tags['addr:district'],tags['addr:city']].filter(Boolean).join(' ')||tags.display_name),phone:clean(tags.phone||tags['contact:phone']),openingHours:clean(tags.opening_hours),website:clean(tags.website),operator:clean(tags.operator||tags.brand),source:'OpenStreetMap',distance:distance(lat,lon,p.lat,p.lon)}}).filter(p=>p!==null&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)).sort((a,b)=>(a?.distance??0)-(b?.distance??0));

    // Overpass can occasionally return an empty/timeout response from a
    // Cloudflare Worker. Use Nominatim as a second public OpenStreetMap source.
    // For manual province/district searches we explicitly include the selected
    // area in the query and use Nominatim's category filter. This prevents a
    // valid selection such as "Muş / Merkez" from becoming a false zero.
    if(!places.length){
      const nominatim:Record<string,{terms:string[];includes?:string[]}>= {
        pharmacy:{terms:['eczane','pharmacy'],includes:['osm.amenity.pharmacy']},
        hospital:{terms:['hastane','hospital','clinic'],includes:['osm.amenity.hospital','osm.amenity.clinic']},
        atm:{terms:['ATM','bank'],includes:['osm.amenity.atm']},
        fuel:{terms:['akaryakıt','fuel station','gas station'],includes:['osm.amenity.fuel']},
        market:{terms:['market','supermarket'],includes:['osm.shop.supermarket','osm.shop.convenience']},
        restaurant:{terms:['restoran','restaurant'],includes:['osm.amenity.restaurant','osm.amenity.fast_food']},
        taxi:{terms:['taksi','taxi'],includes:['osm.amenity.taxi']},
        hotel:{terms:['otel','hotel'],includes:['osm.tourism.hotel','osm.tourism.hostel','osm.tourism.guest_house']},
        police:{terms:['polis','police'],includes:['osm.amenity.police']},
        fire_station:{terms:['itfaiye','fire station'],includes:['osm.amenity.fire_station']},
        cargo:{terms:['kargo','post office'],includes:['osm.amenity.post_office']},
        government:{terms:['resmi kurum','government'],includes:['osm.office.government','osm.amenity.townhall','osm.amenity.courthouse']},
        electrician:{terms:['elektrikçi','electrician'],includes:['osm.craft.electrician']},
        plumber:{terms:['tesisatçı','plumber'],includes:['osm.craft.plumber']},
        locksmith:{terms:['çilingir','locksmith'],includes:['osm.craft.locksmith']},
        cleaning:{terms:['temizlik','cleaning'],includes:['osm.craft.cleaning']},
        moving:{terms:['nakliye','moving'],includes:['osm.craft.moving_company']},
        hvac:{terms:['klima','kombi','HVAC'],includes:['osm.craft.hvac','osm.craft.heating_engineer']},
        painter:{terms:['boya badana','painter'],includes:['osm.craft.painter']},
        car_repair:{terms:['oto servis','car repair'],includes:['osm.shop.car_repair']},
        tyres:{terms:['lastikçi','tyres'],includes:['osm.shop.tyres']},
        phone_repair:{terms:['telefon tamiri','phone repair'],includes:['osm.shop.mobile_phone']},
        computer_repair:{terms:['bilgisayar tamiri','computer repair'],includes:['osm.shop.computer']},
        furniture:{terms:['mobilya','carpenter'],includes:['osm.craft.carpenter']},
        gardener:{terms:['bahçe','gardener'],includes:['osm.craft.gardener']},
        other:{terms:['hizmet'],includes:['osm.craft']},
        service:{terms:['hizmet'],includes:['osm.craft']},
        towing:{terms:['çekici','towing'],includes:['osm.service.vehicle.recovery']},
      };
      const cfg=nominatim[category];
      if(cfg){
        const area=[district,province,'Türkiye'].filter(Boolean).join(', ');
        const box=0.10;
        const left=(lon-box).toFixed(5),right=(lon+box).toFixed(5);
        const top=(lat+box).toFixed(5),bottom=(lat-box).toFixed(5);
        const headers={Accept:'application/json','User-Agent':`YanimdaTurkiye/1.0 (${env.OSM_CONTACT_EMAIL||'public-web-app'})`};
        const rows:Record<string,unknown>[]=[];
        for(const term of cfg.terms){
          try{
            const nu=new URL('https://nominatim.openstreetmap.org/search');
            nu.searchParams.set('format','jsonv2');
            nu.searchParams.set('q',`${term}, ${area}`);
            nu.searchParams.set('limit','40');
            nu.searchParams.set('countrycodes','tr');
            nu.searchParams.set('layer','poi');
            nu.searchParams.set('viewbox',`${left},${top},${right},${bottom}`);
            nu.searchParams.set('bounded','1');
            nu.searchParams.set('addressdetails','1');
            nu.searchParams.set('accept-language','tr');
            for(const include of (cfg.includes||[]))nu.searchParams.append('include',include);
            const nr=await fetch(nu,{headers,signal:AbortSignal.timeout(6500)});
            if(!nr.ok)continue;
            const data=await nr.json() as unknown;
            if(Array.isArray(data))rows.push(...data as Record<string,unknown>[]);
            if(rows.length>=40)break;
          }catch{}
        }
        places=rows.map((x,i)=>{
          const la=Number(x.lat),lo=Number(x.lon),a=(x.address||{}) as Record<string,unknown>;
          const display=clean(x.display_name);
          const name=clean(x.name)||clean(x.namedetails&&typeof x.namedetails==='object'?(x.namedetails as Record<string,unknown>).name:undefined)||display?.split(',')[0];
          return {id:`nominatim-${category}-${String(x.osm_type||'x')}-${String(x.osm_id??i)}`,name:name||'',category,lat:la,lon:lo,
            address:display||clean([a.road,a.house_number,a.suburb,a.city,a.town,a.state].filter(Boolean).join(' ')),
            phone:clean((x.extratags as Record<string,unknown>|undefined)?.phone),
            openingHours:clean((x.extratags as Record<string,unknown>|undefined)?.opening_hours),
            website:clean((x.extratags as Record<string,unknown>|undefined)?.website),
            operator:clean((x.extratags as Record<string,unknown>|undefined)?.operator),source:'OpenStreetMap / Nominatim',
            distance:distance(lat,lon,la,lo)};
        }).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.name.trim().length>=2)
          .filter(p=>p.distance<=15)
          .sort((a,b)=>a.distance-b.distance);
      }
    }
    let approved:Place[]=[];
    if(env.DB){
      try{
        const q=province&&district?'SELECT id,name,category,latitude,longitude,address,phone,hours FROM submissions WHERE status=\'approved\' AND category=? AND province=? AND district=?':'SELECT id,name,category,latitude,longitude,address,phone,hours FROM submissions WHERE status=\'approved\' AND category=?';
        const rows=await env.DB.prepare(q).bind(...(province&&district?[category,province,district]:[category])).all<Record<string,unknown>>();
        approved=rows.results.filter(x=>x.latitude!=null&&x.longitude!=null).map(x=>({id:`approved-${x.id}`,name:String(x.name),category:String(x.category),lat:Number(x.latitude),lon:Number(x.longitude),address:clean(x.address),phone:clean(x.phone),openingHours:clean(x.hours),source:'Yanımda Türkiye — onaylı kayıt',distance:distance(lat,lon,Number(x.latitude),Number(x.longitude))}));
      }catch{}
    }
    const named=[...approved,...places].filter((p):p is NonNullable<typeof p>=>p!==null&&typeof p.name==='string'&&p.name.trim().length>0);
    // Never expose records without a real human-readable business name.
    // Some public OSM/open-data records contain coordinates but no name; those
    // are useful internally but must not appear as "İsimsiz" cards to users.
    const result=named.filter(p=>{
      const n=typeof p.name==='string'?p.name.trim():'';
      return n.length>=2 && !/^isimsiz( açık veri kaydı)?$/i.test(n);
    }).slice(0,40);
    if(env.DB&&result.length){try{await env.DB.prepare('INSERT INTO api_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').bind(key,JSON.stringify(result),new Date(Date.now()+30*60*1000).toISOString()).run()}catch{}}
    return Response.json(result,{headers:{'Cache-Control':'public,max-age=300','X-Data-Source':'OpenStreetMap'}});
  }catch{return Response.json([],{headers:{'Cache-Control':'no-store'}})}
}
