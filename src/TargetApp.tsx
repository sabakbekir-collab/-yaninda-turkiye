import {useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {NavLink,useLocation,useNavigate,useSearchParams,Routes,Route} from 'react-router-dom';
import {Activity,ArrowRight,Banknote,Bell,Building2,Bus,ChevronRight,Compass,Fuel,Heart,Hospital,Landmark,List,LocateFixed,LockKeyhole,Map as MapIcon,MapPin,Menu,Navigation,Phone,Search,ShieldCheck,Siren,Store,Pill,UserCircle,Wrench,ExternalLink,Info,Paintbrush,Zap,KeyRound,Truck,Snowflake,Car,Smartphone,Laptop,Armchair,TreePine,ShoppingBasket,Utensils,Hotel,Package} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {MapContainer,Marker,Popup,TileLayer} from 'react-leaflet';
import L from 'leaflet';
import {categories,keywordMap,provinces,services} from './data';
import {districtsFor} from './turkeyDistricts';
import {findPlaces} from './api';
import {getCurrentLocation,getLocationPermissionState,LocationError} from './location';
import type {Place,Position} from './types';

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
 const nav=useNavigate(); const location=useLocation(); const[q,setQ]=useState(''); const[selection,setSelection]=useState(readHeaderLocation());
 useEffect(()=>{const refresh=()=>setSelection(readHeaderLocation()); window.addEventListener('storage',refresh); window.addEventListener('yt-nearby-memory',refresh); refresh(); return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('yt-nearby-memory',refresh)}},[]);
 const nearbyActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')!=='map';
 const mapActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')==='map';
 const submitSearch=(e:FormEvent)=>{e.preventDefault();const query=q.trim();if(query)nav('/nearby',{state:{query}})};
 return <header className="yt-header"><div className="yt-head"><NavLink to="/" className="yt-logo"><span><MapPin fill="currentColor"/></span><b>YANINDA <i>TÜRKİYE</i></b></NavLink><form className="yt-search" onSubmit={submitSearch}><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ne arıyorsunuz? (Eczane, ATM, Hastane...)"/><span><MapPin/> {selection}</span><button type="submit">Ara</button></form><div className="yt-actions"><button type="button" aria-label="Tema"><span aria-hidden="true">☀</span></button><NavLink to="/admin">Giriş Yap</NavLink><button type="button" onClick={()=>nav('/menu')} aria-label="Menüyü aç"><Menu/></button></div></div><nav className="yt-nav"><NavLink to="/">⌂ Ana Sayfa</NavLink><NavLink className={nearbyActive?'active':''} to="/nearby"><Compass/>Yakınımda</NavLink><NavLink className={mapActive?'active':''} to="/nearby?view=map"><MapIcon/>Harita</NavLink><NavLink className="danger" to="/emergency"><Siren/>Acil</NavLink><NavLink to="/favorites"><Heart/>Favoriler</NavLink><NavLink to="/news"><Landmark/>Haberler</NavLink><NavLink to="/contact"><Phone/>İletişim</NavLink></nav></header>
}

function MobileNav(){
 const location=useLocation();
 const nearbyActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')!=='map';
 const mapActive=location.pathname==='/nearby'&&new URLSearchParams(location.search).get('view')==='map';
 return <nav className="mobile-nav"><NavLink to="/">⌂<small>Ana Sayfa</small></NavLink><NavLink className={nearbyActive?'active':''} to="/nearby"><Compass/><small>Yakınımda</small></NavLink><NavLink className={mapActive?'active':''} to="/nearby?view=map"><MapIcon/><small>Harita</small></NavLink><NavLink className="danger" to="/emergency"><Siren/><small>Acil</small></NavLink><NavLink to="/menu"><Menu/><small>Menü</small></NavLink></nav>
}

