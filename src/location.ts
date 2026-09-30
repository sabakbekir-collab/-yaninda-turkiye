import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Position } from './types';

export type LocationErrorCode = 'permission_denied' | 'timeout' | 'unavailable' | 'unsupported' | 'unknown';

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message = code) {
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

  try {
    const result = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    return { lat: result.coords.latitude, lon: result.coords.longitude };
  } catch (error) {
    // A GPS fix can take longer indoors. Retry once with network-assisted accuracy.
    try {
      const result = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000,
      });
      return { lat: result.coords.latitude, lon: result.coords.longitude };
    } catch {
      if (error instanceof Error && /permission/i.test(error.message)) {
        throw new LocationError('permission_denied');
      }
      throw new LocationError('unavailable');
    }
  }
}

async function browserLocation(): Promise<Position> {
  if (!('geolocation' in navigator)) throw new LocationError('unsupported');

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
      (error) => reject(mapError(error.code)),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  });
}

export async function getCurrentLocation(): Promise<Position> {
  if (Capacitor.isNativePlatform()) return nativeLocation();
  return browserLocation();
}
