import{Capacitor}from'@capacitor/core';
const ANDROID_TEST_BANNER='ca-app-pub-3940256099942544/6300978111';
const IOS_TEST_BANNER='ca-app-pub-3940256099942544/2934735716';
let started=false;
export async function startAds():Promise<void>{
 if(started||!Capacitor.isNativePlatform())return;
 try{
  const{AdMob,AdmobConsentStatus,BannerAdPosition,BannerAdSize}=await import('@capacitor-community/admob');
  await AdMob.initialize();
  let consent=await AdMob.requestConsentInfo();
  if(consent.isConsentFormAvailable&&consent.status===AdmobConsentStatus.REQUIRED)consent=await AdMob.showConsentForm();
  if(!consent.canRequestAds)return;
  const adId=Capacitor.getPlatform()==='ios'?IOS_TEST_BANNER:ANDROID_TEST_BANNER;
  await AdMob.showBanner({adId,adSize:BannerAdSize.BANNER,position:BannerAdPosition.BOTTOM_CENTER,margin:78,isTesting:true});
  started=true;
 }catch(error){console.warn('AdMob başlatılamadı',error)}
}
export async function stopAds():Promise<void>{
 if(!Capacitor.isNativePlatform())return;
 try{const{AdMob}=await import('@capacitor-community/admob');await AdMob.removeBanner()}catch{}
}
export function initWebAds():void{
 if(Capacitor.isNativePlatform())return;
 const client=document.querySelector('meta[name="google-adsense-client"]')?.getAttribute('content')||'';
 if(!client||client==='ca-pub-REPLACE_ME'||document.querySelector('script[data-yaninda-adsense]'))return;
 const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.dataset.yanindaAdsense='true';
 script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(client);document.head.appendChild(script);
}
