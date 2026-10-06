import {Armchair,Banknote,Bus,Car,Fuel,Hospital,Hotel,KeyRound,Laptop,Package,Paintbrush,Pill,ShieldCheck,ShoppingBasket,Siren,Smartphone,Snowflake,Store,TreePine,Truck,Utensils,Wrench,Zap} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

export function formatDistance(km?:number){
  if(typeof km!=='number'||!Number.isFinite(km))return 'Mesafe bilinmiyor';
  if(km<1)return Math.round(km*1000)+' m';
  return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(km)+' km';
}
export function cleanCardAddress(address?:string){
  if(!address)return 'Adres bilgisi bulunmuyor';
  return address.split(',').map(x=>x.trim()).filter(Boolean).filter(x=>!/^(marmara bölgesi|türkiye)$/i.test(x)).slice(0,4).join(', ');
}
export function categoryIcon(id:string):LucideIcon{
  const map:Record<string,LucideIcon>={
    pharmacy:Pill,hospital:Hospital,atm:Banknote,fuel:Fuel,market:ShoppingBasket,bakery:ShoppingBasket,restaurant:Utensils,taxi:Bus,transport:Bus,
    hotel:Hotel,cargo:Package,police:ShieldCheck,fire_station:Siren,electrician:Zap,plumber:Wrench,locksmith:KeyRound,
    cleaning:Store,moving:Truck,towing:Truck,hvac:Snowflake,painter:Paintbrush,car_repair:Car,tyres:Store,phone_repair:Smartphone,
    computer_repair:Laptop,furniture:Armchair,gardener:TreePine
  };
  return map[id]||Wrench;
}