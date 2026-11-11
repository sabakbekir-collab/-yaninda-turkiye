const eventLabels: Record<string, string> = {
  preview: 'Önizleme gönderildi',
  error: 'İşlem hatası',
  confirmed: 'Liste yayımlandı',
  cancelled: 'İşlem iptal edildi',
  linked: 'Telegram hesabı bağlandı',
  reminder: 'Hatırlatma gönderildi',
};

export function eventLabelFor(eventType: string): string {
  return eventLabels[eventType] || 'Bilinmeyen olay';
}