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
