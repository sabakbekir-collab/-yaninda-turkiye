// Shared query definitions for server and browser Overpass requests.
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
export function buildOverpassQuery(category:string,lat:number,lon:number,radiusKm:number):string{
 const f=OSM_FILTERS[category];const meters=Math.max(2000,Math.min(30000,Math.round(radiusKm*1000)));
 const a=`(around:${meters},${lat},${lon})`;
 if(category==='government')return `[out:json][timeout:20];(node["office"="government"]${a};way["office"="government"]${a};relation["office"="government"]${a};node["amenity"~"townhall|courthouse|public_building"]${a};way["amenity"~"townhall|courthouse|public_building"]${a};relation["amenity"~"townhall|courthouse|public_building"]${a};);out center tags 300;`;
 return `[out:json][timeout:20];(node${f}${a};way${f}${a};relation${f}${a};);out center tags 300;`;
}
