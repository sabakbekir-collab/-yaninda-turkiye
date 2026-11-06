import type {Place,Position} from './types';
import {districtsFor} from './turkeyDistricts';
import {resolveName} from './text';

export type PlaceSearchOptions={
  radiusKm?:number;
  nearbyDistricts?:boolean;
  anchor?:'gps'|'area';
};

export type ResolvedLocationArea={province:string;district:string};

export async function resolveLocationArea(position:Position):Promise<ResolvedLocationArea>{
  const query=new URLSearchParams({lat:String(position.lat),lon:String(position.lon)});
  const response=await fetch('/api/location/area?'+query.toString(),{
    cache:'no-store',
    headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(11000)
  });
  if(!response.ok)throw new Error('Konumdan il ve ilçe bilgisi belirlenemedi.');
  const data=await response.json() as Partial<ResolvedLocationArea>;
  if(typeof data.province!=='string'||!data.province.trim())throw new Error('Konumdan il bilgisi alınamadı.');
  const province=data.province.trim();
  const rawDistrict=typeof data.district==='string'?data.district.trim():'';
  // Reverse geocoders sometimes return a neighbourhood/suburb in the district field.
  // Only accept a district that exactly matches the official district list for that province.
  const district=rawDistrict?(resolveName(rawDistrict,districtsFor(province))||''):'';
  return {province,district};
}

export async function findPlaces(
  category:string,
  position?:Position,
  province?:string,
  district?:string,
  options:PlaceSearchOptions={}
):Promise<Place[]>{
  const p=new URLSearchParams({category});
  if(position){p.set('lat',String(position.lat));p.set('lon',String(position.lon));}
  p.set('anchor',options.anchor||(position?'gps':'area'));
  if(province)p.set('province',province);
  if(district)p.set('district',district);
  p.set('radius',String(options.radiusKm??5));
  p.set('nearbyDistricts',options.nearbyDistricts?'1':'0');

  let r:Response;
  try{
    r=await fetch('/api/places?'+p.toString(),{
      signal:AbortSignal.timeout(25000),
      cache:'no-store',
      headers:{Accept:'application/json'}
    });
  }catch(e){
    if(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError'))throw new Error('Veri kaynağı zamanında yanıt vermedi. Lütfen "Tekrar Ara"ya dokun.');
    throw new Error('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.');
  }
  let data:unknown;
  try { data=await r.json(); } catch { data=undefined; }
  if(!r.ok){
    if(data&&typeof data==='object'&&'error' in data&&(data as {error?:unknown}).error==='location_geocode_failed'){
      throw new Error('Seçilen il / ilçe haritada konumlandırılamadı. İl ve ilçe seçimini kontrol et. İstersen isteğe bağlı Konumumu Kullan düğmesini deneyebilirsin.');
    }
    if(r.status===400 && data && typeof data==='object' && 'error' in data && (data as {error?:unknown}).error==='duty_pharmacy_location_unknown'){
      throw new Error('Nöbetçi eczane araması için il bilgisi belirlenemedi. Lütfen il seç. GPS izni zorunlu değildir.');
    }
    if((r.status===503||r.status===429) && data && typeof data==='object' && 'error' in data){
      const code=(data as {error?:unknown}).error;
      if(code==='duty_pharmacy_unavailable'){
        const reason=(data as {reason?:unknown}).reason;
        if(reason==='stale_duty_list'){const d=(data as {date?:unknown}).date;throw new Error('Kaynaktaki nöbet listesi güncel değil'+(typeof d==='string'&&d?' (kaynak tarihi: '+d+')':'')+'; yanlış bilgi göstermemek için sonuç gizlendi. Resmî e-Devlet sorgusunu kullanabilirsin.')}
        if(reason==='provider_rate_limited')throw new Error('Nöbetçi eczane kaynağı şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.');
        if(reason==='provider_timeout')throw new Error('Nöbetçi eczane kaynağı zamanında yanıt vermedi. Lütfen tekrar deneyin.');
        throw new Error('Güncel nöbetçi eczane verisine şu anda ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.');
      }
      if(code==='upstream_unavailable'){
        const attempts=(data as {attempts?:unknown}).attempts;
        const detail=Array.isArray(attempts)&&attempts.length?' Kaynak yanıtları: '+attempts.slice(0,3).map(String).join(' | '):'';
        throw new Error('Harita veri sağlayıcıları şu anda yanıt vermiyor. Birkaç dakika sonra tekrar deneyin.'+detail);
      }
    }
    throw new Error('Hizmet verileri şu anda alınamadı.');
  }
  if(!Array.isArray(data)){
    const payload=data&&typeof data==='object'?data as {error?:unknown;reason?:unknown;date?:unknown}:null;
    // No verified duty records is a valid empty result, not a malformed API response.
    if(category==='pharmacy'&&payload?.error==='no_current_duty_records')return [];
    if(payload?.error==='location_geocode_failed'){
      throw new Error('Seçilen il / ilçe haritada konumlandırılamadı. İl ve ilçe seçimini kontrol et. İstersen isteğe bağlı Konumumu Kullan düğmesini deneyebilirsin.');
    }
    const contentType=r.headers.get('content-type')||'';
    const detail=payload&&typeof payload.error==='string'
      ?payload.error
      :contentType.includes('text/html')?'server_returned_html':'unexpected_response_shape';
    throw new Error('Hizmet kaynağından beklenmeyen yanıt alındı ('+detail+'). Lütfen sayfayı yenileyip tekrar deneyin.');
  }
  const cleaned=data.filter((p):p is Place=>Boolean(
    p&&typeof p.name==='string'&&p.name.trim().length>=2&&
    !/^isimsiz( açık veri kaydı)?$/i.test(p.name.trim())&&
    (category!=='pharmacy'||p.isDuty===true)
  ));
  return cleaned;
}

export function track(type:string,metadata:Record<string,string|number|boolean>={}){
  fetch('/api/events',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({type,metadata}),
    keepalive:true
  }).catch(()=>undefined);
}
