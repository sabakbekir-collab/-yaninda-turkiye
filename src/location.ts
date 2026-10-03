import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Position } from './types';

export type LocationErrorCode = 'permission_denied' | 'timeout' | 'unavailable' | 'unsupported' | 'unknown';

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string = code) {
    super(message); this.name = 'LocationError'; this.code = code;
  }
}

const CACHE_KEY = 'yt-location-v2';
const CACHE_MAX_AGE = 10 * 60 * 1000;

function readCachedLocation(): Position | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { position?: Position; savedAt?: number };
    if (!parsed.position || !Number.isFinite(parsed.position.lat) || !Number.isFinite(parsed.position.lon)) return undefined;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > CACHE_MAX_AGE) return undefined;
    return parsed.position;
  } catch { return undefined; }
}

function cacheLocation(position: Position) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ position, savedAt: Date.now() })); } catch {}
}

function mapError(code: number): LocationError {
  if (code === 1) return new LocationError('permission_denied');
  if (code === 2) return new LocationError('unavailable');
  if (code === 3) return new LocationError('timeout');
  return new LocationError('unknown');
}

async function nativeLocation(): Promise<Position> {
  let permissions = await Geolocation.checkPermissions();
  if (permissions.location === 'denied') throw new LocationError('permission_denied');
  if (permissions.location !== 'granted') permissions = await Geolocation.requestPermissions();
  if (permissions.location !== 'granted') throw new LocationError('permission_denied');
  try {
    const result = await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:12000,maximumAge:60000});
    const position = {lat:result.coords.latitude,lon:result.coords.longitude}; cacheLocation(position); return position;
  } catch {
    try {
      const result = await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:20000,maximumAge:0});
      const position = {lat:result.coords.latitude,lon:result.coords.longitude}; cacheLocation(position); return position;
    } catch (error) {
      if (error instanceof Error && /permission/i.test(error.message)) throw new LocationError('permission_denied');
      throw new LocationError('unavailable');
    }
  }
}

async function browserLocation(): Promise<Position> {
  if (!window.isSecureContext) throw new LocationError('unsupported','Konum için güvenli (HTTPS) bağlantı gerekir.');
  if (!('geolocation' in navigator)) throw new LocationError('unsupported');
  const cached = readCachedLocation();
  if (cached) return cached;
  if ('permissions' in navigator) {
    try {
      const permission = await navigator.permissions.query({name:'geolocation'});
      if (permission.state === 'denied') throw new LocationError('permission_denied');
    } catch (error) {
      if (error instanceof LocationError) throw error;
    }
  }
  const read = (enableHighAccuracy:boolean,timeout:number,maximumAge:number) => new Promise<Position>((resolve,reject)=>{
    navigator.geolocation.getCurrentPosition(({coords})=>{
      if (!Number.isFinite(coords.latitude)||!Number.isFinite(coords.longitude)) {reject(new LocationError('unavailable'));return;}
      const position={lat:coords.latitude,lon:coords.longitude}; cacheLocation(position); resolve(position);
    },error=>reject(mapError(error.code)),{enableHighAccuracy,timeout,maximumAge});
  });
  try { return await read(false,12000,60000); }
  catch(firstError) {
    if (firstError instanceof LocationError&&firstError.code==='permission_denied') throw firstError;
    return read(true,20000,0);
  }
}

export async function getCurrentLocation(): Promise<Position> {
  const cached = readCachedLocation();
  if (cached) return cached;
  if (Capacitor.isNativePlatform()) return nativeLocation();
  return browserLocation();
}

export function clearCachedLocation(){try{localStorage.removeItem(CACHE_KEY);}catch{}}
