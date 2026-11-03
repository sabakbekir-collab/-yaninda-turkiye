// Shared by the Worker (functions/api/places.ts) and browser fallback (src/overpassClient.ts).
export const OSM_FILTERS:Record<string,string>={
 pharmacy:'["amenity"="pharmacy"]',hospital:'["amenity"~"hospital|clinic"]',atm:'["amenity"="atm"]',
 police:'["amenity"="police"]',fire_station:'["amenity"="fire_station"]',fuel:'["amenity"="fuel"]',
 taxi:'["amenity"="taxi"]',market:'["shop"~"supermarket|convenience"]',restaurant:'["amenity"~"restaurant|fast_food"]',
 bakery:'["shop"="bakery"]',transport:'["public_transport"]',hotel:'["tourism"~"hotel|hostel|guest_house"]',
 cargo:'["amenity"="post_office"]',towing:'["service:vehicle:recovery"="yes"]',government:'["office"="government"]',
 electrician:'["craft"="electrician"]',plumber:'["craft"="plumber"]',locksmith:'["craft"="locksmith"]',
 cleaning:'["craft"="cleaning"]',moving:'["craft"="moving_company"]',hvac:'["craft"~"hvac|heating_engineer"]',
 painter:'["craft"="painter"]',car_repair:'["shop"="car_repair"]',tyres:'["shop"="tyres"]',
 phone_repair:'["shop"="mobile_phone"]',computer_repair:'["shop"="computer"]',furniture:'["craft"="carpenter"]',
 gardener:'["craft"="gardener"]',other:'["craft"]',service:'["craft"]'
};
// OSM often tags ATMs as a bank with atm=yes rather than amenity=atm.
const EXTRA_FILTERS:Record<string,string[]>={atm:['["amenity"="bank"]["atm"="yes"]']};
// Unnamed map features remain useful. Prefer brand/operator; otherwise use a truthful generic label.
export const UNNAMED_LABELS:Record<string,string>={
 atm:'ATM',fuel:'Akaryakıt istasyonu',police:'Polis',fire_station:'İtfaiye',taxi:'Taksi durağı'
};
export function buildOverpassQuery(category:string,lat:number,lon:number,radiusKm:number):string{
 const meters=Math.max(2000,Math.min(30000,Math.round(radiusKm*1000)));
 const a=`(around:${meters},${lat},${lon})`;
 if(category==='government')return `[out:json][timeout:20];(node["office"="government"]${a};way["office"="government"]${a};relation["office"="government"]${a};node["amenity"~"townhall|courthouse|public_building"]${a};way["amenity"~"townhall|courthouse|public_building"]${a};relation["amenity"~"townhall|courthouse|public_building"]${a};);out center tags 300;`;
 const filters=[OSM_FILTERS[category],...(EXTRA_FILTERS[category]||[])];
 const parts=filters.map(f=>`node${f}${a};way${f}${a};relation${f}${a};`).join('');
 return `[out:json][timeout:20];(${parts});out center tags 300;`;
}
