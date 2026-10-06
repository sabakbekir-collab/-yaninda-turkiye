import {NavLink,useNavigate} from 'react-router-dom';
import {Heart,Trash2} from 'lucide-react';
import {useFavorites} from './favorites';
import PlaceCard from './PlaceCard';

export default function FavoritesPage(){
  const nav=useNavigate();
  const {list,clear}=useFavorites();
  return <main className="inner nearby-page favorites-page">
    <div className="page-title">
      <button className="back-btn" onClick={()=>nav(-1)} aria-label="Geri">‹</button>
      <div><small>YANINDA TÜRKİYE</small><h1>Favorilerim</h1></div>
    </div>
    {list.length>0&&<div className="fav-toolbar">
      <span>{list.length} kayıtlı yer · Bu cihazda saklanır</span>
      <button type="button" onClick={()=>{if(window.confirm('Tüm favoriler silinsin mi?'))clear()}}><Trash2/>Tümünü Sil</button>
    </div>}
    {list.length===0
      ?<div className="empty nearby-empty"><Heart/><h3>Henüz favorin yok</h3><p>Bir yerin kartındaki “Favori” butonuna basınca burada görünür; internetin zayıf olsa da telefonunu ve adresini bulursun.</p><NavLink to="/nearby" className="empty-link">Yakınımdakileri Bul</NavLink></div>
      :<div className="results">{list.map(p=><PlaceCard key={p.id} p={p}/>)}</div>}
    {list.some(p=>p.category==='pharmacy')&&<p className="fav-note">Not: Kayıtlı eczanelerin nöbet durumu günlük değişir. Nöbetçi olanları görmek için Yakınımda sayfasından yeniden ara.</p>}
  </main>;
}