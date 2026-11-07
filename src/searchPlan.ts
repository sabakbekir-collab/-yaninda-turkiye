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
