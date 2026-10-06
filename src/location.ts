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

const CACHE_KEY = 'yt-location-v4';
const CACHE_MAX_AGE = 10 * 60 * 1000;

function isValidPosition(position?: Position): position is Position {
  return Boolean(
    position &&
    Number.isFinite(position.lat) &&
    Number.isFinite(position.lon) &&
    Math.abs(position.lat) <= 90 &&
    Math.abs(position.lon) <= 180
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

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported';
  if (!('permissions' in navigator)) return 'prompt';

  try {
    const p = await navigator.permissions.query({ name: 'geolocation' });
    return p.state;
  } catch {
    // Safari may expose geolocation while not exposing Permissions API
    // consistently. Treat that as "prompt" and let the actual GPS request
    // decide whether permission is granted.
    return 'prompt';
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
      timeout: 15000,
      maximumAge: 0,
    });
    const position = { lat: result.coords.latitude, lon: result.coords.longitude };
    if (!isValidPosition(position)) throw new LocationError('unavailable');
    cacheLocation(position);
    return position;
  } catch (firstError) {
    if (firstError instanceof LocationError && firstError.code === 'permission_denied') {
      throw firstError;
    }

    try {
      const result = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 25000,
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

function browserGpsPosition(
  enableHighAccuracy: boolean,
  timeout: number,
): Promise<Position> {
  return new Promise<Position>((resolve, reject) => {
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
        // A "Konumumu Kullan" click must request a fresh position.
        maximumAge: 0,
      },
    );
  });
}

/**
 * Last-resort location from Cloudflare's request geolocation.
 *
 * This is deliberately NOT used when the user explicitly denied browser
 * location permission. It is only a recovery path for Safari/OS GPS failures
 * such as POSITION_UNAVAILABLE or TIMEOUT. It is approximate (IP based), but
 * prevents the whole nearby feature from becoming unusable.
 */
async function cloudflareLocation(): Promise<Position> {
  const response = await fetch('/api/location', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new LocationError('unavailable');

  const data = (await response.json()) as {
    latitude?: unknown;
    longitude?: unknown;
  };

  const position = {
    lat: Number(data.latitude),
    lon: Number(data.longitude),
  };

  if (!isValidPosition(position)) throw new LocationError('unavailable');

  cacheLocation(position);
  return position;
}

async function browserLocation(forceFresh = false): Promise<Position> {
  if (!window.isSecureContext) {
    throw new LocationError('unsupported', 'Konum için güvenli (HTTPS) bağlantı gerekir.');
  }

  if (!('geolocation' in navigator)) {
    throw new LocationError('unsupported', 'Bu tarayıcı konum özelliğini desteklemiyor.');
  }

  // Only the automatic page-start lookup may use the short-lived cache.
  // The button always forces a fresh GPS reading.
  if (!forceFresh) {
    const cached = readCachedLocation();
    if (cached) return cached;
  }

  const permission = await getLocationPermissionState();
  if (permission === 'denied') {
    throw new LocationError('permission_denied', 'Konum izni kapalı.');
  }

  try {
    // First ask for a normal GPS/network location. This is more reliable on
    // iPhone than forcing high accuracy immediately.
    return await browserGpsPosition(false, 15000);
  } catch (firstError) {
    if (firstError instanceof LocationError && firstError.code === 'permission_denied') {
      throw firstError;
    }

    try {
      // Retry once with GPS hardware enabled and a longer timeout.
      return await browserGpsPosition(true, 30000);
    } catch (secondError) {
      if (secondError instanceof LocationError && secondError.code === 'permission_denied') {
        throw secondError;
      }

      // Safari sometimes reports TIMEOUT/POSITION_UNAVAILABLE even though the
      // site has permission. Recover with Cloudflare's approximate location.
      try {
        return await cloudflareLocation();
      } catch {
        if (secondError instanceof LocationError) throw secondError;
        throw new LocationError('unavailable');
      }
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
    // Remove the previous cache version too, so an old location can never be
    // reused after this fix is deployed.
    localStorage.removeItem('yt-location-v3');
  } catch {}
}
