import {useState} from 'react';
import type {FormEvent} from 'react';
import {Flag,Heart,Navigation,Phone,Share2,ShieldCheck} from 'lucide-react';
import type {Place} from './types';
import {categoryIcon,cleanCardAddress,formatDistance} from './placeUtils';
import {useFavorites} from './favorites';
import {mapsLink,shareText} from './share';
import {track} from './api';

const reasons:[string,string][]=[['wrong_info','Bilgiler yanlış'],['wrong_phone','Telefon yanlış'],['wrong_address','Adres yanlış'],['closed','Kapalı / artık yok']];

export default function PlaceCard({p}:{p:Place}){
  const Icon=categoryIcon(p.category);
  const {has,toggle}=useFavorites();
  const [status,setStatus]=useState('');
  const [reporting,setReporting]=useState(false);
  const [reason,setReason]=useState('wrong_info');
  const [details,setDetails]=useState('');
  const [busy,setBusy]=useState(false);
  const isFav=has(p.id);
  const directions='https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon;
  const onFav=()=>{if(!isFav)track('favorite_click',{category:p.category});toggle(p)};
  const onShare=async()=>{
    const lines=[p.name,cleanCardAddress(p.address)];
    if(p.phone)lines.push('Tel: '+p.phone);
    const r=await shareText(p.name,lines.join('\n'),mapsLink(p.lat,p.lon));
    setStatus(r==='copied'?'Bilgiler panoya kopyalandı.':r==='failed'?'Paylaşılamadı.':'');
  };
  const onReport=async(e:FormEvent)=>{
    e.preventDefault();if(busy)return;setBusy(true);setStatus('');
    try{
      const r=await fetch('/api/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({placeId:p.id,placeName:p.name,reason,details})});
      if(r.ok){setStatus('Bildirimin alındı, teşekkürler.');setReporting(false);setDetails('')}
      else if(r.status===429)setStatus('Çok fazla bildirim gönderdin. Biraz sonra tekrar dene.');
      else setStatus('Bildirim gönderilemedi. Lütfen tekrar dene.');
    }catch{setStatus('Bağlantı kurulamadı.')}finally{setBusy(false)}
  };
  return <article className={'place nearby-place-card'+(p.isDuty?' duty-place':'')}>
    <div className="place-icon category-place-icon"><Icon/></div>
    <div className="place-body">
      <div className="place-title-row"><h3>{p.name?.trim()||'İşletme adı bulunamadı'}</h3>{p.isDuty&&<span className="duty-badge">NÖBETÇİ</span>}</div>
      <p>{cleanCardAddress(p.address)}</p>
      <small className="place-meta-line">{typeof p.distance==='number'&&<><Navigation/> <b>{formatDistance(p.distance)}</b> · Kuş uçuşu · </>}<ShieldCheck/> {p.source}</small>
      {p.district&&<small className="place-district">İlçe: {p.district}</small>}
      {p.isDuty&&<small className="place-source-note">Veri: Eczane Adresi · Gitmeden telefonla teyit et</small>}
      {p.openingHours&&<small className="place-district">Saatler: {p.openingHours}</small>}
      <footer>
        {p.phone?<a href={'tel:'+p.phone} onClick={()=>track('phone_click',{category:p.category})}><Phone/>Ara</a>:<span className="no-phone">Telefon bilgisi yok</span>}
        <a target="_blank" rel="noreferrer" href={directions} onClick={()=>track('directions_click',{category:p.category})}><Navigation/>Yol Tarifi</a>
        <button type="button" className={isFav?'fav-on':''} aria-pressed={isFav} onClick={onFav}><Heart/>{isFav?'Favoride':'Favori'}</button>
      </footer>
      <div className="place-extra-actions">
        <button type="button" onClick={onShare}><Share2/>Paylaş</button>
        <button type="button" onClick={()=>setReporting(v=>!v)} aria-expanded={reporting}><Flag/>Hatalı bilgi bildir</button>
      </div>
      {reporting&&<form className="report-form" onSubmit={onReport}>
        <label>Sorun nedir?<select value={reason} onChange={e=>setReason(e.target.value)}>{reasons.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Ayrıntı (isteğe bağlı)<textarea value={details} maxLength={500} onChange={e=>setDetails(e.target.value)} placeholder="Doğru bilgi neydi?"/></label>
        <button type="submit" disabled={busy}>{busy?'Gönderiliyor…':'Bildirimi Gönder'}</button>
      </form>}
      {status&&<small className="place-status" role="status">{status}</small>}
    </div>
  </article>;
}