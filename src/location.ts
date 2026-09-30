import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Position } from './types';

export type LocationErrorCode = 'permission_denied' | 'timeout' | 'unavailable' | 'unsupported' | 'unknown';

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string = code) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
  }
}

function mapError(code: number): LocationError {
  if (code === 1) return new LocationError('permission_denied');
  if (code === 2) return new LocationError('unavailable');
  if (code === 3) return new LocationError('timeout');
  return new LocationError('unknown');
}

async function nativeLocation(): Promise<Position> {
  let permissions = await Geolocation.checkPermissions();
  if (permissions.location !== 'granted') {
    permissions = await Geolocation.requestPermissions();
  }
  if (permissions.location !== 'granted') throw new LocationError('permission_denied');

  // Prefer a fast network-assisted fix first. It is much more reliable indoors
  // and is already accurate enough for nearby-place searches.
  try {
    const result = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60000,
    });
    return { lat: result.coords.latitude, lon: result.coords.longitude };
  } catch {
    try {
      const result = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
      return { lat: result.coords.latitude, lon: result.coords.longitude };
    } catch (error) {
      if (error instanceof Error && /permission/i.test(error.message)) {
        throw new LocationError('permission_denied');
      }
      throw new LocationError('unavailable');
    }
  }
}

async function browserLocation(): Promise<Position> {
  if (!window.isSecureContext) {
    throw new LocationError('unsupported', 'Konum için güvenli (HTTPS) bağlantı gerekir.');
  }
  if (!('geolocation' in navigator)) throw new LocationError('unsupported');

  const read = (enableHighAccuracy: boolean, timeout: number, maximumAge: number) =>
    new Promise<Position>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
            reject(new LocationError('unavailable'));
            return;
          }
          resolve({ lat: coords.latitude, lon: coords.longitude });
        },
        (error) => reject(mapError(error.code)),
        { enableHighAccuracy, timeout, maximumAge },
      );
    });

  // iPhone/Safari often gets a cached or network-assisted position faster
  // than a cold GPS fix. Try that first, then fall back to GPS.
  try {
    return await read(false, 12000, 60000);
  } catch (firstError) {
    if (firstError instanceof LocationError && firstError.code === 'permission_denied') {
      throw firstError;
    }
    return read(true, 20000, 0);
  }
}

export async function getCurrentLocation(): Promise<Position> {
  if (Capacitor.isNativePlatform()) return nativeLocation();
  return browserLocation();
}
