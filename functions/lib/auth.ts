import type {Env} from './types';

const encoder=new TextEncoder();
const toB64=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

async function sign(value:string,secret:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return toB64(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
async function expected(value:string,secret:string){return sign(value,secret);}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}

export async function makeSession(secret:string){
  const exp=Math.floor(Date.now()/1000)+60*60*24*7;
  const payload=String(exp);
  return payload+'.'+await sign(payload,secret);
}
export async function validSession(request:Request,env:Env){
  const secret=env.ADMIN_SESSION_SECRET;
  if(!secret)return false;
  const cookie=request.headers.get('Cookie')||'';
  const match=cookie.match(/(?:^|;\s*)yt_admin=([^;]+)/);
  if(!match)return false;
  const [exp,sig]=decodeURIComponent(match[1]).split('.');
  if(!exp||!sig||Number(exp)<Math.floor(Date.now()/1000))return false;
  const good=await expected(exp,secret);
  return safeEqual(sig,good);
}
export function cookieHeader(token:string){
  return `yt_admin=${encodeURIComponent(token)}; Path=/api/admin; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`;
}
export function clearCookie(){return 'yt_admin=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax';}
export function sameOrigin(request:Request){
  const origin=request.headers.get('Origin');
  if(!origin)return true;
  try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}
}
