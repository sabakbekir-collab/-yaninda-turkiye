import { Capacitor } from '@capacitor/core';

let started = false;

export async function startAds(): Promise<void> {
  if (started || Capacitor.isNativePlatform()) return;
  initWebAds();
  started = true;
}

export async function stopAds(): Promise<void> {
  started = false;
}

export function initWebAds(): void {
  if (Capacitor.isNativePlatform()) return;

  const client =
    document
      .querySelector('meta[name="google-adsense-client"]')
      ?.getAttribute('content') || '';

  if (
    !client ||
    client === 'ca-pub-REPLACE_ME' ||
    document.querySelector('script[data-yaninda-adsense]')
  ) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.yanindaAdsense = 'true';
  script.src =
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
    encodeURIComponent(client);

  document.head.appendChild(script);
}
