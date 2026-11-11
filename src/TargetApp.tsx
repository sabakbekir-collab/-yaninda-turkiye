import {useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {NavLink,useLocation,useNavigate,useSearchParams,Routes,Route} from 'react-router-dom';
import {CloudSun,CalendarDays,Activity,ArrowRight,Banknote,Bell,Building2,Bus,ChevronRight,Compass,Fuel,Heart,Hospital,Landmark,List,LocateFixed,LockKeyhole,Map as MapIcon,MapPin,Menu,Navigation,Phone,Search,ShieldCheck,Siren,Store,Pill,UserCircle,Wrench,ExternalLink,Info,Paintbrush,Zap,KeyRound,Truck,Snowflake,Car,Smartphone,Laptop,Armchair,TreePine,ShoppingBasket,Utensils,Hotel,Package} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {MapContainer,Marker,Popup,TileLayer} from 'react-leaflet';
import L from 'leaflet';
import {categories,keywordMap,provinces,services} from './data';
import {districtsFor} from './turkeyDistricts';
import {resolveName,trSlug} from './text';
import {findPlaces,resolveLocationArea,track} from './api';
import {getCurrentLocation,getLocationPermissionState,LocationError} from './location';
import type {Place,Position} from './types';
import ChatWidget from './ChatWidget';
import AnalyticsConsentBanner from './AnalyticsConsent';
import AdminAI from './AdminAI';
import FavoritesPage from './FavoritesPage';
import CalendarPage from './CalendarPage';
import EnhancedPlaceCard from './PlaceCard';
import {getTheme,applyTheme,saveTheme} from './theme';
import {shareText,mapsLink} from './share';
import {provinceCenter} from '../functions/lib/provinceCenters';
import { dutyLinkFor, officialLinkFor } from './dutyLink';
import { shouldShowEmpty } from './searchErrors';
import { dutyViewState, formatDutySourceDate, shouldShowDutyCount } from './dutyView';
import { choosePlan, distanceBasisLabel, shouldRerunWithGps, resultsForCategory, needsGpsRequest, accuracyWarning, isPositionFresh, shouldRequestGpsOnEntry, homeEntryOutcome, canStartEntry, pharmacyResultsView } from './searchPlan';

const marker=L.divIcon({className:'yt-marker',html:'<span></span>',iconSize:[30,38],iconAnchor:[15,38]});

function normalizeSearchText(value:string){
  return value.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ç/g,'c').replace(/ö/g,'o').replace(/ü/g,'u').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function resolveSearchCategory(query:string):string|undefined{
  const q=normalizeSearchText(query);
  if(!q)return undefined;
  const keywords=Object.entries(keywordMap).map(([key,value])=>({key:normalizeSearchText(key),value})).sort((a,b)=>b.key.length-a.key.length);
  const keyword=keywords.find(x=>q.includes(x.key));
  if(keyword)return keyword.value;
  const dataCategories=categories.map(c=>({key:normalizeSearchText(c.label.replace(/^En Yakın /,'').replace(/'ler$/,'')),value:c.id})).sort((a,b)=>b.key.length-a.key.length);
  const category=dataCategories.find(x=>q.includes(x.key));
  if(category)return category.value;
  const service=services.map(([id,label])=>({key:normalizeSearchText(label),value:id})).sort((a,b)=>b.key.length-a.key.length).find(x=>q.includes(x.key));
  return service?.value;
}
function readHeaderLocation(){
  try{
    const raw=localStorage.getItem('yt-nearby-selection-v5');
    if(!raw)return 'Konum seç';
    const value=JSON.parse(raw) as {province?:string;district?:string};
    if(value.district&&value.province)return value.province+', '+value.district;
    if(value.province)return value.province;
  }catch{}
  return 'Konum seç';
}
const imgs={
hero:'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1500&q=85',
pharmacy:'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=700&q=80',
hospital:'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=700&q=80',
fuel:'https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&w=700&q=80',
market:'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=700&q=80',
bakery:'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80',
transport:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=700&q=80',
burger:'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=1500&q=80',
trend:'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1500&q=80'
};


function Header(){
 const nav=useNavigate(); const location=useLocation(); const[q,setQ]=useState(''); const[selection,setSelection]=useState(readHeaderLocation()); const[theme,setTheme]=useState(getTheme);
 useEffect(()=>{applyTheme(theme)},[theme]);
 useEffect(()=>{const refresh=()=>setSelection(readHeaderLocation()); window.addEventListener('storage',refresh); window.addEventListener('yt-nearby-memory',refresh); refresh(); return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('yt-nearby-memory',refresh)}},[]);
 const nearbyActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')!=='map';
 const mapActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')==='map';
 const submitSearch=(e:FormEvent)=>{e.preventDefault();const query=q.trim();if(query)nav('/nearby',{state:{query}})};
 return <header className="yt-header"><div className="yt-head"><NavLink to="/" className="yt-logo"><span><MapPin fill="currentColor"/></span><b>YANINDA <i>TÜRKİYE</i></b></NavLink><form className="yt-search" onSubmit={submitSearch}><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ne arıyorsunuz? (Eczane, ATM, Hastane...)"/><span><MapPin/> {selection}</span><button type="submit">Ara</button></form><div className="yt-actions"><button type="button" aria-label="Tema" onClick={()=>{const next=theme==="dark"?"light":"dark";setTheme(next);saveTheme(next)}}><span aria-hidden="true">{theme==="dark"?"☀":"🌙"}</span></button><NavLink to="/admin">Giriş Yap</NavLink><button type="button" onClick={()=>nav('/menu')} aria-label="Menüyü aç"><Menu/></button></div></div><nav className="yt-nav"><NavLink to="/">⌂ Ana Sayfa</NavLink><NavLink className={nearbyActive?'active':''} to="/nearby"><Compass/>Yakınımda</NavLink><NavLink className={mapActive?'active':''} to="/nearby?view=map"><MapIcon/>Harita</NavLink><NavLink className="danger" to="/emergency"><Siren/>Acil</NavLink><NavLink to="/favorites"><Heart/>Favoriler</NavLink><NavLink to="/calendar"><CalendarDays/>Takvim</NavLink><NavLink to="/news"><Landmark/>Haberler</NavLink><NavLink to="/contact"><Phone/>İletişim</NavLink></nav></header>
}

function MobileNav(){
 const location=useLocation();
 const nearbyActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')!=='map';
 const mapActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')==='map';
 return <nav className="mobile-nav"><NavLink to="/"><Activity/><small>Ana Sayfa</small></NavLink><NavLink className={nearbyActive||mapActive?'active':''} to="/nearby"><Compass/><small>Keşfet</small></NavLink><NavLink to="/favorites"><Heart/><small>Favoriler</small></NavLink><NavLink to="/calendar"><CalendarDays/><small>Takvim</small></NavLink><NavLink to="/menu"><UserCircle/><small>Hesabım</small></NavLink></nav>
}

type AdRow={id:number;title:string;text?:string|null;image_url?:string|null;target_url?:string|null};
const adPlacement={top:'home_top',mid:'home_mid',bottom:'home_bottom'} as const;
const httpUrl=(v?:string|null)=>{try{const u=new URL(v||'');return u.protocol==='https:'||u.protocol==='http:'?u.toString():''}catch{return ''}};
// Only real, admin-approved ads from /api/ads are shown. No placeholder brands: nothing renders when there is no ad.
function Ad({kind}:{kind:'top'|'mid'|'bottom'}){
 const[ad,setAd]=useState<AdRow|null>(null);
 useEffect(()=>{let live=true;fetch('/api/ads?placement='+adPlacement[kind]).then(r=>r.ok?r.json():null).then((d:{ads?:AdRow[]}|null)=>{if(live&&d&&Array.isArray(d.ads)&&d.ads[0]&&typeof d.ads[0].title==='string')setAd(d.ads[0])}).catch(()=>undefined);return()=>{live=false}},[kind]);
 if(!ad)return null;
 const href=httpUrl(ad.target_url),img=httpUrl(ad.image_url);
 const body=<>{img&&<img src={img} alt="" loading="lazy"/>}<div><small>REKLAM</small><strong>{ad.title}</strong>{ad.text&&<b>{ad.text}</b>}</div></>;
 return href?<a href={href} target="_blank" rel="sponsored noopener noreferrer" className="yt-ad red">{body}</a>:<div className="yt-ad red">{body}</div>
}

const quick:[string,string,LucideIcon,string][]=[
['pharmacy','Eczaneler',Pill,'red'],['hospital','Hastane',Hospital,'blue'],['emergency','Acil Servis',Siren,'red'],['atm',"ATM'ler",Banknote,'purple'],['fuel','Akaryakıt',Fuel,'green'],['market','Market',Store,'orange'],['bakery','Fırın',ShoppingBasket,'amber'],['transport','Ulaşım',Bus,'blue'],['police','Polis',ShieldCheck,'navy'],['fire_station','İtfaiye',Siren,'red']
];

type HomeWeather={temperature:number;apparent:number;precipitation:number;wind:number;code:number;days:Array<{date:string;code:number;max:number;min:number}>};
function weatherLabel(code:number){
 if(code===0)return 'Açık';if([1,2].includes(code))return 'Az bulutlu';if(code===3)return 'Bulutlu';
 if([45,48].includes(code))return 'Sisli';if([51,53,55,56,57].includes(code))return 'Çisenti';
 if([61,63,65,66,67,80,81,82].includes(code))return 'Yağmurlu';if([71,73,75,77,85,86].includes(code))return 'Karlı';
 if([95,96,99].includes(code))return 'Gök gürültülü';return 'Hava durumu';
}
function Home(){
 const nav=useNavigate();
 const[locating,setLocating]=useState(false); const entryInFlight=useRef(false); const[q,setQ]=useState(''); const[locationLabel,setLocationLabel]=useState(readHeaderLocation());
 const[weather,setWeather]=useState<HomeWeather|null>(null);
 const[weatherError,setWeatherError]=useState('');
 const[weatherLoading,setWeatherLoading]=useState(false);
 const[exchange,setExchange]=useState<{usd:number;eur:number;gbp:number;date:string}|null>(null);
 const[exchangeError,setExchangeError]=useState('');
 const[exchangeLoading,setExchangeLoading]=useState(false);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setExchangeLoading(true);
   try{
    const response=await fetch('https://open.er-api.com/v6/latest/USD',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('exchange_unavailable');
    const data=await response.json() as {result?:string;time_last_update_utc?:string;rates?:Record<string,number>};
    const rates=data.rates;
    if(data.result!=='success'||!rates||!Number.isFinite(rates.TRY)||!Number.isFinite(rates.EUR)||!Number.isFinite(rates.GBP))throw new Error('exchange_bad_response');
    if(active){setExchange({usd:rates.TRY,eur:rates.TRY/rates.EUR,gbp:rates.TRY/rates.GBP,date:data.time_last_update_utc||''});setExchangeError('');}
   }catch{if(active)setExchangeError('Döviz verisi şu anda alınamıyor.');}
   finally{if(active)setExchangeLoading(false);}
  };
  void load();return()=>{active=false};
 },[]);
 useEffect(()=>{
   // GPS permission is optional. The app uses the user's saved/manual province
   // and district for weather and nearby searches without prompting on entry.
   const refresh=()=>{
     const saved=readNearbyMemory();
     const label=saved.province
       ? saved.province+(saved.district?', '+saved.district:'')
       : 'Bölge seçilmedi';
     setLocationLabel(label);
   };
   refresh();
   window.addEventListener('yt-nearby-memory',refresh);
   return()=>window.removeEventListener('yt-nearby-memory',refresh);
 },[]);
 useEffect(()=>{
   let active=true;
   const province=readNearbyMemory().province||'';
   const center=provinceCenter(province);
   if(!center){
     setWeather(null);
     setWeatherError('Hava durumu için önce il seç.');
     setWeatherLoading(false);
     return;
   }
   const load=async()=>{
     setWeatherLoading(true);
     setWeatherError('');
     try{
       const query=new URLSearchParams({
         latitude:String(center.lat),
         longitude:String(center.lon),
         current:'temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code',
         daily:'weather_code,temperature_2m_max,temperature_2m_min',
         forecast_days:'5',
         timezone:'Europe/Istanbul'
       });
       const response=await fetch('https://api.open-meteo.com/v1/forecast?'+query.toString(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
       if(!response.ok)throw new Error('weather_unavailable');
       const data=await response.json() as {
         current?:{temperature_2m?:number;apparent_temperature?:number;precipitation?:number;wind_speed_10m?:number;weather_code?:number};
         daily?:{time?:string[];weather_code?:number[];temperature_2m_max?:number[];temperature_2m_min?:number[]}
       };
       const current=data.current,daily=data.daily;
       if(!current||!daily||!Array.isArray(daily.time)||!Array.isArray(daily.weather_code)||!Array.isArray(daily.temperature_2m_max)||!Array.isArray(daily.temperature_2m_min))throw new Error('weather_bad_response');
       if(active)setWeather({
         temperature:Number(current.temperature_2m),apparent:Number(current.apparent_temperature),
         precipitation:Number(current.precipitation),wind:Number(current.wind_speed_10m),code:Number(current.weather_code),
         days:daily.time.map((date,i)=>({date,code:Number(daily.weather_code?.[i]),max:Number(daily.temperature_2m_max?.[i]),min:Number(daily.temperature_2m_min?.[i])}))
       });
     }catch{
       if(active){setWeather(null);setWeatherError('Seçilen il için hava durumu şu anda alınamıyor.');}
     }finally{if(active)setWeatherLoading(false);}
   };
   void load();
   return()=>{active=false};
 },[locationLabel]);
 const go=async(id:string)=>{
  if(id==='emergency'){nav('/emergency');return;}
  if(!canStartEntry({locating:entryInFlight.current}))return;
  const saved=readNearbyMemory();
  const hasFreshPosition=isPositionFresh({savedAt:saved.positionSavedAt,now:Date.now(),maxAgeMs:5*60*1000});
  if(!shouldRequestGpsOnEntry({incomingCategory:id,permission:'unknown',hasFreshPosition})){
    nav('/nearby',{state:{category:id,...(saved.position?{position:saved.position,province:saved.province,district:saved.district}:{})}});
    return;
  }
  entryInFlight.current=true;
  setLocating(true);
  try{
    const position=await getCurrentLocation({forceFresh:true});
    try{
      const area=await resolveLocationArea(position);
      writeNearbyMemory({...saved,position,positionSavedAt:Date.now(),province:area.province,district:area.district});
      nav('/nearby',{state:{category:id,position,province:area.province,district:area.district}});
    }catch{
      writeNearbyMemory({...saved,position,positionSavedAt:Date.now()});
      nav('/nearby',{state:{category:id,position}});
    }
  }catch(error){
    const gps=error instanceof LocationError&&error.code==='permission_denied'?'denied'
      :error instanceof LocationError&&error.code==='unsupported'?'unsupported':'error';
    const outcome=homeEntryOutcome({gps,area:'error'});
    nav('/nearby',{state:{category:id,...(saved.province?{province:saved.province,district:saved.district}:{}),locationError:outcome.navigate==='withSavedArea'?outcome.message:undefined}});
  }finally{
    entryInFlight.current=false;
    setLocating(false);
  }
};

 const search=(e?:FormEvent)=>{e?.preventDefault();const query=q.trim();if(query){track('search',{source:'home'});const saved=readNearbyMemory();nav('/nearby',{state:{query,category:resolveSearchCategory(query),...(saved.position?{position:saved.position,province:saved.province,district:saved.district}:{})}})}};
 const cards=[
  ['pharmacy','Nöbetçi Eczaneler','Yakınınızdaki nöbetçi eczaneleri görüntüleyin','red',Pill,imgs.pharmacy],
  ['hospital','Hastaneler','En yakın hastaneler, poliklinikler ve aciller','blue',Hospital,imgs.hospital],
  ['atm','ATM','En yakın ATM’leri bul','navy',Banknote,undefined],
  ['fuel','Akaryakıt','En yakın istasyonlar','red',Fuel,imgs.fuel],
  ['transport','Ulaşım','Otobüs, metro, durak ve hat bilgileri','navy',Bus,imgs.transport],
  ['market','Marketler','Yakındaki market ve süpermarketler','red',Store,imgs.market],
  ['restaurant','Restoranlar','Lezzet duraklarını keşfedin','orange',Utensils,undefined],
  ['service','Usta Hizmetleri','Güvenilir ustalar yanınızda','red',Wrench,undefined]
 ] as const;
 return <main className="yt-home yt-modern-home">
   <section className="modern-home-head">
    <div className="modern-brand-block"><div className="modern-brand-mark"><MapPin fill="currentColor"/></div><div><strong>YANINDA <i>TÜRKİYE</i></strong><small>Türkiye'nin Günlük Yaşam Asistanı</small></div></div>
    <button className="modern-location-chip" onClick={()=>nav('/nearby')}><MapPin/><span>{readHeaderLocation()}</span><ChevronRight/></button>
    <button className="modern-notify" aria-label="Menü" onClick={()=>nav('/menu')}><Menu/></button>
   </section>
   <section className="modern-welcome-banner"><div><span>YANINDA TÜRKİYE</span><h1>Hayatın her anında<br/>yanında.</h1><p>İhtiyacın olan her şey tek yerde.</p></div><MapPin/></section>
   <form className="modern-search" onSubmit={search}><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Eczane, hastane, restoran, usta..."/><button type="button" aria-label="Sesli arama">●</button></form>
   <div className="modern-location-status"><MapPin/><span><b>Seçili bölgen</b><small>{locationLabel} · Konum izni gerekmez</small></span><span className="location-live-dot"/></div>

   <section className="modern-section">
    <div className="modern-section-title"><h2>Hızlı işlemler</h2><button onClick={()=>nav('/services')}>Tümünü Gör <ChevronRight/></button></div>
    <div className="modern-quick">
      <button onClick={()=>nav('/emergency')}><Siren/><b>Acil</b></button>
      <button onClick={()=>nav('/nearby',{state:{query:"Beyoğlu'na nasıl gidilir?"}})}><Navigation/><b>Yol Tarifi</b></button>
      <button onClick={()=>nav('/favorites')}><Heart/><b>Favorilerim</b></button>
      <button onClick={()=>{if(navigator.share)navigator.share({title:'Yanımda Türkiye',text:'Yanımda Türkiye'});else void navigator.clipboard?.writeText(location.href)}}><ExternalLink/><b>Paylaş</b></button>
    </div>
   </section>
   <section className="modern-service-list" aria-busy={locating}>{locating&&<div className="home-locating-status" role="status" aria-live="polite">Konumun alınıyor…</div>}
    {cards.map(([id,title,text,tone,Icon,img])=><button key={id} type="button" disabled={locating} aria-disabled={locating} className={"modern-service-card "+tone} onClick={()=>go(id)}>
      <span className="modern-service-icon"><Icon/></span><div><strong>{title}</strong><small>{text}</small></div>{img&&<img src={img} alt=""/>}<span className="modern-card-arrow"><ChevronRight/></span>
    </button>)}
   </section>
   <section className="home-weather-card" aria-label="Konuma göre hava durumu">
    <div className="home-weather-top"><div><small>BUGÜN · {locationLabel}</small><h2><CloudSun/> Hava Durumu</h2></div><span>{weather?weatherLabel(weather.code):weatherLoading?'Yükleniyor…':'Güncel tahmin'}</span></div>
    {weather?<><div className="home-weather-current"><strong>{Math.round(weather.temperature)}°</strong><div><b>{weatherLabel(weather.code)}</b><small>Hissedilen {Math.round(weather.apparent)}°</small></div></div><div className="home-weather-metrics"><span>Yağış <b>{weather.precipitation.toLocaleString('tr-TR')} mm</b></span><span>Rüzgâr <b>{Math.round(weather.wind)} km/sa</b></span></div><div className="home-weather-days">{weather.days.map((day,i)=><div key={day.date}><small>{i===0?'Bugün':new Date(day.date+'T12:00:00').toLocaleDateString('tr-TR',{weekday:'short'})}</small><b>{weatherLabel(day.code)}</b><span>{Math.round(day.max)}° / {Math.round(day.min)}°</span></div>)}</div></>:<p className="home-weather-error">{weatherError||'İl seçildiğinde o ilin merkezine göre tahmin gösterilir.'}</p>}</section>
   <section className="home-exchange-card" aria-label="Döviz kurları">
    <div className="home-exchange-heading"><div><small>PİYASA BİLGİSİ</small><h2><Activity/> Döviz Kurları</h2></div><span>{exchangeLoading?'Güncelleniyor…':exchange?'Günlük veri':'Veri bekleniyor'}</span></div>
    {exchange?<><div className="home-exchange-grid">
      <div><small>🇺🇸 USD / TRY</small><strong>{exchange.usd.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:4})} ₺</strong></div>
      <div><small>🇪🇺 EUR / TRY</small><strong>{exchange.eur.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:4})} ₺</strong></div>
      <div><small>🇬🇧 GBP / TRY</small><strong>{exchange.gbp.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:4})} ₺</strong></div>
     </div><p className="home-exchange-note">Son güncelleme: {exchange.date?new Date(exchange.date).toLocaleString('tr-TR'):'—'} · Günlük referans kurudur; banka alış-satış fiyatı değildir.</p></>:<p className="home-exchange-note">{exchangeError||'Döviz kurları yükleniyor.'}</p>}
   </section>
   <Ad kind="mid"/><button className="modern-campaign-link" onClick={()=>nav('/ads')}><span><Store/></span><div><b>Reklam & Kampanyalar</b><small>Fırsatları keşfet, işletmeni tanıt</small></div><ChevronRight/></button>
   <button className="modern-map-promo" onClick={()=>nav('/nearby?view=map')}>
     <span className="modern-map-art"><MapIcon/><MapPin/></span><div><em>DAHA FAZLASI</em><strong>Yakınındaki tüm hizmetleri haritada gör</strong></div><ChevronRight/>
   </button>
 </main>
}
type NearbyMemory={category?:string;province?:string;district?:string;radius?:number;nearbyDistricts?:boolean;position?:Position;positionSavedAt?:number};
function cleanNearbyMemory(value:NearbyMemory):NearbyMemory{
  const province=typeof value.province==='string'?value.province:'';
  const rawDistrict=typeof value.district==='string'?value.district:'';
  const district=rawDistrict?(resolveName(rawDistrict,districtsFor(province))||''):'';
  return {...value,province,district};
}
function readNearbyMemory():NearbyMemory{
  try{const raw=localStorage.getItem('yt-nearby-selection-v5');if(!raw)return {};const value=JSON.parse(raw) as NearbyMemory;return value&&typeof value==='object'?cleanNearbyMemory(value):{};}catch{return {}}
}
function writeNearbyMemory(value:NearbyMemory){
  try{
    localStorage.setItem('yt-nearby-selection-v5',JSON.stringify(cleanNearbyMemory(value)));
    window.dispatchEvent(new Event('yt-nearby-memory'));
  }catch{}
}
function formatDistance(km?:number){
  if(typeof km!=='number'||!Number.isFinite(km))return 'Mesafe bilinmiyor';
  if(km<1)return Math.round(km*1000)+' m';
  return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(km)+' km';
}
function cleanCardAddress(address?:string){
  if(!address)return 'Adres bilgisi bulunmuyor';
  return address.split(',').map(x=>x.trim()).filter(Boolean).filter(x=>!/^(marmara bölgesi|türkiye)$/i.test(x)).slice(0,4).join(', ');
}
function categoryIcon(id:string){
  const map:Record<string,LucideIcon>={
    pharmacy:Pill,hospital:Hospital,atm:Banknote,fuel:Fuel,market:ShoppingBasket,restaurant:Utensils,taxi:Bus,
    hotel:Hotel,cargo:Package,police:ShieldCheck,fire_station:Siren,electrician:Zap,plumber:Wrench,locksmith:KeyRound,
    cleaning:Store,moving:Truck,hvac:Snowflake,painter:Paintbrush,car_repair:Car,tyres:Store,phone_repair:Smartphone,
    computer_repair:Laptop,furniture:Armchair,gardener:TreePine
  };
  return map[id]||Wrench;
}
type NearbyNavigationState={category?:string;province?:string;district?:string;query?:string;autoLocate?:boolean;position?:Position;locationError?:string};

