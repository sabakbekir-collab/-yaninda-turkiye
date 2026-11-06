// Shared by the Worker and browser fallback. Keep OSM requests small enough for public instances.
export const OSM_FILTERS:Record<string,string>={
 pharmacy:'["amenity"="pharmacy"]',hospital:'["amenity"="hospital"]',atm:'["amenity"="atm"]',
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
const EXTRA_FILTERS:Record<string,string[]>={
 atm:['["amenity"="bank"]["atm"="yes"]','["atm"="yes"]','["atm"="designated"]'],
 // Many Turkish public hospitals are tagged with healthcare=hospital rather
 // than amenity=hospital; include both schemas to avoid incomplete results.
 hospital:['["healthcare"="hospital"]']
};
export const UNNAMED_LABELS:Record<string,string>={atm:'ATM',fuel:'Akaryakıt istasyonu',police:'Polis',fire_station:'İtfaiye',taxi:'Taksi durağı'};
export function buildOverpassQuery(category:string,lat:number,lon:number,radiusKm:number):string{
 const meters=Math.max(2000,Math.min(30000,Math.round(radiusKm*1000)));
 const a=`(around:${meters},${lat},${lon})`;
 if(category==='government')return `[out:json][timeout:15];(node["office"="government"]${a};way["office"="government"]${a};relation["office"="government"]${a};node["amenity"~"townhall|courthouse|public_building"]${a};way["amenity"~"townhall|courthouse|public_building"]${a};relation["amenity"~"townhall|courthouse|public_building"]${a};);out center tags 250;`;
 const filters=[OSM_FILTERS[category],...(EXTRA_FILTERS[category]||[])];
 if(!filters[0])throw new Error('unsupported_category');
 const withRelations=category==='hospital'||category==='hotel'||category==='transport';
 const parts=filters.map(f=>`node${f}${a};way${f}${a};${withRelations?`relation${f}${a};`:''}`).join('');
 return `[out:json][timeout:15];(${parts});out center tags 250;`;
}
