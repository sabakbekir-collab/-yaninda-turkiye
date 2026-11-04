#!/usr/bin/env node
// Yanımda Türkiye — OpenStreetMap snapshot importer for Cloudflare D1.
// Usage: node scripts/import-osm.mjs [--categories=hospital,atm,fuel] [--out=./poi-sql]
// OSM data © OpenStreetMap contributors, ODbL 1.0.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const CATEGORY_QUERIES={
  hospital:['nwr["amenity"~"^(hospital|clinic)$"]'],
  atm:['nwr["amenity"="atm"]','nwr["amenity"="bank"]["atm"="yes"]'],
  fuel:['nwr["amenity"="fuel"]'],
  police:['nwr["amenity"="police"]'],
  fire_station:['nwr["amenity"="fire_station"]'],
  taxi:['nwr["amenity"="taxi"]'],
  cargo:['nwr["amenity"="post_office"]'],
  market:['nwr["shop"~"^(supermarket|convenience)$"]'],
  bakery:['nwr["shop"="bakery"]'],
  hotel:['nwr["tourism"~"^(hotel|hostel|guest_house)$"]'],
  restaurant:['nwr["amenity"~"^(restaurant|fast_food)$"]'],
  car_repair:['nwr["shop"="car_repair"]'],
  tyres:['nwr["shop"="tyres"]']
};
export const CORE=['hospital','atm','fuel','police','fire_station','taxi','cargo'];
const MIRRORS=[
 'https://overpass-api.de/api/interpreter',
 'https://lz4.overpass-api.de/api/interpreter',
 'https://overpass.private.coffee/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass.openstreetmap.fr/api/interpreter'
];
const KEEP_TAGS=['name','name:tr','brand','operator','phone','contact:phone','contact:mobile','mobile','opening_hours','website','contact:website','addr:full','contact:address','addr:street','addr:housenumber','addr:neighbourhood','addr:suburb','addr:district','addr:city','addr:town','addr:postcode'];
const BOUNDS={south:35.8,north:42.2,west:25.6,east:44.9};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export function tiles(step=2){
 const out=[];
 for(let south=BOUNDS.south;south<BOUNDS.north-1e-9;south+=step)
  for(let west=BOUNDS.west;west<BOUNDS.east-1e-9;west+=step)
   out.push({s:+south.toFixed(2),w:+west.toFixed(2),n:+Math.min(south+step,BOUNDS.north).toFixed(2),e:+Math.min(west+step,BOUNDS.east).toFixed(2)});
 return out;
}
export function slimTags(tags={}){
 const out={};
 for(const key of KEEP_TAGS){const value=tags?.[key];if(typeof value==='string'&&value.trim())out[key]=value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,200);}
 return out;
}
export function rowsFromElements(elements){
 const seen=new Map();
 for(const x of Array.isArray(elements)?elements:[]){
  if(!x||typeof x!=='object'||!x.type||x.id==null)continue;
  const p=x.center||{lat:x.lat,lon:x.lon};
  const lat=Number(p?.lat),lon=Number(p?.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<35||lat>43||lon<25||lon>46)continue;
  seen.set(x.type+'/'+x.id,{type:String(x.type),osm_id:Number(x.id),lat:+lat.toFixed(6),lon:+lon.toFixed(6),tags:JSON.stringify(slimTags(x.tags))});
 }
 return [...seen.values()];
}
const q=value=>"'"+String(value).replace(/'/g,"''")+"'";
export const SCHEMA_SQL=`CREATE TABLE IF NOT EXISTS poi(
 category TEXT NOT NULL,type TEXT NOT NULL,osm_id INTEGER NOT NULL,
 lat REAL NOT NULL,lon REAL NOT NULL,tags TEXT NOT NULL DEFAULT '{}',
 PRIMARY KEY(category,type,osm_id)
);
CREATE INDEX IF NOT EXISTS poi_cat_lat_lon ON poi(category,lat,lon);
CREATE TABLE IF NOT EXISTS poi_meta(category TEXT PRIMARY KEY,n INTEGER NOT NULL,imported_at TEXT NOT NULL);
`;
export function buildSqlFiles(category,rows,{chunk=5000,perInsert=25,importedAt=new Date().toISOString()}={}){
 const files=[],parts=Math.max(1,Math.ceil(rows.length/chunk));
 for(let i=0;i<parts;i++){
  const slice=rows.slice(i*chunk,(i+1)*chunk),lines=[];
  if(i===0)lines.push(`DELETE FROM poi WHERE category=${q(category)};`);
  for(let j=0;j<slice.length;j+=perInsert){
   const vals=slice.slice(j,j+perInsert).map(r=>`(${q(category)},${q(r.type)},${r.osm_id},${r.lat},${r.lon},${q(r.tags)})`).join(',');
   lines.push(`INSERT OR REPLACE INTO poi(category,type,osm_id,lat,lon,tags) VALUES ${vals};`);
  }
  // Marker is deliberately written only in the final chunk. Worker never switches
  // to an incomplete local snapshot while an import is still being applied.
  if(i===parts-1)lines.push(`INSERT OR REPLACE INTO poi_meta(category,n,imported_at) VALUES (${q(category)},${rows.length},${q(importedAt)});`);
  files.push({name:`${category}-${String(i+1).padStart(3,'0')}.sql`,sql:lines.join('\n')+'\n'});
 }
 return files;
}
async function fetchTile(category,t,{rounds=3,timeoutMs=120000}={}){
 const filters=CATEGORY_QUERIES[category].map(f=>`${f}(${t.s},${t.w},${t.n},${t.e});`).join('');
 const body='data='+encodeURIComponent(`[out:json][timeout:90];(${filters});out center tags;`);
 const errors=[];
 for(let round=0;round<rounds;round++){
  for(const url of MIRRORS){
   try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'YanimdaTurkiye-import/1.0'},body,signal:AbortSignal.timeout(timeoutMs)});
    if(!response.ok){errors.push(`${new URL(url).host}:${response.status}`);continue;}
    const data=await response.json();
    if(!Array.isArray(data.elements)){errors.push(`${new URL(url).host}:bad_body`);continue;}
    if(!data.elements.length&&data.remark&&/runtime error|timed out|out of memory|too busy/i.test(data.remark)){errors.push(`${new URL(url).host}:remark`);continue;}
    return data.elements;
   }catch(error){errors.push(`${new URL(url).host}:${error instanceof Error?error.message:String(error)}`);}
  }
  await sleep(3000*(round+1));
 }
 throw new Error(`tile ${t.s},${t.w} failed: ${errors.slice(-5).join(' | ')}`);
}
async function main(){
 const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
 const categories=(arg('categories')||CORE.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
 const out=path.resolve(arg('out')||'./poi-sql'),cache=path.resolve(arg('cache')||'./.osm-cache');
 for(const category of categories)if(!CATEGORY_QUERIES[category])throw new Error(`Unknown category: ${category}. Valid: ${Object.keys(CATEGORY_QUERIES).join(', ')}`);
 await mkdir(out,{recursive:true});await writeFile(path.join(out,'000-schema.sql'),SCHEMA_SQL);
 const allTiles=tiles();
 for(const category of categories){
  const dir=path.join(cache,category);await mkdir(dir,{recursive:true});
  const elements=[];let failed=0;
  for(const [index,tile] of allTiles.entries()){
   const file=path.join(dir,`${tile.s}_${tile.w}.json`);
   try{
    if(existsSync(file)){
     const saved=JSON.parse(await readFile(file,'utf8'));
     if(!Array.isArray(saved))throw new Error('invalid cached tile');
     elements.push(...saved);
    }else{
     const rows=await fetchTile(category,tile);
     await writeFile(file,JSON.stringify(rows));elements.push(...rows);await sleep(1500);
    }
    process.stdout.write(`\\r${category}: tile ${index+1}/${allTiles.length}`);
   }catch(error){failed++;console.error(`\\n${error instanceof Error?error.message:String(error)}`);}
  }
  process.stdout.write('\\n');
  if(failed){console.error(`${category}: ${failed} tile(s) failed; SQL not generated. Re-run to resume from cache.`);continue;}
  const rows=rowsFromElements(elements);
  for(const file of buildSqlFiles(category,rows))await writeFile(path.join(out,file.name),file.sql);
  console.log(`${category}: ${rows.length} unique POIs -> ${out}`);
 }
 console.log(`Apply schema first, then each category's SQL files in numeric order using Wrangler D1 remote execute. Do not apply a category's files out of order.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error);process.exitCode=1;});