function Nearby(){
 const location=useLocation();
 const nav=useNavigate();
 const[params,setParams]=useSearchParams();
 const memory=readNearbyMemory();
 const state=location.state as NearbyNavigationState|null;

 const initialProvince=params.get('province')||state?.province||memory.province||'';
 const initialDistrict=params.get('district')||state?.district||memory.district||'';
 const[cat,setCat]=useState(params.get('category')||state?.category||memory.category||'pharmacy');
 const[province,setProvince]=useState(initialProvince);
 const[district,setDistrict]=useState(()=>resolveName(initialDistrict,districtsFor(resolveName(initialProvince,provinces)||initialProvince))||'');
 const[provinceOpen,setProvinceOpen]=useState(false);
 const locateRef=useRef<()=>void>(()=>{});
 const[districtOpen,setDistrictOpen]=useState(false);
 const[radius,setRadius]=useState(Number(params.get('radius')||memory.radius||5));
 const[nearbyDistricts,setNearbyDistricts]=useState(params.get('nearbyDistricts')==='1'||Boolean(memory.nearbyDistricts));
 const[places,setPlaces]=useState<Place[]>([]);
 const[nearbyPharmacies,setNearbyPharmacies]=useState<Place[]>([]);
 const[nearbyStatus,setNearbyStatus]=useState<'idle'|'loading'|'success'|'error'>('idle');
 const[dutyFeedDate,setDutyFeedDate]=useState<string|null>(null);
 const[dutyError,setDutyError]=useState(false);
 const[loading,setLoading]=useState(false);
 const[view,setView]=useState<'list'|'map'>(params.get('view')==='map'?'map':'list');
 const[err,setErr]=useState('');
 const[hasSearched,setHasSearched]=useState(false);
 const[pos,setPos]=useState<Position|undefined>();
 const[locationState,setLocationState]=useState<'unknown'|'granted'|'denied'|'prompt'|'unsupported'>('unknown');
 const[locationNotice,setLocationNotice]=useState('');
 const manualAreaChosenRef=useRef(false);
 const[submitted,setSubmitted]=useState<{category:string;province:string;district:string;radius:number;nearbyDistricts:boolean;pos?:Position;anchor:'gps'|'area';forceRefresh?:boolean}|null>(null);
 const submittedRef=useRef<typeof submitted>(null);
 const hasSearchedRef=useRef(false);
 const gpsRerunDoneRef=useRef(false);
 const currentCategoryRef=useRef(cat);
 const currentRadiusRef=useRef(radius);
 const currentNearbyDistrictsRef=useRef(nearbyDistricts);
 submittedRef.current=submitted;
 hasSearchedRef.current=hasSearched;
 currentCategoryRef.current=cat;
 currentRadiusRef.current=radius;
 currentNearbyDistrictsRef.current=nearbyDistricts;

 const canonProvince=useMemo(()=>resolveName(province,provinces)??province,[province]);
 const ds=useMemo(()=>districtsFor(canonProvince),[canonProvince]);
 const provinceOptions=useMemo(()=>{const q=normalizeSearchText(province);return provinces.filter(p=>!q||normalizeSearchText(p).includes(q)).slice(0,8)},[province]);
 const districtOptions=useMemo(()=>{const q=normalizeSearchText(district);return ds.filter(d=>!q||normalizeSearchText(d).includes(q)).slice(0,8)},[district,ds]);
 const canonDistrict=useMemo(()=>district?(resolveName(district,ds)??district):'', [district,ds]);
 const validProvince=useMemo(()=>provinces.includes(canonProvince),[canonProvince]);
 const validDistrict=useMemo(()=>!district||ds.includes(canonDistrict),[district,ds,canonDistrict]);
 const pharmacyMode=cat==='pharmacy';
 const effectiveRadius=district&&nearbyDistricts?Math.min(30,Math.max(radius,radius*1.5)):radius;

 useEffect(()=>{
   writeNearbyMemory({category:cat,province,district,radius,nearbyDistricts,position:pos||memory.position,positionSavedAt:memory.positionSavedAt});
   setParams(prev=>{
     const next=new URLSearchParams(prev);
     next.set('category',cat);
     if(province)next.set('province',province);else next.delete('province');
     if(district)next.set('district',district);else next.delete('district');
     next.set('radius',String(radius));
     if(nearbyDistricts)next.set('nearbyDistricts','1');else next.delete('nearbyDistricts');
     next.set('view',view);
     return next;
   },{replace:true});
 },[cat,province,district,radius,nearbyDistricts,view,setParams]);

 // Restore the saved area without marking it as a fresh manual change.
 useEffect(()=>{
   if(!province&&memory.province)setProvince(memory.province);
   if(!district&&memory.district)setDistrict(memory.district);
 },[]);
 // Never open the iOS permission prompt on entry. Read GPS only when permission
 // is already granted; failures silently preserve the selected-area fallback.
 useEffect(()=>{
   let active=true;
   void getLocationPermissionState().then(permission=>{
     if(!active)return;
     setLocationState(permission);
     if(permission!=='granted')return;
     void getCurrentLocation().then(async current=>{
       const area=await resolveLocationArea(current);
       if(!active||manualAreaChosenRef.current)return;
       setPos(current);
       setProvince(area.province);
       setDistrict(area.district);
       if(shouldRerunWithGps({gpsArrived:true,lastAnchor:submittedRef.current?.anchor,manualAreaChosen:manualAreaChosenRef.current,hasSearched:hasSearchedRef.current,alreadyRerun:gpsRerunDoneRef.current})){
         gpsRerunDoneRef.current=true;
         setSubmitted({category:currentCategoryRef.current,province:area.province,district:area.district,radius:currentRadiusRef.current,nearbyDistricts:currentNearbyDistrictsRef.current,pos:current,anchor:'gps'});
       }
     }).catch(()=>undefined);
   }).catch(()=>undefined);
   return()=>{active=false};
 },[]);
 useEffect(()=>{
   const incoming=location.state as NearbyNavigationState|null;
   if(!incoming)return;
   if(incoming.autoLocate){
     // Navigation state must never trigger an iOS permission prompt.
     // Only silently locate when permission is already granted.
     void getLocationPermissionState().then(permission=>{
       setLocationState(permission);
       if(permission==='granted')locateRef.current();
       else if(permission==='denied')setErr('Konum izni kapalı. İl ve ilçe seçerek devam edebilirsin.');
     });
   }
   if(incoming.position){
     setPos(incoming.position);
     setLocationState('granted');
     setHasSearched(true);
     // Home-screen GPS navigation includes the reverse-geocoded area. If an
     // older caller only supplies coordinates, resolve the area here as well.
     if(incoming.province){
       setProvince(incoming.province);
       const validIncomingDistrict=resolveName(incoming.district||'',districtsFor(resolveName(incoming.province,provinces)||incoming.province))||'';
       setDistrict(validIncomingDistrict);
       setSubmitted({category:incoming.category||cat,province:incoming.province,district:validIncomingDistrict,radius,nearbyDistricts,pos:incoming.position,anchor:'gps'});
     }else{
       void resolveLocationArea(incoming.position).then(area=>{
         setProvince(area.province);
         setDistrict(area.district);
         setSubmitted({category:incoming.category||cat,province:area.province,district:area.district,radius,nearbyDistricts,pos:incoming.position,anchor:'gps'});
       }).catch(()=>{
         setSubmitted({category:incoming.category||cat,province:'',district:'',radius,nearbyDistricts,pos:incoming.position,anchor:'gps'});
       });
     }
   }
   if(incoming.locationError)setErr(incoming.locationError);
   if(incoming.province!==undefined)setProvince(incoming.province);
   if(incoming.district!==undefined)setDistrict(resolveName(incoming.district,districtsFor(resolveName(incoming.province||province,provinces)||incoming.province||province))||'');
   if(incoming.category!==undefined)setCat(incoming.category);
   if(incoming.query!==undefined){
     const query=incoming.query.trim();
     const resolved=incoming.category||resolveSearchCategory(query);
     if(!resolved){
       setHasSearched(true);
       setSubmitted(null);
       setPlaces([]);
       setErr(query?'Aranan kelime için eşleşen bir kategori bulunamadı. Sonuç bulunamadı, kategori seç.':'Aramak için bir kelime yaz.');
       return;
     }
     setCat(resolved);
     setHasSearched(true);
     if(province){
       setSubmitted({category:resolved,province,district,radius,nearbyDistricts,anchor:'area'});
     }else{
       setErr('Kategori bulundu. Arama yapmak için il ve ilçe seç.');
     }
   }
 },[location.key]); // eslint-disable-line react-hooks/exhaustive-deps

 useEffect(()=>{
   if(!submitted)return;
   let cancelled=false;
   setLoading(true);setErr('');
   if(submitted.category==='pharmacy'){setDutyFeedDate(null);setDutyError(false);}
   findPlaces(submitted.category,submitted.pos,submitted.province,submitted.district,{radiusKm:submitted.radius,nearbyDistricts:submitted.nearbyDistricts,anchor:submitted.anchor,forceRefresh:submitted.forceRefresh,onFeedDate:submitted.category==='pharmacy'?(date)=>{if(!cancelled)setDutyFeedDate(date)}:undefined})
     .then(r=>{if(!cancelled){setPlaces(r);if(submitted.category==='pharmacy')setDutyError(false)}})
     .catch((error:unknown)=>{if(!cancelled){const message=error instanceof Error&&error.message.trim()?error.message:'Nöbetçi eczane kaynağına ulaşılamadı.';setPlaces([]);setErr(message);if(submitted.category==='pharmacy')setDutyError(true)}})
     .finally(()=>{if(!cancelled)setLoading(false)});
   return()=>{cancelled=true};
 },[submitted]);

 useEffect(()=>{
   if(!submitted||submitted.category!=='pharmacy')return;
   let cancelled=false;
   setNearbyPharmacies([]);setNearbyStatus('loading');
   findPlaces('pharmacy',submitted.pos,submitted.province,submitted.district,{
     radiusKm:submitted.radius,nearbyDistricts:submitted.nearbyDistricts,
     anchor:submitted.anchor,forceRefresh:submitted.forceRefresh,
     includeNonDutyPharmacies:true
   }).then(rows=>{
     if(!cancelled){setNearbyPharmacies(rows.map(p=>({...p,isDuty:undefined})));setNearbyStatus('success')}
   }).catch(()=>{
     if(!cancelled){setNearbyPharmacies([]);setNearbyStatus('error')}
   });
   return()=>{cancelled=true;};
 },[submitted]);

 const search=async(forceRefresh=false,categoryOverride=cat)=>{
   setErr('');setLocationNotice('');setPlaces([]);setLoading(true);
   track('search',{category:categoryOverride,province:canonProvince,district:canonDistrict});
   let searchPosition=pos;
   let searchProvince=canonProvince;
   let searchDistrict=canonDistrict;
   if(needsGpsRequest({pos:searchPosition,permission:locationState,userGesture:true})){
     try{
       // This call is deliberately the first asynchronous operation after the tap:
       // iOS Safari and embedded browsers may require transient user activation.
       const fresh=await getCurrentLocation({forceFresh:true});
       searchPosition=fresh;
       setPos(fresh);
       setLocationState('granted');
       manualAreaChosenRef.current=false;
       try{
         const area=await resolveLocationArea(fresh);
         searchProvince=area.province;searchDistrict=area.district;
         setProvince(area.province);setDistrict(area.district);
       }catch{/* GPS coordinates remain authoritative even if reverse geocoding fails. */}
     }catch(error){
       const denied=error instanceof LocationError&&error.code==='permission_denied';
       const unsupported=error instanceof LocationError&&error.code==='unsupported';
       if(denied)setLocationState('denied');
       else if(unsupported)setLocationState('unsupported');
       else setLocationState('prompt');
       const fallbackArea=searchDistrict||searchProvince||'seçili bölge';
       setLocationNotice('Konum alınamadı; mesafeler '+fallbackArea+' merkezine göre. Siteyi Safari\'de açmayı dene.');
     }
   }else if(!searchPosition&&(locationState==='denied'||locationState==='unsupported')){
     const fallbackArea=searchDistrict||searchProvince||'seçili bölge';
     setLocationNotice('Konum alınamadı; mesafeler '+fallbackArea+' merkezine göre. Siteyi Safari\'de açmayı dene.');
   }
   if(!searchProvince.trim()&&!searchPosition){setLoading(false);setErr('Arama için konumunu kullan veya il seç.');return;}
   if(searchProvince.trim()&&!provinces.includes(resolveName(searchProvince,provinces)||searchProvince)){setLoading(false);setErr('İl adını listeden seç.');return;}
   const searchDistricts=districtsFor(searchProvince);
   if(searchDistrict.trim()&&!searchDistricts.includes(resolveName(searchDistrict,searchDistricts)||searchDistrict)){setLoading(false);setErr('İlçeyi listeden seç veya “Tüm ilçeler” olarak bırak.');return;}
   const plan=choosePlan({pos:searchPosition,province:searchProvince,district:searchDistrict,manualAreaChosen:manualAreaChosenRef.current});
   setHasSearched(true);
   setSubmitted({category:categoryOverride,province:searchProvince,district:searchDistrict,radius,nearbyDistricts,pos:plan.usePos?searchPosition:undefined,anchor:plan.anchor,forceRefresh});
 };

 const locate=async()=>{
   if(loading)return;
   try{
     setErr('');setLocationNotice('');
     setLoading(true);
     // The button must always request a fresh device position. Never reuse
     // an old cached coordinate when the user explicitly taps "Konumumu Kullan".
     const current=await getCurrentLocation({forceFresh:true});
     // Resolve GPS coordinates to the same province/district fields used by
     // manual selection, so the same live duty-pharmacy widget is selected.
     const area=await resolveLocationArea(current);
     setLocationState('granted');
     setPos(current);
     setProvince(area.province);
     setDistrict(area.district);
     setHasSearched(true);
     manualAreaChosenRef.current=false;
     setSubmitted({category:cat,province:area.province,district:area.district,radius,nearbyDistricts,pos:current,anchor:'gps'});
   }catch(e){
     const denied=e instanceof LocationError&&e.code==='permission_denied';
     const unsupported=e instanceof LocationError&&e.code==='unsupported';
     if(denied)setLocationState('denied');
     if(unsupported)setLocationState('unsupported');
     setErr(
       denied
         ? 'Konum izni kapalı. iPhone Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri → Safari yolundan izin verip tekrar deneyin.'
         : unsupported
           ? 'Bu tarayıcı konum özelliğini kullanamıyor. HTTPS bağlantısını ve Safari konum iznini kontrol edin.'
           : e instanceof LocationError && e.code === 'timeout'
             ? 'Konum isteği zaman aşımına uğradı. Açık alanda tekrar deneyin veya iPhone konum iznini kontrol edin.'
             : 'Cihaz konumu alınamadı. Konum iznini kontrol edip tekrar deneyin; isterseniz il / ilçe seçerek arama yapabilirsiniz.'
     );
   }finally{
     setLoading(false);
   }
 };

 locateRef.current=()=>{void locate()};

 const categoryList=categories.filter(c=>!['service','emergency'].includes(c.id));
 const activeLabel=pharmacyMode?'Nöbetçi Eczaneler':(categoryList.find(c=>c.id===cat)?.label||services.find(s=>s[0]===cat)?.[1]||'Hizmet');
 const visiblePlaces=resultsForCategory(places,submitted?.category,cat);
 const dutyView=pharmacyMode?dutyViewState({feedDate:dutyFeedDate,items:visiblePlaces,now:new Date(),tz:'Europe/Istanbul'}):{kind:'none' as const,items:[] as Place[]};
 const dutyItems=dutyView.kind==='list'?dutyView.items:[];
 const displayPlaces=pharmacyMode?nearbyPharmacies:visiblePlaces;
 const dutyLink=pharmacyMode?dutyLinkFor(province,false):null;
 const officialLink=pharmacyMode?officialLinkFor(province):null;
 const officialDutyUrl=dutyLink?.url||officialLink;
 const dutySourceDate=dutyFeedDate?formatDutySourceDate(dutyFeedDate,'Europe/Istanbul'):'';

 return <main className="inner nearby-page">
   <div className="page-title nearby-title">
     <button className="back-btn" onClick={()=>nav(-1)} aria-label="Geri">‹</button>
     <div><small>CANLI HİZMET ARAMA</small><h1>Yakınındaki Hizmetler</h1></div>
   </div>





   <div className="nearby-filters">
     <div className="filter-line">
       <label className="location-autocomplete">
         <span>İl</span>
         <input role="combobox" aria-autocomplete="list" aria-expanded={provinceOpen&&provinceOptions.length>0} autoComplete="off" value={province}
           onFocus={()=>setProvinceOpen(true)}
           onChange={e=>{manualAreaChosenRef.current=true;setProvince(e.target.value);setDistrict('');setProvinceOpen(true);setDistrictOpen(false)}}
           onBlur={()=>window.setTimeout(()=>setProvinceOpen(false),120)}
           placeholder="İl yazın (ör. Muş)" inputMode="text"/>
         {provinceOpen&&provinceOptions.length>0&&<div className="autocomplete-options" role="listbox">
           {provinceOptions.map(p=><button type="button" role="option" aria-selected={province===p} className="autocomplete-option" key={p}
             onMouseDown={e=>e.preventDefault()} onClick={()=>{manualAreaChosenRef.current=true;setProvince(p);setDistrict('');setProvinceOpen(false)}}>{p}</button>)}
         </div>}
       </label>
       <label className="location-autocomplete">
         <span>İlçe</span>
         <input role="combobox" aria-autocomplete="list" aria-expanded={districtOpen&&districtOptions.length>0} autoComplete="off"
           value={district} onFocus={()=>{if(province)setDistrictOpen(true)}}
           onChange={e=>{manualAreaChosenRef.current=true;setDistrict(e.target.value);setDistrictOpen(true)}}
           onBlur={()=>window.setTimeout(()=>setDistrictOpen(false),120)}
           placeholder={province?'İlçe yazın veya tüm ilçeler':'Önce il seçin'} disabled={!province}/>
         {districtOpen&&province&&districtOptions.length>0&&<div className="autocomplete-options" role="listbox">
           {districtOptions.map(d=><button type="button" role="option" aria-selected={district===d} className="autocomplete-option" key={d}
             onMouseDown={e=>e.preventDefault()} onClick={()=>{manualAreaChosenRef.current=true;setDistrict(d);setDistrictOpen(false)}}>{d}</button>)}
         </div>}
       </label>
     </div>

     <div className="category-chips" aria-label="Kategori">
       {categoryList.slice(0,9).map(c=>{const Icon=categoryIcon(c.id);return <button key={c.id} className={cat===c.id?'active':''} onClick={()=>{setCat(c.id);setPlaces([]);setNearbyPharmacies([]);setNearbyStatus('idle');setDutyFeedDate(null);setDutyError(false);setHasSearched(false);setErr('');setSubmitted(null);if(c.id!=='pharmacy')void search(false,c.id);}}><Icon/><span>{c.id==='pharmacy'?'Eczane':c.label.replace('En Yakın ','')}</span></button>})}
       {services.slice(0,6).map(([id,label])=>{const Icon=categoryIcon(id);return <button key={id} className={cat===id?'active':''} onClick={()=>{setCat(id);setPlaces([]);setNearbyPharmacies([]);setHasSearched(false);setErr('');setSubmitted(null);void search(false,id);}}><Icon/><span>{label}</span></button>})}
     </div>

     {!pharmacyMode&&<div className="search-options">
       <label className="toggle"><input type="checkbox" checked={nearbyDistricts} onChange={e=>setNearbyDistricts(e.target.checked)}/><span>Yakın ilçeleri de göster</span></label>
       <label className="radius-select"><span>Yarıçap</span><select value={radius} onChange={e=>setRadius(Number(e.target.value))}><option value={2}>2 km</option><option value={5}>5 km</option><option value={10}>10 km</option><option value={20}>20 km</option></select></label>
     </div>}

     <div className="action-row">
       <button className="search-filter primary-search" onClick={()=>void search()} disabled={loading}><Search/>{loading?'Aranıyor…':pharmacyMode?'Nöbetçi Eczaneleri Bul':'Yakınımdakileri Bul'}</button>
       <button type="button" className="search-filter location-search" onClick={()=>void locate()} disabled={loading}><LocateFixed/> Konumumu kullan</button>
     </div>
   </div>

   {locationNotice&&<div className="location-fallback-note" role="status">{locationNotice}</div>}
   {submitted?.anchor==='gps'&&accuracyWarning(submitted.pos?.accuracyM)&&<div className="location-accuracy-warning" role="status">{accuracyWarning(submitted.pos?.accuracyM)}</div>}
   {submitted?.anchor==='area'&&!locationNotice&&<div className="location-fallback-note" role="status">Mesafeler {submitted.district||submitted.province} merkezine göre. Gerçek mesafe için konumunu kullan. <button type="button" onClick={()=>void locate()}>Konumumu kullan</button></div>}
   <div className="selection-note">
     <span>{province?(district?province+' / '+district:province+' — tüm ilçeler'):pos?'GPS konumu alındı':'Konum veya il / ilçe seçebilirsin'}{!pharmacyMode&&submitted?' · '+distanceBasisLabel(submitted.anchor,submitted.district?submitted.province+' / '+submitted.district:submitted.province):''}{pharmacyMode?' · İlçe kapsamındaki tüm nöbetçi eczaneler':!pharmacyMode?' · '+effectiveRadius+' km yarıçap':''}</span>
     <span>Seçimler otomatik kaydedilir</span>
   </div>

   {!pharmacyMode&&err&&<div className="error nearby-error" role="alert">{err}</div>}
   {pharmacyMode&&hasSearched&&!loading&&dutyView.kind==='list'&&<section className="duty-summary"><div className="result-head"><b>Bugün nöbetçi{shouldShowDutyCount(dutyItems.length)&&<span>{dutyItems.length}</span>}</b></div><div className="results">{dutyItems.map(p=><EnhancedPlaceCard key={p.id} p={{...p,isDuty:true}} distanceLabel={submitted?distanceBasisLabel(submitted.anchor,submitted.district?submitted.province+' / '+submitted.district:submitted.province):'Konumuna göre, kuş uçuşu'} />)}</div></section>}
   {pharmacyMode&&hasSearched&&!loading&&dutyView.kind==='none'&&(dutyError?<p className="duty-calm-error">Nöbetçi eczane kaynağına ulaşılamadı. <button type="button" onClick={()=>void search(true)}>Tekrar dene</button></p>:<div className="duty-calm-note"><p>Bugün için doğrulanmış nöbetçi listesi yok{dutySourceDate?' (kaynak tarihi: '+dutySourceDate+')':''}. Eski liste gösterilmiyor.</p>{officialDutyUrl&&<a href={officialDutyUrl} target="_blank" rel="noopener noreferrer">{dutyLink?.button||'Resmî nöbetçi eczane sorgusunu aç'} <ExternalLink/></a>}</div>)}

   <>

    <div className="result-head">
     <b>{pharmacyMode?'Yakındaki eczaneler':activeLabel}{shouldShowDutyCount(displayPlaces.length)&&<span>{displayPlaces.length}</span>}</b>
     <div><button className={view==='list'?'active':''} onClick={()=>setView('list')}><List/>Liste</button><button className={view==='map'?'active':''} onClick={()=>setView('map')}><MapIcon/>Harita</button></div>
    </div>
    {pharmacyMode&&nearbyPharmacies.length>0&&<p className="pharmacy-results-note">Nöbet durumu doğrulanmadı; gitmeden telefonla teyit edin.</p>}

    {loading?<div className="results skeleton-results">{[1,2,3].map(i=><div className="nearby-skeleton" key={i}/>)}</div>:
     view==='map'&&displayPlaces[0]?<div className="map"><MapContainer center={[displayPlaces[0].lat,displayPlaces[0].lon]} zoom={13}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>{displayPlaces.map(p=><Marker key={p.id} position={[p.lat,p.lon]} icon={marker}><Popup><b>{p.name}</b><br/>{cleanCardAddress(p.address)}</Popup></Marker>)}</MapContainer></div>:
      <div className="results">
        {displayPlaces.length > 0 ? (
          <>
            {displayPlaces.map(p => <EnhancedPlaceCard key={p.id} p={pharmacyMode?{...p,isDuty:undefined}:p} distanceLabel={submitted?distanceBasisLabel(submitted.anchor,submitted.district?submitted.province+' / '+submitted.district:submitted.province):'Konumuna göre, kuş uçuşu'} />)}
          </>
        ) : pharmacyMode ? (
          nearbyStatus==='loading' ? <div className="results skeleton-results" aria-label="Yakındaki eczaneler yükleniyor">{[1,2,3].map(i=><div className="nearby-skeleton" key={i}/>)}</div> :
          nearbyStatus==='error' ? (dutyError ? null : <p className="duty-calm-error">Harita kaynağı yanıt vermedi. <button type="button" onClick={()=>void search(true)}>Tekrar dene</button></p>) :
          <div className="empty nearby-empty"><MapPin/><h3>Yakında genel eczane kaydı bulunamadı</h3><p>Bu bölgede gösterilebilecek yakın genel eczane kaydı bulunamadı.</p><button onClick={()=>void search(true)}><Search/>Tekrar Ara</button></div>
        ) : shouldShowEmpty({status:loading?'loading':err?'error':hasSearched?'success':'idle',forCategory:submitted?.category||'',currentCategory:cat,resultCount:visiblePlaces.length}) ? (
          <div className="empty nearby-empty"><MapPin/><h3>Bu bölgede kayıt bulunamadı</h3><p>Yarıçapı artırabilir veya “Yakın ilçeleri de göster” seçeneğini açabilirsin.</p><button onClick={()=>void search(true)}><Search/>Tekrar Ara</button></div>
        ) : null}
      </div>
     }


   </>
 </main>
}
function LegacyPlaceCard({p}:{p:Place}){
 const Icon=categoryIcon(p.category);
 return <article className={'place nearby-place-card'+(p.isDuty?' duty-place':'')}>
   <div className="place-icon category-place-icon"><Icon/></div>
   <div className="place-body">
     <div className="place-title-row"><h3>{p.name?.trim()||'İşletme adı bulunamadı'}</h3>{p.isDuty&&<span className="duty-badge">NÖBETÇİ</span>}</div>
     <p>{cleanCardAddress(p.address)}</p>
     <small className="place-meta-line"><Navigation/> <b>{formatDistance(p.distance)}</b> · Kuş uçuşu · <ShieldCheck/> {p.source}</small>
     {p.district&&<small className="place-district">İlçe: {p.district}</small>}{p.isDuty&&<small className="place-source-note">Veri: Eczane Adresi</small>}

     {p.phone?<footer className="place-actions"><a href={'tel:'+p.phone}><Phone/>Ara</a><a target="_blank" rel="noreferrer" href={'https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon}><Navigation/>Yol Tarifi</a><button><Heart/>Favori</button></footer>:<footer className="place-actions"><span className="no-phone">Telefon bilgisi yok</span><a target="_blank" rel="noreferrer" href={'https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon}><Navigation/>Yol Tarifi</a><button><Heart/>Favori</button></footer>}
   </div>
 </article>
}

