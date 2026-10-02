import type {Place,Position} from './types';
export async function findPlaces(category:string,position?:Position,province?:string,district?:string):Promise<Place[]>{
  const p=new URLSearchParams({category});
  if(position){p.set('lat',String(position.lat));p.set('lon',String(position.lon));}
  if(province)p.set('province',province);
  if(district)p.set('district',district);
  // Nearby results are live data; add a cache-buster so an old browser/service-worker
  // response can never keep showing a stale zero-result response.
  p.set('_',String(Date.now()));
  const r=await fetch('/api/places?'+p.toString(),{signal:AbortSignal.timeout(20000),cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('places unavailable');
  const data=await r.json();
  if(!Array.isArray(data))throw new Error('invalid places response');
  return data;
}
export function track(type:string,metadata:Record<string,string|number|boolean>={}){fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,metadata}),keepalive:true}).catch(()=>undefined)}
