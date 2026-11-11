import {Share} from '@capacitor/share';
import type {Place} from './types';

export type ShareResult='shared'|'copied'|'cancelled'|'failed';

export const mapsLink=(lat:number,lon:number)=>'https://www.google.com/maps/search/?api=1&query='+lat+','+lon;

type PlaceDestination=Pick<Place,'name'|'address'|'lat'|'lon'|'coordsUnknown'>;
function destinationForPlace(place:PlaceDestination){
  if(!place.coordsUnknown&&typeof place.lat==='number'&&Number.isFinite(place.lat)&&typeof place.lon==='number'&&Number.isFinite(place.lon))return place.lat+','+place.lon;
  return [place.name,place.address].filter(Boolean).join(', ');
}
export function mapsLinkForPlace(place:PlaceDestination){
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(destinationForPlace(place));
}
export function directionsLinkForPlace(place:PlaceDestination){
  return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destinationForPlace(place));
}

export async function shareText(title:string,text:string,url?:string):Promise<ShareResult>{
  try{
    if(typeof navigator.share==='function'){
      await navigator.share(url?{title,text,url}:{title,text});
      return 'shared';
    }
    const can=await Share.canShare();
    if(can.value){
      await Share.share(url?{title,text,url}:{title,text});
      return 'shared';
    }
  }catch(e){
    const name=e instanceof Error?e.name+' '+e.message:'';
    if(/abort|cancel/i.test(name))return 'cancelled';
  }
  try{
    await navigator.clipboard.writeText(url?text+'\n'+url:text);
    return 'copied';
  }catch{return 'failed'}
}