function AdCampaigns(){
 const nav=useNavigate();const[tabs,setTabs]=useState<'ads'|'campaigns'|'discounts'|'partners'>('ads');const[ads,setAds]=useState<AdRow[]>([]);
 useEffect(()=>{let live=true;Promise.all(['home_top','home_mid','home_bottom'].map(placement=>fetch('/api/ads?placement='+placement).then(r=>r.ok?r.json():null).catch(()=>null))).then(rows=>{if(!live)return;const seen=new Set<number>();const all=rows.flatMap((x:unknown)=>{if(!x||typeof x!=='object')return [];const record=x as Record<string,unknown>;return Array.isArray(record.ads)?record.ads as AdRow[]:[];});setAds(all.filter((x:AdRow)=>{if(seen.has(x.id))return false;seen.add(x.id);return true}))});return()=>{live=false}},[]);
 return <main className="campaign-page"><header className="campaign-hero"><button onClick={()=>nav(-1)}>‹</button><div><small>YANINDA TÜRKİYE</small><h1>Reklam & Kampanyalar</h1></div></header><div className="campaign-tabs">{([['ads','Reklamlar'],['campaigns','Kampanyalar'],['discounts','İndirimler'],['partners','İş Birlikleri']] as const).map(([id,label])=><button key={id} className={tabs===id?'active':''} onClick={()=>setTabs(id)}>{label}</button>)}</div><section className="campaign-feature"><div><span>YANIMDA TÜRKİYE'DE ÖNE ÇIKIN</span><h2>İşletmenizi doğru kişilere tanıtın.</h2><p>Bölgesel görünürlük kazanın, yeni müşterilere ulaşın.</p><button onClick={()=>nav('/add-business')}>Reklam başvurusu <ArrowRight/></button></div><div className="campaign-feature-art"><Store/><MapPin/></div></section>{tabs==='ads'?<section className="campaign-list"><h2>Öne Çıkan Reklamlar</h2>{ads.length?ads.map(ad=><article className="campaign-ad-card" key={ad.id}>{httpUrl(ad.image_url)&&<img src={httpUrl(ad.image_url)} alt=""/>}<div><small>SPONSORLU</small><h3>{ad.title}</h3><p>{ad.text||'Yanımda Türkiye üzerinde tanıtım.'}</p>{httpUrl(ad.target_url)&&<a href={httpUrl(ad.target_url)} target="_blank" rel="sponsored noreferrer">İncele <ExternalLink/></a>}</div></article>):<div className="campaign-empty"><Store/><b>Henüz yayınlanmış reklam bulunmuyor.</b><span>Onaylanan reklamlar burada görüntülenecek.</span></div>}</section>:<div className="campaign-empty"><Bell/><b>{tabs==='campaigns'?'Yayındaki kampanyalar burada yer alacak.':tabs==='discounts'?'Güncel indirimler burada yer alacak.':'İş ortaklığı duyuruları burada yer alacak.'}</b><span>Yeni içerikler yayınlandığında bu bölümde görebileceksin.</span></div>}<button className="campaign-business-cta" onClick={()=>nav('/add-business')}><span><b>İşletmeniz için Reklam Verin</b><small>Yanımda Türkiye’de yerinizi alın</small></span><ArrowRight/></button></main>
}

