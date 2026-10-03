import type {Place,Position} from './types';

export type PlaceSearchOptions={
  radiusKm?:number;
  nearbyDistricts?:boolean;
};

export async function findPlaces(
  category:string,
  position?:Position,
  province?:string,
  district?:string,
  options:PlaceSearchOptions={}
):Promise<Place[]>{
  const p=new URLSearchParams({category});
  if(position){p.set('lat',String(position.lat));p.set('lon',String(position.lon));}
  if(province)p.set('province',province);
  if(district)p.set('district',district);
  p.set('radius',String(options.radiusKm??5));
  p.set('nearbyDistricts',options.nearbyDistricts?'1':'0');

  const r=await fetch('/api/places?'+p.toString(),{
    signal:AbortSignal.timeout(25000),
    cache:'no-store',
    headers:{Accept:'application/json'}
  });
  let data:unknown;
  try { data=await r.json(); } catch { data=undefined; }
  if(!r.ok){
    if(r.status===503 && data && typeof data==='object' && 'error' in data && (data as {error?:unknown}).error==='upstream_unavailable'){
      throw new Error('Hizmet verisi sağlayıcısına şu anda ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.');
    }
    throw new Error('Hizmet verileri şu anda alınamadı.');
  }
  if(!Array.isArray(data))throw new Error('invalid places response');
  return data.filter((p):p is Place=>Boolean(
    p&&typeof p.name==='string'&&p.name.trim().length>=2&&
    !/^isimsiz( açık veri kaydı)?$/i.test(p.name.trim())
  ));
}

export function track(type:string,metadata:Record<string,string|number|boolean>={}){
  fetch('/api/events',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({type,metadata}),
    keepalive:true
  }).catch(()=>undefined);
}
