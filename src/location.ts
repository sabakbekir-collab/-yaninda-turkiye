import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Position } from './types';

export type LocationErrorCode = 'permission_denied' | 'timeout' | 'unavailable' | 'unsupported' | 'unknown';
export type LocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string = code) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
  }
}

const CACHE_KEY = 'yt-location-v5';
const CACHE_MAX_AGE = 10 * 60 * 1000;

function isValidPosition(position?: Position): position is Position {
  return Boolean(
    position &&
    Number.isFinite(position.lat) &&
    Number.isFinite(position.lon) &&
    Math.abs(position.lat) <= 90 &&
    Math.abs(position.lon) <= 180,
  );
}

function readCachedLocation(): Position | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { position?: Position; savedAt?: number };
    if (!isValidPosition(parsed.position)) return undefined;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > CACHE_MAX_AGE) return undefined;
    return parsed.position;
  } catch {
    return undefined;
  }
}

function cacheLocation(position: Position) {
  if (!isValidPosition(position)) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ position, savedAt: Date.now() }));
  } catch {}
}

function mapError(code: number): LocationError {
  if (code === 1) return new LocationError('permission_denied');
  if (code === 2) return new LocationError('unavailable');
  if (code === 3) return new LocationError('timeout');
  return new LocationError('unknown');
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const p = await Geolocation.checkPermissions();
      return p.location === 'granted' ? 'granted' : p.location === 'denied' ? 'denied' : 'prompt';
    } catch {
      return 'unsupported';
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
  if (!navigator.permissions?.query) return 'prompt';

  try {
    const p = await navigator.permissions.query({ name: 'geolocation' });
    return p.state;
  } catch {
    // Safari can expose geolocation while its Permissions API behaves differently.
    return 'prompt';
  }
}

function browserGpsPosition(enableHighAccuracy: boolean, timeout: number): Promise<Position> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lon: coords.longitude };
        if (!isValidPosition(position)) {
          reject(new LocationError('unavailable'));
          return;
        }
        cacheLocation(position);
        resolve(position);
      },
      error => reject(mapError(error.code)),
      {
        enableHighAccuracy,
        timeout,
        // The explicit button must request a fresh device position.
        maximumAge: 0,
      },
    );
  });
}

/**
 * Cloudflare's request geolocation is an approximate IP/Wi-Fi edge location.
 * It is only a recovery path after GPS/network positioning fails. We never
 * silently bypass an explicit browser permission denial.
 */
async function cloudflareLocation(): Promise<Position> {
  const response = await fetch('/api/location?t=' + Date.now(), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new LocationError('unavailable');

  const data = await response.json() as { latitude?: unknown; longitude?: unknown };
  const position = { lat: Number(data.latitude), lon: Number(data.longitude) };

  if (!isValidPosition(position)) throw new LocationError('unavailable');
  cacheLocation(position);
  return position;
}

async function browserLocation(forceFresh = false): Promise<Position> {
  if (!window.isSecureContext) {
    throw new LocationError('unsupported', 'Konum için HTTPS bağlantısı gerekir.');
  }
  if (!navigator.geolocation) {
    throw new LocationError('unsupported', 'Bu tarayıcı konum özelliğini desteklemiyor.');
  }

  if (!forceFresh) {
    const cached = readCachedLocation();
    if (cached) return cached;
  }

  const permission = await getLocationPermissionState();
  if (permission === 'denied') {
    throw new LocationError(
      'permission_denied',
      'Konum izni kapalı. Safari için Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri bölümünü kontrol edin.',
    );
  }

  let lastError: unknown;
  try {
    // Fast first attempt: iPhone can return Wi-Fi/cell location without waiting
    // for a full GPS fix.
    return await browserGpsPosition(false, 10000);
  } catch (error) {
    lastError = error;
  }

  if (lastError instanceof LocationError && lastError.code === 'permission_denied') {
    throw lastError;
  }

  try {
    // One short high-accuracy retry, then fall back instead of making the user
    // wait 45 seconds.
    return await browserGpsPosition(true, 12000);
  } catch (error) {
    lastError = error;
  }

  if (lastError instanceof LocationError && lastError.code === 'permission_denied') {
    throw lastError;
  }

  try {
    // This makes "Konumumu Kullan" useful even when Safari/iOS reports
    // POSITION_UNAVAILABLE or TIMEOUT despite permission being enabled.
    return await cloudflareLocation();
  } catch {
    if (lastError instanceof LocationError) throw lastError;
    throw new LocationError('unavailable');
  }
}

async function nativeLocation(): Promise<Position> {
  let permissions = await Geolocation.checkPermissions();

  if (permissions.location === 'denied') {
    throw new LocationError('permission_denied');
  }
  if (permissions.location !== 'granted') {
    permissions = await Geolocation.requestPermissions();
  }
  if (permissions.location !== 'granted') {
    throw new LocationError('permission_denied');
  }

  try {
    const result = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 0,
    });
    const position = { lat: result.coords.latitude, lon: result.coords.longitude };
    if (!isValidPosition(position)) throw new LocationError('unavailable');
    cacheLocation(position);
    return position;
  } catch (firstError) {
    if (firstError instanceof LocationError && firstError.code === 'permission_denied') throw firstError;
    try {
      const result = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      const position = { lat: result.coords.latitude, lon: result.coords.longitude };
      if (!isValidPosition(position)) throw new LocationError('unavailable');
      cacheLocation(position);
      return position;
    } catch (error) {
      if (error instanceof Error && /permission/i.test(error.message)) {
        throw new LocationError('permission_denied');
      }
      throw new LocationError('unavailable');
    }
  }
}

export async function getCurrentLocation(options: { forceFresh?: boolean } = {}): Promise<Position> {
  if (Capacitor.isNativePlatform()) {
    if (!options.forceFresh) {
      const cached = readCachedLocation();
      if (cached) return cached;
    }
    return nativeLocation();
  }
  return browserLocation(Boolean(options.forceFresh));
}

export function clearCachedLocation() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('yt-location-v4');
    localStorage.removeItem('yt-location-v3');
  } catch {}
}