function Services(){const nav=useNavigate();return <main className="inner services-page"><div className="page-title"><button onClick={()=>nav(-1)} aria-label="Geri">‹</button><div><small>YANINDA TÜRKİYE</small><h1>Hizmetler</h1></div></div><p className="lead">İhtiyacın olan hizmeti seç. İl / ilçe seçimin korunur ve aynı bölgeyi tekrar seçmek zorunda kalmazsın.</p><div className="services">{services.map(([id,label,Icon])=><button key={id} onClick={()=>nav('/nearby',{state:{category:id}})}><span><Icon/></span><b>{label}</b><ChevronRight/></button>)}</div><button className="business" onClick={()=>nav('/add-business')}><Building2/><div><b>İşletmeni / Hizmetini Ekle</b><small>Ücretsiz başvur · İnceleme sonrası yayın</small></div><ArrowRight/></button></main>}
function Emergency(){
 const items=[
   ['112','Acil Çağrı Merkezi','Polis, ambulans, jandarma ve itfaiye','112'],
   ['114','UZEM — Zehir Danışma','Zehirlenme danışmanlığı','114'],
   ['182','MHRS','Hastane randevusu','182'],
   ['153','Belediye','Belediye hizmetleri','153']
 ];
 const women=[
   {title:'ALO 183 · Şiddetle Mücadele',number:'183',detail:'Kadın, çocuk ve aile için sosyal destek ve yönlendirme · 7/24 ücretsiz',href:'tel:183'},
   {title:'Aile İçi Şiddet Acil Yardım Hattı',number:'0212 656 96 96',detail:'Türkiye Kadın Dernekleri Federasyonu · Her gün 09.00–24.00',href:'tel:02126569696'},
   {title:'Alternatif destek hattı',number:'0549 656 96 96',detail:'Türkiye Kadın Dernekleri Federasyonu · Her gün 09.00–24.00',href:'tel:05496569696'}
 ];
 return <main className="emergency emergency-modern">
   <div className="emergency-icon"><Siren/></div><small>ACİL DESTEK</small>
   <h1>Yardıma ihtiyacın<br/><b>varsa Yanında.</b></h1>
   <p>Acil durumda doğru numaraya hızlıca ulaş.</p>
   <a className="women-emergency-primary" href="tel:112"><span><Siren/></span><div><b>Hayati tehlike / acil şiddet</b><small>112 Acil Çağrı Merkezi · 7/24</small></div><strong>112 <Phone/></strong></a>
   <section className="women-support">
     <header><span><Heart/></span><div><small>KADINLARA ÖZEL DESTEK</small><h2>Yalnız değilsin.</h2></div></header>
     <p>Şiddet, tehdit veya güvenlik riski yaşıyorsan yardım isteyebilirsin.</p>
     <a className="kades-link" href="https://www.aile.gov.tr/media/278423/hizmet_rehber_kadin_hizmetleri.pdf" target="_blank" rel="noopener noreferrer"><span className="kades-symbol"><ShieldCheck/></span><div><b>KADES · Kadın Acil Destek Uygulaması</b><small>Resmî uygulama bilgisi ve indirme yönlendirmesi</small></div><ExternalLink/></a>
     {women.map(item=><a className="women-hotline" key={item.number} href={item.href}><span><b>{item.number}</b><small>{item.title}</small><em>{item.detail}</em></span><Phone/></a>)}
     <div className="women-safety-note"><Info/> Acil tehlikede önce 112’yi ara. KADES’i önceden telefonuna yükleyip kurulumunu tamamla. Güvenli değilse bu sayfayı kapatıp güvendiğin birinden yardım iste.</div>
   </section>
   <div className="emergency-grid">
     {items.map(([n,t,s,phone])=><a key={n} href={'tel:'+phone}><strong>{n}</strong><span>{t}<small>{s}</small></span><Phone/></a>)}
   </div>
   <div className="emergency-note"><Info/> 112; polis, jandarma, sağlık, itfaiye ve diğer acil çağrıları karşılar. 114 UZEM zehirlenme danışmanlığı içindir.</div>
   <button className="share-location" onClick={async()=>{
     try{
       const current=await getCurrentLocation({forceFresh:true});
       const url=mapsLink(current.lat,current.lon);
       await shareText('Yanımda Türkiye — Acil Konum','Konumum: '+url,url);
     }catch{window.alert('Konum alınamadı. Lütfen konum iznini kontrol edip tekrar deneyin.')}
   }}><LocateFixed/> Konumumu Yakınıma Gönder</button><small className="share-location-hint">Konum bağlantısını WhatsApp, SMS veya desteklenen başka bir uygulamayla paylaşabilirsin.</small><a className="call112" href="tel:112"><Phone/>112 Acil Çağrı</a>
 </main>
}
function AddBusiness(){
 const[ok,setOk]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const[f,setF]=useState({name:'',category:'',phone:'',whatsapp:'',address:'',province:'İstanbul',district:'Beyoğlu',description:'',hours:''});
 const ds=districtsFor(f.province);
 const set=(k:string,v:string)=>setF(x=>({...x,[k]:v}));
 const submit=async(e:FormEvent)=>{
   e.preventDefault();if(busy)return;setBusy(true);setError('');
   try{
     const r=await fetch('/api/submissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f)});
     const data=await r.json().catch(()=>({})) as {error?:string};
     if(r.ok){setOk(true);return;}
     if(r.status===429)throw new Error('Çok fazla başvuru gönderildi. Bir saat sonra tekrar deneyin.');
     if(data.error==='invalid_input')throw new Error('Bilgileri kontrol et: kategori, telefon, il ve ilçe geçerli olmalı.');
     if(data.error==='database_unavailable')throw new Error('Başvuru sistemi şu anda kullanılamıyor.');
     throw new Error('Başvuru gönderilemedi. Lütfen biraz sonra tekrar deneyin.');
   }catch(e){setError(e instanceof Error?e.message:'Bağlantı kurulamadı. İnternetini kontrol et.');}
   finally{setBusy(false);}
 };
 return <main className="form-page"><h1>İşletmeni / Hizmetini Ekle</h1><p>Bilgilerini bırak, inceleme sonrası ücretsiz yayınlayalım.</p>{ok?<div className="success"><ShieldCheck/><h2>Başvurun alındı.</h2><p>Başvurun incelendikten sonra yayınlanır.</p></div>:<form onSubmit={submit}>
  <label>İşletme / hizmet adı<input required maxLength={120} value={f.name} onChange={e=>set('name',e.target.value)}/></label>
  <label>Kategori<select required value={f.category} onChange={e=>set('category',e.target.value)}><option value="">Seçin</option>{services.map(s=><option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></label>
  <label>Telefon<input required type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={e=>set('phone',e.target.value)}/></label>
  <label>WhatsApp<input type="tel" inputMode="tel" maxLength={20} value={f.whatsapp} onChange={e=>set('whatsapp',e.target.value)}/></label>
  <label>Açık adres<input required minLength={10} maxLength={300} value={f.address} onChange={e=>set('address',e.target.value)}/></label>
  <div className="two"><label>İl<select value={f.province} onChange={e=>setF(x=>({...x,province:e.target.value,district:districtsFor(e.target.value)[0]||''}))}>{provinces.map(p=><option key={p}>{p}</option>)}</select></label><label>İlçe<select required value={f.district} onChange={e=>set('district',e.target.value)}>{ds.map(d=><option key={d}>{d}</option>)}</select></label></div>
  <label>Açıklama<textarea maxLength={800} value={f.description} onChange={e=>set('description',e.target.value)}/></label>
  <label>Çalışma saatleri<input maxLength={150} value={f.hours} onChange={e=>set('hours',e.target.value)}/></label>
  {error&&<div className="error" role="alert">{error}</div>}
  <button disabled={busy}>{busy?'Gönderiliyor…':'Başvuruyu Gönder'} <ArrowRight/></button>
 </form>}</main>
}
function MenuPage(){return <main className="menu-page"><h1>Menü</h1>{[['/calendar','Takvim & Önemli Günler',CalendarDays],['/nearby','Yakınımdaki hizmetler',Compass],['/services','Çözüm Merkezi',Wrench],['/emergency','Acil Durum',Siren],['/add-business','İşletmeni Ekle',Building2],['/admin','Admin Girişi',LockKeyhole]].map(([to,t,I])=><NavLink key={String(to)} to={String(to)}><I/><b>{String(t)}</b><ChevronRight/></NavLink>)}</main>}

type AdminStats={visitorsTotal:number;visitorsToday:number;searchesTotal:number;searchesToday:number;phoneClicks:number;directionsClicks:number;emergencyClicks:number;favoriteClicks:number};
type AdminAd={id:number;title:string;text?:string|null;image_url?:string|null;target_url?:string|null;placement:string;status:string};
type AdminSubmission={id:number;name:string;category:string;phone:string;address:string;province:string;district:string;status:string};
type AdminReport={id:number;place_name:string;reason:string;details?:string;created_at:string};
type AdminData={stats?:AdminStats;ads?:AdminAd[];submissions?:AdminSubmission[];reports?:AdminReport[]};
function Admin(){
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[ok,setOk]=useState(false),[data,setData]=useState<AdminData>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false);
 const[editingId,setEditingId]=useState<number|null>(null);
 const[adForm,setAdForm]=useState({title:'',text:'',image_url:'',target_url:'',placement:'home_top'});
 const refresh=async()=>{
   const r=await fetch('/api/admin',{cache:'no-store'});
   if(!r.ok)throw new Error(r.status===401?'Oturum süresi dolmuş. Yeniden giriş yap.':'Yönetim verileri alınamadı.');
   setData(await r.json() as AdminData);
 };
 useEffect(()=>{let active=true;fetch('/api/admin',{cache:'no-store'}).then(async r=>{if(r.ok){const d=await r.json() as AdminData;if(active){setData(d);setOk(true)}}}).catch(()=>undefined);return()=>{active=false}},[]);
 const login=async(e:FormEvent)=>{
   e.preventDefault();setError('');setLoading(true);
   try{const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'login',email,password})});
     if(!r.ok){setError(r.status===429?'Çok fazla deneme yapıldı. 10 dakika sonra tekrar dene.':'Giriş bilgileri hatalı veya admin yapılandırılmamış.');return;}
     setOk(true);setPassword('');await refresh();
   }catch(e){setError(e instanceof Error?e.message:'Bağlantı kurulamadı.')}finally{setLoading(false)}
 };
 const action=async(payload:Record<string,unknown>)=>{
   setNotice('');setError('');setLoading(true);
   try{const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
     if(!r.ok){const d=await r.json().catch(()=>({})) as {error?:string};throw new Error(d.error||'İşlem tamamlanamadı.');}
     await refresh();setNotice('İşlem başarıyla tamamlandı.');return true;
   }catch(e){setError(e instanceof Error?e.message:'Bağlantı kurulamadı.');return false}finally{setLoading(false)}
 };
 const saveAd=async(e:FormEvent)=>{
   e.preventDefault();
   const saved=await action({action:'save_ad',...(editingId?{id:editingId}:{}),...adForm});
   if(!saved)return;
   setEditingId(null);setAdForm({title:'',text:'',image_url:'',target_url:'',placement:'home_top'});
 };
 const logout=async()=>{
   try{await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})})}catch{}
   setOk(false);setData(undefined);setPassword('');
 };
 if(!ok)return <main className="admin-login"><div><ShieldCheck/><h1>Admin Paneli</h1><p>Yanında Türkiye yönetim merkezi</p><form onSubmit={login}><label>E-posta<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Şifre<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error" role="alert">{error}</div>}<button disabled={loading}>{loading?'Giriş yapılıyor…':'Giriş Yap'} <ArrowRight/></button></form></div></main>;
 const stats=data?.stats;
 const ads=data?.ads||[];
 return <main className="admin"><section>
   <header><div><h1>Yönetim Paneli</h1><p>Yalnızca veritabanından gelen gerçek kayıtlar gösterilir.</p></div><button type="button" onClick={logout}>Güvenli Çıkış</button></header>
   {error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="success" role="status">{notice}</div>}
   <div className="stats">
    {[['Toplam ziyaret',stats?.visitorsTotal],['Bugünkü ziyaret',stats?.visitorsToday],['Toplam arama',stats?.searchesTotal],['Bugünkü arama',stats?.searchesToday]].map(([label,value])=><article key={String(label)}><small>{label}</small><strong>{typeof value==='number'?value.toLocaleString('tr-TR'):'Veri yok'}</strong></article>)}
   </div>
   {!stats&&<p className="admin-data-note">İstatistikler henüz alınamadı; tahmini rakam gösterilmiyor.</p>}
   <div className="panel ads">
    <div className="panel-title"><div><h2>Reklam Yönetimi</h2><p>Gerçek reklam kayıtlarını ekle, düzenle, duraklat veya sil.</p></div></div>
    <form className="admin-ad-form" onSubmit={saveAd}>
     <label>Başlık<input required maxLength={120} placeholder="Örn. Hafta sonu fırsatları" value={adForm.title} onChange={e=>setAdForm(v=>({...v,title:e.target.value}))}/><small>Reklam kartında görülecek kısa başlık.</small></label>
     <label>Açıklama<textarea maxLength={300} rows={3} placeholder="Kampanyayı kısaca açıklayın." value={adForm.text} onChange={e=>setAdForm(v=>({...v,text:e.target.value}))}/><small>En fazla 300 karakter.</small></label>
     <label>Görsel URL<input type="url" placeholder="https://ornek.com/reklam.jpg" value={adForm.image_url} onChange={e=>setAdForm(v=>({...v,image_url:e.target.value}))}/><small>https ile başlayan herkese açık görsel adresi.</small></label>
     <label>Hedef URL<input type="url" placeholder="https://ornek.com/kampanya" value={adForm.target_url} onChange={e=>setAdForm(v=>({...v,target_url:e.target.value}))}/><small>Kullanıcı reklama dokunduğunda açılacak sayfa.</small></label>
     <label>Alan<select value={adForm.placement} onChange={e=>setAdForm(v=>({...v,placement:e.target.value}))}><option value="home_top">Ana sayfa üst – ilk içerik alanı</option><option value="home_mid">Ana sayfa orta – içerik akışı</option><option value="home_bottom">Ana sayfa alt – sayfa sonu</option></select><small>Reklamın ana sayfada gösterileceği konum.</small></label>
     <div className="admin-ad-preview"><b>Önizleme</b><span>{adForm.placement==='home_top'?'Ana sayfa üst alanı':adForm.placement==='home_mid'?'Ana sayfa orta alanı':'Ana sayfa alt alanı'}</span>{adForm.image_url&&<img src={adForm.image_url} alt="Reklam görseli önizlemesi" onError={e=>{e.currentTarget.style.display='none'}}/>}<strong>{adForm.title||'Reklam başlığı'}</strong><p>{adForm.text||'Reklam açıklaması burada görünecek.'}</p></div>
     <div className="admin-ad-actions"><button disabled={loading}>{loading?'Kaydediliyor…':editingId?'Reklamı Güncelle':'Reklam Ekle'}</button>{editingId&&<button type="button" onClick={()=>{setEditingId(null);setAdForm({title:'',text:'',image_url:'',target_url:'',placement:'home_top'})}}>Vazgeç</button>}</div>
    </form>
    {ads.length?ads.map(ad=><div className="ad-row" key={ad.id}>{ad.image_url&&<img src={ad.image_url} alt=""/>}<div><b>{ad.title}</b><small>{ad.placement} · {ad.status==='active'?'Yayında':'Duraklatıldı'}</small></div><button type="button" onClick={()=>{setEditingId(ad.id);setAdForm({title:ad.title,text:ad.text||'',image_url:ad.image_url||'',target_url:ad.target_url||'',placement:ad.placement||'home_top'})}}>Düzenle</button><button type="button" disabled={loading} onClick={()=>void action({action:'toggle_ad',id:ad.id})}>{ad.status==='active'?'Duraklat':'Yayınla'}</button><button type="button" disabled={loading} onClick={()=>{if(window.confirm('Bu reklam silinsin mi?'))void action({action:'delete_ad',id:ad.id})}}>Sil</button></div>):<p>Henüz kayıtlı reklam yok.</p>}
   </div>
   <div className="panel"><h2>İşletme Başvuruları</h2><p className="admin-section-help">İşletme kayıt taleplerini inceleyip yayın onayı verin veya reddedin.</p>{(data?.submissions||[]).length?(data?.submissions||[]).map(item=><div className="ad-row" key={item.id}><div><b>{item.name}</b><small>{item.category} · {item.province}/{item.district} · {item.phone}</small><small>{item.address} · {item.status}</small></div>{item.status==='pending'&&<><button disabled={loading} onClick={()=>void action({action:'approve_submission',id:item.id})}>Onayla</button><button disabled={loading} onClick={()=>void action({action:'reject_submission',id:item.id})}>Reddet</button></>}</div>):<p>Bekleyen veya kayıtlı başvuru yok.</p>}</div>
   <div className="panel"><h2>Hatalı Bilgi Bildirimleri</h2><p className="admin-section-help">Kullanıcıların bildirdiği yanlış veya güncel olmayan bilgileri takip edin.</p>{(data?.reports||[]).length?(data?.reports||[]).map(item=><div className="ad-row" key={item.id}><div><b>{item.place_name}</b><small>{item.reason} · {item.details||'Açıklama yok'}</small></div><button disabled={loading} onClick={()=>void action({action:'resolve_report',id:item.id})}>Çözüldü</button></div>):<p>Açık bildirim yok.</p>}</div>
  </section></main>;
}
function Legal({type}:{type:'kvkk'|'privacy'}){
 const privacy=type==='privacy';
 return <main className="inner legal nearby-page">
   <div className="page-title"><button className="back-btn" onClick={()=>history.back()} aria-label="Geri">‹</button><div><small>YANINDA TÜRKİYE</small><h1>{privacy?'Gizlilik':'KVKK'}</h1></div></div>
   <section><h2>{privacy?'Gizlilik ve Konum Verisi':'Kişisel Verilerin Korunması'}</h2>
   <p>Yanında Türkiye, hizmet araması için gerekli konum bilgisini yalnızca arama sırasında kullanır. Konum geçmişi kalıcı olarak saklanmaz; cihazdaki geçici konum önbelleği 10 dakika sonra geçersiz olur.</p>
   <p>İl, ilçe, kategori ve yarıçap seçimleri yalnızca kullanıcı deneyimini kolaylaştırmak için cihazda saklanır. Kullanıcı bunları tarayıcı verilerini temizleyerek silebilir.</p>
   <p>Harita ve açık veri sonuçlarında OpenStreetMap kaynakları kullanılabilir. Sonuçların kaynağı kart üzerinde gösterilir; işletme bilgilerinin güncelliği veri sağlayıcısına bağlıdır.</p>
   <p>İletişim veya işletme başvurusu sırasında gönderilen bilgiler yalnızca başvurunun değerlendirilmesi ve hizmetin yürütülmesi amacıyla işlenir.</p>
   <p><b>Analitik verileri:</b> Kabul tercihiyle sayfa görüntüleme, arama terimi, tıklanan öğe, cihaz/tarayıcı türü ve oturum süresi ölçülebilir. Sadece zorunlu tercihinde oturum kimliği, kullanıcı kimliği, IP özeti, yönlendiren adres ve ısı haritası koordinatları kaydedilmez; yalnızca olay adı, sayfa ve tarih anonim toplu sayım için tutulur.</p>
   <p><b>Saklama süresi:</b> Analitik olayları en fazla 90 gün tutulacak şekilde planlanır. Süre sonunda zamanlanmış temizlik görevi kayıtları siler. Veri silme talebi için site iletişim kanalından başvurabilirsiniz. Otomatik silme görevi henüz eklenmedi.</p>
   <p><b>Tercihinizi değiştirin:</b> Aşağıdaki seçeneklerden birini seçerek analitik iznini güncelleyebilirsiniz.</p>
   <div className="analytics-consent-actions legal-consent"><button type="button" onClick={()=>{localStorage.setItem('yt_analytics_consent','accepted');window.location.reload();}}>Analitiği kabul et</button><button type="button" onClick={()=>{localStorage.setItem('yt_analytics_consent','essential');localStorage.removeItem('yt_analytics_session');window.location.reload();}}>Sadece zorunlu</button></div>
   <p><b>Önemli:</b> Nöbetçi eczane durumu, resmi/güvenilir yapılandırılmış veri kaynağı doğrulanmadan “nöbetçi” olarak gösterilmez.</p>
 </section>
 </main>
}

