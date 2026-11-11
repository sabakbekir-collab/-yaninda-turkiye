import {useEffect,useState} from 'react';
import {getAnalyticsConsent,setAnalyticsConsent,type AnalyticsConsent} from './api';

export default function AnalyticsConsentBanner(){
 const [choice,setChoice]=useState<AnalyticsConsent>(getAnalyticsConsent);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{setVisible(getAnalyticsConsent()===null);},[]);
 if(!visible)return null;
 const save=(value:'accepted'|'essential')=>{setAnalyticsConsent(value);setChoice(value);setVisible(false);};
 return <aside className="analytics-consent" role="dialog" aria-label="Analitik tercihleri">
  <div><strong>Gizlilik tercihiniz</strong><p>Siteyi geliştirmek için kullanım istatistikleri topluyoruz. Kabul etmezseniz yalnızca olay adı, sayfa ve tarih gibi anonim toplu sayım bilgileri tutulur. <a href="/gizlilik">Ayrıntılı bilgi</a></p></div>
  <div className="analytics-consent-actions"><button type="button" onClick={()=>save('accepted')}>Kabul</button><button type="button" onClick={()=>save('essential')}>Sadece zorunlu</button></div>
 </aside>;
}
