export const MUS_DUTY_URL = 'https://www.batmaneczaciodasi.org.tr/nobetci-eczaneler/mus';

export type DutyLink = {
  url: string;
  title: string;
  note: string;
  empty: string | null;
  button: string;
};

function fold(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Fixed link to the official provincial chamber list. Only Muş has one for now.
 * The URL is a constant, never built from user input, and this app does not
 * fetch or parse that page.
 */
export function dutyLinkFor(province: string | null | undefined, hasCurrentRecords: boolean): DutyLink | null {
  if (!province || fold(province) !== 'mus') return null;
  return {
    url: MUS_DUTY_URL,
    title: 'Muş resmî nöbetçi eczane listesi',
    note: "Liste Batman Eczacı Odası'nın sayfasında yayımlanır. Bu uygulama o listeyi çekmez; bağlantı sizi sayfaya götürür.",
    empty: hasCurrentRecords ? null : 'Güncel liste uygulamada yok; resmî listeye bakın.',
    button: 'Resmî listeyi aç',
  };
}