function Simple({title}:{title:string}){return <main className="simple"><h1>{title}</h1><p>Yanında Türkiye.</p></main>}

export default function TargetApp(){
 const location=useLocation();
 useEffect(()=>{
  track('page_view',{path:location.pathname});
  const started=Date.now(),sent=new Set<number>();
  const thresholds=[25,50,75,100];
  const onScroll=()=>{
   const root=document.documentElement;
   const max=Math.max(1,root.scrollHeight-window.innerHeight);
   const depth=Math.min(100,Math.round(window.scrollY/max*100));
   for(const mark of thresholds){if(depth>=mark&&!sent.has(mark)){sent.add(mark);track('scroll_depth',{depth:mark});}}
  };
  const onClick=(event:MouseEvent)=>{
   const node=event.target instanceof Element?event.target.closest('a,button,[role="button"],[data-track-id]'):null;
   if(!node)return;
   const el=node as HTMLElement;
   const label=(el.getAttribute('aria-label')||el.textContent||el.getAttribute('title')||'').trim().replace(/\\s+/g,' ').slice(0,100);
   const href=el instanceof HTMLAnchorElement?el.href:'';
   const key=el.dataset.trackId||[location.pathname,el.tagName,label.toLocaleLowerCase('tr-TR')].join(':').slice(0,140);
   el.dataset.trackId=key;
   let eventName:'phone_click'|'whatsapp_click'|'directions_click'|'website_click'|'category_click'|'place_click'|'favorite_click'|'share_click'='place_click';
   if(href.startsWith('tel:'))eventName='phone_click';
   else if(/wa\\.me|whatsapp/i.test(href))eventName='whatsapp_click';
   else if(/maps|directions/i.test(href))eventName='directions_click';
   else if(href&&new URL(href,window.location.origin).origin!==window.location.origin)eventName='website_click';
   else if(el.closest('.place'))eventName='place_click';
   else if(/favori|kalp/i.test(label))eventName='favorite_click';
   else if(/paylaş/i.test(label))eventName='share_click';
   else if(el.closest('.quick-grid,.popular-grid,.category-grid'))eventName='category_click';
   const rect=el.getBoundingClientRect();
   const x=Math.max(0,Math.min(100,Math.round((event.clientX/Math.max(1,window.innerWidth))*100)));
   const y=Math.max(0,Math.min(100,Math.round(((event.clientY+window.scrollY)/Math.max(1,document.documentElement.scrollHeight))*100)));
   track(eventName,{target_id:key,target_label:label,target_type:el.tagName.toLowerCase(),x,y});
   track('heatmap_click',{target_id:key,target_label:label,x,y});
  };
  const onExit=()=>track('time_on_page',{duration_seconds:Math.max(0,Math.round((Date.now()-started)/1000))});
  window.addEventListener('scroll',onScroll,{passive:true});
  document.addEventListener('click',onClick,true);
  window.addEventListener('pagehide',onExit,{once:true});
  onScroll();
  return()=>{window.removeEventListener('scroll',onScroll);document.removeEventListener('click',onClick,true);window.removeEventListener('pagehide',onExit);};
 },[location.pathname]);
 return <div><Header/><Routes><Route path="/" element={<Home/>}/><Route path="/nearby" element={<Nearby/>}/><Route path="/services" element={<Services/>}/><Route path="/ads" element={<AdCampaigns/>}/><Route path="/emergency" element={<Emergency/>}/><Route path="/add-business" element={<AddBusiness/>}/><Route path="/menu" element={<MenuPage/>}/><Route path="/admin" element={<Admin/>}/><Route path="/favorites" element={<FavoritesPage/>}/><Route path="/calendar" element={<CalendarPage/>}/><Route path="/news" element={<Simple title="Haberler"/>}/><Route path="/contact" element={<Simple title="İletişim"/>}/><Route path="/kvkk" element={<Legal type="kvkk"/>}/><Route path="/gizlilik" element={<Legal type="privacy"/>}/><Route path="*" element={<Home/>}/></Routes><MobileNav/><ChatWidget/><AnalyticsConsentBanner/></div>
}