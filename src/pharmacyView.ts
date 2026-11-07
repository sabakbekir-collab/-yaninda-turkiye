import { nonDutySectionState } from './searchPlan';

export type PharmacyDutyStatus = 'ok' | 'stale' | 'error';
export type NearbyPharmacyStatus = 'idle' | 'loading' | 'success' | 'error';
export type PharmacyResultsInput = {
  dutyStatus: PharmacyDutyStatus;
  dutyCount: number;
  nearbyStatus: NearbyPharmacyStatus;
  nearbyCount: number;
};
export type PharmacyResultsView = {
  list: 'duty' | 'nearby' | 'none';
  note: 'unverified' | null;
  message: 'loading' | 'empty' | 'error' | null;
  showRedBanner: boolean;
};

export function pharmacyResultsView(input: PharmacyResultsInput): PharmacyResultsView {
  const dutyCount = Math.max(0, input.dutyCount);
  const nearbyCount = Math.max(0, input.nearbyCount);
  if (input.dutyStatus === 'ok' && dutyCount > 0) {
    return { list: 'duty', note: null, message: null, showRedBanner: false };
  }
  const showRedBanner = input.dutyStatus === 'error';
  if (nearbyCount > 0 && input.nearbyStatus === 'success') {
    return { list: 'nearby', note: 'unverified', message: null, showRedBanner };
  }
  const nearbyState = nonDutySectionState({ status: input.nearbyStatus, count: nearbyCount });
  if (nearbyState === 'loading') {
    return { list: 'none', note: null, message: 'loading', showRedBanner };
  }
  if (nearbyState === 'idle') {
    return { list: 'none', note: null, message: null, showRedBanner };
  }
  if (nearbyState === 'error') {
    return { list: 'none', note: null, message: 'error', showRedBanner };
  }
  return { list: 'none', note: null, message: 'empty', showRedBanner };
}
