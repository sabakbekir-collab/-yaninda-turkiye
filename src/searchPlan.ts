export type SearchAnchor = "gps" | "area";
export type SearchPlanInput = { pos?: { lat: number; lon: number }; province?: string; district?: string; manualAreaChosen: boolean };
export function choosePlan(input: SearchPlanInput): { anchor: SearchAnchor; usePos: boolean } {
  const usePos = Boolean(input.pos && !input.manualAreaChosen);
  return { anchor: usePos ? "gps" : "area", usePos };
}
export function distanceBasisLabel(anchor: SearchAnchor, areaName: string): string {
  return anchor === "gps" ? "Konumuna göre, kuş uçuşu" : (areaName.trim() || "Seçili bölge") + " merkezine göre, kuş uçuşu";
}
export type EmptyStateInput = { status: "idle" | "loading" | "success" | "error"; forCategory: string; currentCategory: string; resultCount: number };
export function shouldShowEmpty(input: EmptyStateInput): boolean {
  return input.status === "success" && input.forCategory === input.currentCategory && input.resultCount === 0;
}

export type GpsRerunInput = { gpsArrived: boolean; lastAnchor: SearchAnchor | null | undefined; manualAreaChosen: boolean; hasSearched: boolean; alreadyRerun: boolean };
export function shouldRerunWithGps(input: GpsRerunInput): boolean { return input.gpsArrived && input.lastAnchor === 'area' && !input.manualAreaChosen && input.hasSearched && !input.alreadyRerun; }
export function resultsForCategory<T>(places: T[], resultsCategory: string | null | undefined, currentCategory: string): T[] { return resultsCategory === currentCategory ? places : []; }

export type GpsRequestInput = {
  pos?: { lat: number; lon: number };
  permission: "granted" | "denied" | "prompt" | "unsupported" | "unknown";
  userGesture: boolean;
};
export function needsGpsRequest(input: GpsRequestInput): boolean {
  return !input.pos && input.userGesture && input.permission !== "denied" && input.permission !== "unsupported";
}
export function accuracyWarning(accuracyM?: number | null): string | null {
  if (typeof accuracyM !== "number" || !Number.isFinite(accuracyM) || accuracyM <= 150) return null;
  return "Konum doğruluğu düşük (±" + Math.round(accuracyM) + " m)";
}

export type NonDutySectionStatus = "idle" | "loading" | "success" | "error";
export function nonDutySectionState(input: { status: NonDutySectionStatus; count: number }): "loading" | "empty" | "error" | "results" | "idle" {
  if (input.status === "loading") return "loading";
  if (input.status === "error") return "error";
  if (input.status === "success") return input.count > 0 ? "results" : "empty";
  return "idle";
}

export type PositionFreshnessInput = { savedAt?: number | null; now: number; maxAgeMs: number };
export function isPositionFresh(input: PositionFreshnessInput): boolean {
  if (typeof input.savedAt !== "number" || !Number.isFinite(input.savedAt)) return false;
  if (!Number.isFinite(input.now) || !Number.isFinite(input.maxAgeMs) || input.maxAgeMs < 0) return false;
  const age = input.now - input.savedAt;
  return age >= 0 && age <= input.maxAgeMs;
}

export type GpsEntryPermission = "granted" | "denied" | "prompt" | "unsupported" | "unknown";
export type GpsEntryInput = { incomingCategory?: string; permission: GpsEntryPermission; hasFreshPosition: boolean };
export function shouldRequestGpsOnEntry(input: GpsEntryInput): boolean {
  return Boolean(input.incomingCategory?.trim()) &&
    !input.hasFreshPosition &&
    input.permission !== "denied" &&
    input.permission !== "unsupported";
}

export type HomeEntryGps = "ok" | "denied" | "unsupported" | "error";
export type HomeEntryOutcomeInput = { gps: HomeEntryGps; area: "ok" | "error" };
export type HomeEntryOutcome =
  | { navigate: "withArea" }
  | { navigate: "positionOnly" }
  | { navigate: "withSavedArea"; message: string };
export function homeEntryOutcome(input: HomeEntryOutcomeInput): HomeEntryOutcome {
  if (input.gps === "ok") return { navigate: input.area === "ok" ? "withArea" : "positionOnly" };
  if (input.gps === "denied") return { navigate: "withSavedArea", message: "Konum izni verilmedi. İl ve ilçe seçerek devam edebilirsin." };
  if (input.gps === "unsupported") return { navigate: "withSavedArea", message: "Bu cihazda konum kullanılamıyor. İl ve ilçe seçerek devam edebilirsin." };
  return { navigate: "withSavedArea", message: "Güncel konum alınamadı. İl ve ilçe seçerek devam edebilirsin." };
}
export function canStartEntry(input: { locating: boolean }): boolean {
  return !input.locating;
}

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
