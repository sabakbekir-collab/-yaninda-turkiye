const TR_MAP: Record<string, string> = {
  'ı': 'i', 'İ': 'i', 'I': 'i', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's',
  'ç': 'c', 'Ç': 'c', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u', 'â': 'a', 'Â': 'a',
  'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u',
};
export const trSlug = (value: string): string => String(value ?? '').replace(/[ıİIğĞşŞçÇöÖüÜâÂîÎûÛ]/g, ch => TR_MAP[ch] ?? ch).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function resolveName(input: string, options: readonly string[]): string | undefined {
  const key = trSlug(input); if (!key) return undefined; return options.find(option => trSlug(option) === key);
}
export const isCentralDistrict = (district?: string): boolean => trSlug(district ?? '') === 'merkez';
