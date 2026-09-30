export interface D1Result<T=unknown>{results?:T[]}
export interface D1PreparedStatement{bind(...values:unknown[]):D1PreparedStatement;first<T=unknown>():Promise<T|null>;all<T=unknown>():Promise<D1Result<T>>;run():Promise<D1Result>}
export interface D1Database{prepare(sql:string):D1PreparedStatement}
export interface Env{DB?:D1Database;ADMIN_EMAIL?:string;ADMIN_PASSWORD?:string;ADMIN_SESSION_SECRET?:string;OSM_CONTACT_EMAIL?:string}
const enc=new TextEncoder();
function b64(bytes:ArrayBuffer|Uint8Array){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'')}
function fromB64(s:string){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0))}
async function key(secret:string){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function signSession(email:string,secret:string){const payload=b64(enc.encode(JSON.stringify({email,exp:Date.now()+604800000})));const sig=b64(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(payload)));return payload+'.'+sig}
export async function verifySession(req:Request,secret?:string){if(!secret)return null;const m=req.headers.get('Cookie')?.match(/(?:^|; )yt_session=([^;]+)/);if(!m)return null;const [payload,sig]=m[1].split('.');try{if(!await crypto.subtle.verify('HMAC',await key(secret),fromB64(sig),enc.encode(payload)))return null;const d=JSON.parse(new TextDecoder().decode(fromB64(payload))) as {email?:string;exp?:number};return d.email&&d.exp&&d.exp>Date.now()?d.email:null}catch{return null}}
export function json(data:unknown,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}})}
export function clean(v:unknown,n=300){return typeof v==='string'?v.trim().replace(/[<>]/g,'').slice(0,n):''}