function Ad({kind}:{kind:'top'|'mid'|'bottom'}){
 const[ad,setAd]=useState<{title:string;text?:string;image_url?:string;target_url?:string}|null>(null);
 useEffect(()=>{fetch('/api/ads?placement=home_'+kind,{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():[]).then((rows:unknown)=>{if(Array.isArray(rows)&&rows[0]&&typeof rows[0]==='object')setAd(rows[0] as {title:string;text?:string;image_url?:string;target_url?:string})}).catch(()=>undefined)},[kind]);
 if(!ad)return null;
 const content=<><small>Reklam</small>{ad.image_url&&<img src={ad.image_url} alt="" loading={kind==='top'?'eager':'lazy'}/>}<div><strong>{ad.title}</strong>{ad.text&&<b>{ad.text}</b>}</div></>;
 return ad.target_url?<a href={ad.target_url} className="yt-ad" target="_blank" rel="noreferrer">{content}</a>:<div className="yt-ad">{content}</div>;
}

const quick:[string,string,LucideIcon,string][]=[
['pharmacy','Eczaneler',Pill,'red'],['hospital','Hastane',Hospital,'blue'],['emergency','Acil Servis',Siren,'red'],['atm',"ATM'ler",Banknote,'purple'],['fuel','Akaryakıt',Fuel,'green'],['market','Market',Store,'orange'],['bakery','Fırın',ShoppingBasket,'amber'],['transport','Ulaşım',Bus,'blue'],['police','Polis',ShieldCheck,'navy'],['fire_station','İtfaiye',Siren,'red']
];

function Home(){
 const nav=useNavigate(); const[q,setQ]=useState('');
 const go=(id:string)=>id==='emergency'?nav('/emergency'):id==='service'?nav('/services'):nav('/nearby',{state:{category:id}});
 const search=(e?:FormEvent)=>{e?.preventDefault();const query=q.trim();nav('/nearby',{state:{query,category:resolveSearchCategory(query)}})};
 return <main className="yt-home"><section className="yt-hero"><div className="yt-hero-bg" style={{backgroundImage:`url(${imgs.hero})`}}><div className="yt-hero-overlay"><div><h1>Türkiye'de<br/>İhtiyacın Olan<br/><b>Her Şey Şimdi Yanında.</b></h1><p>Sağlık, güvenlik, ulaşım, günlük ihtiyaçlar ve daha fazlası.<br/>Bul, keşfet, yolunu kolaylaştır.</p></div><form className="yt-hero-search" onSubmit={search}><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ne arıyorsunuz? (Eczane, ATM, Hastane...)"/><button>Ara</button></form></div><div className="hero-ad"><Ad kind="top"/></div></div></section><section className="quick-grid">{quick.map(([id,label,Icon,c])=><button key={id} onClick={()=>go(id)} className={c}><span><Icon/></span><b>{label}</b></button>)}<button onClick={()=>go('service')} className="more"><span>•••</span><b>Tüm Hizmetler</b></button></section><section className="yt-section"><div className="yt-section-head"><h2>Yakınındaki Popüler Hizmetler</h2><button onClick={()=>go('service')}>Tümünü Gör <ArrowRight/></button></div><div className="popular-grid">{[['Eczaneler','Yakınındaki eczaneler','pharmacy'],['Hastaneler','En Yakın Hastaneler','hospital'],["ATM'ler",'Tüm Bankalar','atm'],['Akaryakıt İstasyonları','En Yakın Benzinciler','fuel'],['Marketler','Zincir Marketler','market'],['Fırınlar','Taze ve Yakın','bakery'],['Ulaşım','Otobüs, Metro, Taksi','transport']].map(([a,b,k])=><button key={a} onClick={()=>go(k)}><img src={imgs[k as keyof typeof imgs]} alt=""/><strong>{a}</strong><small>{b}</small></button>)}</div></section><Ad kind="mid"/><section className="yt-section live-cta"><div><span>CANLI VERİ</span><h2>Yakındaki eczaneleri konumuna göre bul</h2><p>Sonuçları mesafeye göre sıralarız. Nöbetçi verisi için resmî Sağlık Bakanlığı / e-Nabız kaynağını da kontrol edebilirsin.</p></div><button onClick={()=>go('pharmacy')}><LocateFixed/> Eczaneleri Bul</button></section><Ad kind="bottom"/></main>
}

type NearbyMemory={category?:string;province?:string;district?:string;radius?:number;nearbyDistricts?:boolean};
function readNearbyMemory():NearbyMemory{
  try{const raw=localStorage.getItem('yt-nearby-selection-v5');if(!raw)return {};const value=JSON.parse(raw) as NearbyMemory;return value&&typeof value==='object'?value:{};}catch{return {}}
}
function writeNearbyMemory(value:NearbyMemory){
  try{
    localStorage.setItem('yt-nearby-selection-v5',JSON.stringify(value));
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
function Nearby(){
 const location=useLocation();
 const nav=useNavigate();
 const[params,setParams]=useSearchParams();
 const memory=readNearbyMemory();

 const[cat,setCat]=useState(params.get('category')||state.category||memory.category||'pharmacy');
 const[province,setProvince]=useState(params.get('province')||state.province||memory.province||'');
 const[district,setDistrict]=useState(params.get('district')||state.district||'');
 const[radius,setRadius]=useState(Number(params.get('radius')||memory.radius||5));
 const[nearbyDistricts,setNearbyDistricts]=useState(params.get('nearbyDistricts')==='1'||Boolean(memory.nearbyDistricts));
 const[places,setPlaces]=useState<Place[]>([]);
 const[loading,setLoading]=useState(false);
 const[view,setView]=useState<'list'|'map'>(params.get('view')==='map'?'map':'list');
 const[err,setErr]=useState('');
 const[hasSearched,setHasSearched]=useState(false);
 const[locationState,setLocationState]=useState<'unknown'|'granted'|'denied'|'prompt'|'unsupported'>('unknown');
 const[submitted,setSubmitted]=useState<{category:string;province:string;district:string;radius:number;nearbyDistricts:boolean;pos?:Position}|null>(null);

 const ds=useMemo(()=>districtsFor(province),[province]);
 const validProvince=useMemo(()=>provinces.includes(province),[province]);
 const validDistrict=useMemo(()=>!district||ds.includes(district),[district,ds]);
 const pharmacyMode=cat==='pharmacy';
 const effectiveRadius=district&&nearbyDistricts?Math.min(20,Math.max(radius,radius*1.5)):radius;

 useEffect(()=>{
   writeNearbyMemory({category:cat,province,district,radius,nearbyDistricts});
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

 useEffect(()=>{
   getLocationPermissionState().then(s=>setLocationState(s)).catch(()=>setLocationState('unknown'));
 },[]);

 useEffect(()=>{
   const incoming=location.state as {category?:string;province?:string;district?:string;query?:string}|null;
   if(!incoming)return;
   if(incoming.province!==undefined)setProvince(incoming.province);
   if(incoming.district!==undefined)setDistrict(incoming.district);
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
       setSubmitted({category:resolved,province,district,radius,nearbyDistricts});
     }else{
       setErr('Kategori bulundu. Arama için il / ilçe seç veya “Konumumu Kullan” butonuna bas.');
     }
   }
 },[location.key]);

 useEffect(()=>{
   if(!submitted)return;
   let cancelled=false;
   setLoading(true);setErr('');
   findPlaces(submitted.category,submitted.pos,submitted.province,submitted.district,{radiusKm:submitted.radius,nearbyDistricts:submitted.nearbyDistricts})
     .then(r=>{if(!cancelled)setPlaces(r)})
     .catch(()=>{if(!cancelled){setPlaces([]);setErr('Hizmet verileri şu anda alınamadı. Lütfen tekrar deneyin.')}})
     .finally(()=>{if(!cancelled)setLoading(false)});
   return()=>{cancelled=true};
 },[submitted]);

 const search=()=>{
   setErr('');
   if(!province){setErr('Arama için önce bir il seç veya Konumumu Kullan butonuna bas.');return;}
   if(!validProvince){setErr('İl adını listeden seç.');return;}
   if(!validDistrict){setErr('İlçeyi listeden seç veya “Tüm ilçeler” olarak bırak.');return;}
   setHasSearched(true);
   setSubmitted({category:cat,province,district,radius,nearbyDistricts});
 };

 const locate=async()=>{
   try{
     setErr('');
     const current=await getCurrentLocation();
     setLocationState('granted');
     setHasSearched(true);
     // IMPORTANT: location search no longer clears the user's manual province/district.
     setSubmitted({category:cat,province,district,radius,nearbyDistricts,pos:current});
   }catch(e){
     const denied=e instanceof LocationError&&e.code==='permission_denied';
     if(denied)setLocationState('denied');
     setErr(denied?'Konum izni kapalı. İl / ilçe seçerek arama yapabilirsin; tekrar izin istemeyeceğiz.':'Konum alınamadı. İl / ilçe seçerek arama yapabilirsin.');
   }
 };

 const categoryList=categories.filter(c=>!['service','emergency'].includes(c.id));
 const activeLabel=pharmacyMode?'Yakındaki Eczaneler':(categoryList.find(c=>c.id===cat)?.label||services.find(s=>s[0]===cat)?.[1]||'Hizmet');
 const officialPharmacyUrl=province==='İstanbul'?'https://www.istanbuleczaciodasi.org.tr/nobetci-eczane/':'https://enabiz.gov.tr/NobetciEczane';

 return <main className="inner nearby-page">
   <div className="page-title nearby-title">
     <button className="back-btn" onClick={()=>nav(-1)} aria-label="Geri">‹</button>
     <div><small>CANLI HİZMET ARAMA</small><h1>Yakınındaki Hizmetler</h1></div>
     <button className="locate-top" onClick={locate} title="Konumumu kullan" aria-label="Konumumu kullan"><LocateFixed/></button>
   </div>

   {pharmacyMode&&<div className="pharmacy-warning">
     <div><Info/><div><b>Nöbetçi durumu resmi kaynaktan doğrulanmıyor.</b><span>Buradaki sonuçlar yalnızca yakındaki eczanelerdir; nöbetçi olarak işaretlenmez.</span></div></div>
     <a href={officialPharmacyUrl} target="_blank" rel="noreferrer">Resmi nöbetçi eczane sorgusu <ExternalLink/></a>
   </div>}

   {locationState==='denied'&&<div className="location-denied"><Info/><span>Konum izni kapalı. İl / ilçe seçimiyle devam edebilirsin.</span></div>}

   <div className="nearby-filters">
     <div className="filter-line">
       <label><span>İl</span><input list="yt-provinces" value={province} onChange={e=>{setProvince(e.target.value);setDistrict('')}} placeholder="İl seçin" inputMode="text"/></label>
       <label><span>İlçe</span><input list="yt-districts" value={district} onChange={e=>setDistrict(e.target.value)} placeholder={province?'Tüm ilçeler':'Önce il seçin'} disabled={!province}/></label>
     </div>
     <datalist id="yt-provinces">{provinces.map(p=><option key={p} value={p}/>)}</datalist>
     <datalist id="yt-districts">{ds.map(d=><option key={d} value={d}/>)}</datalist>

     <div className="category-chips" aria-label="Kategori">
       {categoryList.slice(0,9).map(c=>{const Icon=categoryIcon(c.id);return <button key={c.id} className={cat===c.id?'active':''} onClick={()=>setCat(c.id)}><Icon/><span>{c.id==='pharmacy'?'Eczane':c.label.replace('En Yakın ','')}</span></button>})}
       {services.slice(0,6).map(([id,label])=>{const Icon=categoryIcon(id);return <button key={id} className={cat===id?'active':''} onClick={()=>setCat(id)}><Icon/><span>{label}</span></button>})}
     </div>

     <div className="search-options">
       <label className="toggle"><input type="checkbox" checked={nearbyDistricts} onChange={e=>setNearbyDistricts(e.target.checked)}/><span>Yakın ilçeleri de göster</span></label>
       <label className="radius-select"><span>Yarıçap</span><select value={radius} onChange={e=>setRadius(Number(e.target.value))}><option value={2}>2 km</option><option value={5}>5 km</option><option value={10}>10 km</option><option value={20}>20 km</option></select></label>
     </div>

     <div className="action-row">
       <button className="search-filter primary-search" onClick={search} disabled={loading}><Search/>{loading?'Aranıyor…':'Yakınımdakileri Bul'}</button>
       <button className="location-search" onClick={locate}><LocateFixed/> Konumumu Kullan</button>
     </div>
   </div>

   <div className="selection-note">
     <span>{province?(district?province+' / '+district:province+' — tüm ilçeler'): 'Konum veya il / ilçe seçebilirsin'} · {effectiveRadius} km kullanılan yarıçap</span>
     <span>Seçimler otomatik kaydedilir</span>
   </div>

   {err&&<div className="error nearby-error">{err}</div>}

   <div className="result-head">
     <b>{activeLabel} <span>{loading?'…':places.length}</span></b>
     <div><button className={view==='list'?'active':''} onClick={()=>setView('list')}><List/>Liste</button><button className={view==='map'?'active':''} onClick={()=>setView('map')}><MapIcon/>Harita</button></div>
   </div>

   {loading?<div className="results skeleton-results">{[1,2,3].map(i=><div className="nearby-skeleton" key={i}/>)}</div>:
    view==='map'&&places[0]?<div className="map"><MapContainer center={[places[0].lat,places[0].lon]} zoom={13}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>{places.map(p=><Marker key={p.id} position={[p.lat,p.lon]} icon={marker}><Popup><b>{p.name}</b><br/>{cleanCardAddress(p.address)}</Popup></Marker>)}</MapContainer></div>:
    <div className="results">{places.length?places.map(p=><PlaceCard key={p.id} p={p}/>):<div className="empty nearby-empty"><MapPin/><h3>{hasSearched?'Bu bölgede kayıt bulunamadı':'Arama yapmaya hazır'}</h3><p>{hasSearched?'Yarıçapı artırabilir veya “Yakın ilçeleri de göster” seçeneğini açabilirsin.':'İl / ilçe seçip Yakınımdakileri Bul’a bas veya konumunu kullan.'}</p><button onClick={hasSearched?search:locate}>{hasSearched?<Search/>:<LocateFixed/>}{hasSearched?'Tekrar Ara':'Konumumu Kullan'}</button></div>}</div>}
 </main>
}
function PlaceCard({p}:{p:Place}){
 const Icon=categoryIcon(p.category);
 return <article className="place nearby-place-card">
   <div className="place-icon category-place-icon"><Icon/></div>
   <div className="place-body">
     <div className="place-title-row"><h3>{p.name?.trim()||'İşletme adı bulunamadı'}</h3></div>
     <p>{cleanCardAddress(p.address)}</p>
     <small className="place-meta-line"><Navigation/> <b>{formatDistance(p.distance)}</b> · Kuş uçuşu · <ShieldCheck/> {p.source}</small>
     {p.district&&<small className="place-district">İlçe: {p.district}</small>}

     {p.phone?<footer><a href={'tel:'+p.phone}><Phone/>Ara</a><a target="_blank" rel="noreferrer" href={'https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon}><Navigation/>Yol Tarifi</a><button><Heart/>Favori</button></footer>:<footer><span className="no-phone">Telefon bilgisi yok</span><a target="_blank" rel="noreferrer" href={'https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon}><Navigation/>Yol Tarifi</a><button><Heart/>Favori</button></footer>}
   </div>
 </article>
}
function Services(){const nav=useNavigate();return <main className="inner services-page"><div className="page-title"><button onClick={()=>nav(-1)} aria-label="Geri">‹</button><div><small>YANINDA TÜRKİYE</small><h1>Hizmetler</h1></div></div><p className="lead">İhtiyacın olan hizmeti seç. İl / ilçe seçimin korunur ve aynı bölgeyi tekrar seçmek zorunda kalmazsın.</p><div className="services">{services.map(([id,label,Icon])=><button key={id} onClick={()=>nav('/nearby',{state:{category:id}})}><span><Icon/></span><b>{label}</b><ChevronRight/></button>)}</div><button className="business" onClick={()=>nav('/add-business')}><Building2/><div><b>İşletmeni / Hizmetini Ekle</b><small>Ücretsiz başvur · İnceleme sonrası yayın</small></div><ArrowRight/></button></main>}
function Emergency(){
 const items=[
   ['112','Acil Çağrı Merkezi','Acil yardım'],
   ['114','UZEM — Zehir Danışma','Sağlık Bakanlığı'],
   ['182','MHRS','Sağlık / randevu'],
   ['153','Belediye','Belediye hizmetleri'],
   ['156','Jandarma → 112','Güncel acil çağrı: 112'],
   ['177','Orman Yangını → 112','Güncel acil çağrı: 112']
 ];
 return <main className="emergency emergency-modern">
   <div className="emergency-icon"><Siren/></div><small>ACİL DESTEK</small>
   <h1>Yardıma ihtiyacın<br/><b>varsa Yanında.</b></h1>
   <p>Acil durumda doğru numaraya hızlıca ulaş.</p>
   <div className="emergency-grid">
     {items.map(([n,t,s])=><a key={n} href={'tel:'+(n==='156'||n==='177'?'112':n)}><strong>{n}</strong><span>{t}<small>{s}</small></span><Phone/></a>)}
   </div>
   <div className="emergency-note"><Info/> 156 Jandarma ve 177 Orman Yangını acil çağrıları 112 sistemi altında karşılanıyor. 114 UZEM zehirlenme danışmanlığı için kullanılabilir.</div>
   <a className="call112" href="tel:112"><Phone/>112 Acil Çağrı</a>
 </main>
}
function AddBusiness(){const[ok,setOk]=useState(false);const[f,setF]=useState({name:'',category:'',phone:'',whatsapp:'',address:'',province:'İstanbul',district:'Beyoğlu',description:'',hours:''});const ds=districtsFor(f.province);const set=(k:string,v:string)=>setF(x=>({...x,[k]:v}));const submit=async(e:FormEvent)=>{e.preventDefault();const r=await fetch('/api/submissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f)});if(r.ok)setOk(true)};return <main className="form-page"><h1>İşletmeni / Hizmetini Ekle</h1><p>Bilgilerini bırak, inceleme sonrası ücretsiz yayınlayalım.</p>{ok?<div className="success"><ShieldCheck/><h2>Başvurun alındı.</h2></div>:<form onSubmit={submit}><label>İşletme / hizmet adı<input required value={f.name} onChange={e=>set('name',e.target.value)}/></label><label>Kategori<select required value={f.category} onChange={e=>set('category',e.target.value)}><option value="">Seçin</option>{services.map(s=><option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></label><label>Telefon<input required value={f.phone} onChange={e=>set('phone',e.target.value)}/></label><label>WhatsApp<input value={f.whatsapp} onChange={e=>set('whatsapp',e.target.value)}/></label><label>Açık adres<input required value={f.address} onChange={e=>set('address',e.target.value)}/></label><div className="two"><label>İl<select value={f.province} onChange={e=>{set('province',e.target.value);set('district','')}}>{provinces.map(p=><option key={p}>{p}</option>)}</select></label><label>İlçe<select value={f.district} onChange={e=>set('district',e.target.value)}>{ds.map(d=><option key={d}>{d}</option>)}</select></label></div><label>Açıklama<textarea value={f.description} onChange={e=>set('description',e.target.value)}/></label><button>Başvuruyu Gönder <ArrowRight/></button></form>}</main>}

function MenuPage(){return <main className="menu-page"><h1>Menü</h1>{[['/nearby','Yakınımdaki hizmetler',Compass],['/services','Çözüm Merkezi',Wrench],['/emergency','Acil Durum',Siren],['/add-business','İşletmeni Ekle',Building2],['/admin','Admin Girişi',LockKeyhole]].map(([to,t,I])=><NavLink key={String(to)} to={String(to)}><I/><b>{String(t)}</b><ChevronRight/></NavLink>)}</main>}

type AdminStats={visitorsTotal?:number;visitorsToday?:number;searchesTotal?:number};
type AdminAd={id:string|number;title:string;image_url?:string;placement?:string;status?:string};
type AdminData={stats?:AdminStats;ads?:AdminAd[]};
function Admin(){
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[ok,setOk]=useState(false),[data,setData]=useState<AdminData>(),[error,setError]=useState('');
 const login=async(e:FormEvent)=>{e.preventDefault();const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'login',email,password})});if(r.ok){setOk(true)}else setError('Giriş bilgileri hatalı veya admin yapılandırılmamış.')};
 useEffect(()=>{if(ok)fetch('/api/admin').then(r=>r.ok?r.json():null).then(setData).catch(()=>{})},[ok]);
 if(!ok)return <main className="admin-login"><div><ShieldCheck/><h1>Admin Paneli</h1><p>Yanında Türkiye yönetim merkezi</p><form onSubmit={login}><label>E-posta<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Şifre<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error">{error}</div>}<button>Giriş Yap <ArrowRight/></button></form></div></main>;
 const stats=data?.stats||{}; const ads=data?.ads||[];
 return <main className="admin"><aside><div className="admin-brand"><MapPin/> YANINDA <b>TÜRKİYE</b></div>{['Genel Bakış','Hizmetler','Eczaneler','Hastaneler',"ATM'ler",'Akaryakıt','Marketler','Haberler','Reklam Yönetimi','Kullanıcılar','İstatistikler','Ayarlar'].map((x,i)=><button className={i===0?'active':''} key={x}><Activity/>{x}</button>)}</aside><section><header><div><h1>Genel Bakış</h1><p>Yanında Türkiye'nin yönetim merkezi</p></div><div><Bell/> <span>Admin</span><UserCircle/></div></header><div className="stats">{[['Toplam Kullanıcı',stats.visitorsTotal??12548,'↑ 12%'],['Bugünkü Ziyaret',stats.visitorsToday??3245,'↑ 8%'],['Hizmet Aramaları',stats.searchesTotal??8420,'↑ 15%'],['Reklam Geliri','₺1.250','↑ 20%']].map(([a,b,c])=><article key={String(a)}><small>{a}</small><strong>{b}</strong><span>{c}</span></article>)}</div><div className="admin-grid"><div className="panel"><h2>Son 7 Gün Ziyaretçi Grafiği</h2><div className="chart">{[35,50,47,65,48,76,90].map((h,i)=><i key={i} style={{height:h+'%'}}/>)}</div></div><div className="panel"><h2>En Çok Kullanılan Hizmetler</h2>{[['Nöbetçi Eczane',32],['Hastane',18],['ATM',12],['Akaryakıt',10],['Market',8]].map(([x,n])=><div className="bar" key={String(x)}><span>{x}</span><i style={{width:Number(n)*2.2+'%'}}/><b>{n}%</b></div>)}</div></div><div className="panel ads"><div className="panel-title"><div><h2>Reklam Yönetimi</h2><p>Web sitesindeki reklam alanlarını yönet</p></div><button>+ Yeni Reklam Ekle</button></div>{(ads.length?ads:[{id:1,title:'Ana Banner',image_url:imgs.hero,placement:'1200×600'},{id:2,title:'Orta Banner',image_url:imgs.burger,placement:'1200×200'},{id:3,title:'Alt Banner',image_url:imgs.trend,placement:'1200×200'}]).map((ad:AdminAd)=><div className="ad-row" key={ad.id}><img src={ad.image_url||imgs.hero} alt=""/><div><b>{ad.title}</b><small>{ad.placement}</small></div><span>Aktif</span><button>Düzenle</button></div>)}</div></section></main>
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
   <p><b>Önemli:</b> Nöbetçi eczane durumu, resmi/güvenilir yapılandırılmış veri kaynağı doğrulanmadan “nöbetçi” olarak gösterilmez.</p>
 </section>
 </main>
}

function Simple({title}:{title:string}){return <main className="simple"><h1>{title}</h1><p>Yanında Türkiye.</p></main>}

export default function TargetApp(){
 return <div><Header/><Routes><Route path="/" element={<Home/>}/><Route path="/nearby" element={<Nearby/>}/><Route path="/services" element={<Services/>}/><Route path="/emergency" element={<Emergency/>}/><Route path="/add-business" element={<AddBusiness/>}/><Route path="/menu" element={<MenuPage/>}/><Route path="/admin" element={<Admin/>}/><Route path="/favorites" element={<Simple title="Favoriler"/>}/><Route path="/news" element={<Simple title="Haberler"/>}/><Route path="/contact" element={<Simple title="İletişim"/>}/><Route path="/kvkk" element={<Legal type="kvkk"/>}/><Route path="/gizlilik" element={<Legal type="privacy"/>}/><Route path="*" element={<Home/>}/></Routes><MobileNav/></div>
}