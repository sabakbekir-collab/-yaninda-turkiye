import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Clock3,Sunrise} from 'lucide-react';
type DayEvent={date:string;title:string;detail:string;kind:'milli'|'dini'|'resmi'|'farkindalik'};
const events:DayEvent[]=[
['2026-01-01','Yılbaşı','Resmî tatil','resmi'],['2026-03-08','Dünya Kadınlar Günü','Önemli gün','farkindalik'],['2026-03-18','Çanakkale Zaferi ve Şehitleri Anma Günü','Millî gün','milli'],['2026-03-20','Ramazan Bayramı 1. gün','Resmî tatil','dini'],['2026-03-21','Ramazan Bayramı 2. gün','Resmî tatil','dini'],['2026-03-22','Ramazan Bayramı 3. gün','Resmî tatil','dini'],['2026-04-23','23 Nisan Ulusal Egemenlik ve Çocuk Bayramı','Resmî tatil','milli'],['2026-05-01','Emek ve Dayanışma Günü','Resmî tatil','resmi'],['2026-05-19','Atatürk’ü Anma, Gençlik ve Spor Bayramı','Resmî tatil','milli'],['2026-05-27','Kurban Bayramı 1. gün','Resmî tatil','dini'],['2026-05-28','Kurban Bayramı 2. gün','Resmî tatil','dini'],['2026-05-29','Kurban Bayramı 3. gün','Resmî tatil','dini'],['2026-05-30','Kurban Bayramı 4. gün','Resmî tatil','dini'],['2026-06-05','Dünya Çevre Günü','Önemli gün','farkindalik'],['2026-07-15','Demokrasi ve Millî Birlik Günü','Resmî tatil','milli'],['2026-08-30','Zafer Bayramı','Resmî tatil','milli'],['2026-09-19','Gaziler Günü','Millî gün','milli'],['2026-10-29','Cumhuriyet Bayramı','Resmî tatil','milli'],['2026-11-10','Atatürk’ü Anma Günü · 09.05','Anma günü','milli'],['2026-12-03','Dünya Engelliler Günü','Önemli gün','farkindalik'],['2026-12-10','Dünya İnsan Hakları Günü','Önemli gün','farkindalik'],['2027-01-01','Yılbaşı','Resmî tatil','resmi'],['2027-04-23','23 Nisan Ulusal Egemenlik ve Çocuk Bayramı','Resmî tatil','milli'],['2027-05-01','Emek ve Dayanışma Günü','Resmî tatil','resmi'],['2027-05-19','Atatürk’ü Anma, Gençlik ve Spor Bayramı','Resmî tatil','milli'],['2027-07-15','Demokrasi ve Millî Birlik Günü','Resmî tatil','milli'],['2027-08-30','Zafer Bayramı','Resmî tatil','milli'],['2027-10-29','Cumhuriyet Bayramı','Resmî tatil','milli']
].map(([date,title,detail,kind])=>({date,title,detail,kind} as DayEvent));
const pad=(n:number)=>String(n).padStart(2,'0');
const key=(d:Date)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const fmt=(s:string,o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('tr-TR',o).format(new Date(s+'T12:00:00'));
export default function CalendarPage(){
 const now=new Date();const[clock,setClock]=useState(new Date());const[month,setMonth]=useState(new Date(now.getFullYear(),now.getMonth(),1));const[selected,setSelected]=useState(key(now));
 useEffect(()=>{const t=window.setInterval(()=>setClock(new Date()),1000);return()=>window.clearInterval(t)},[]);
 const cells=useMemo(()=>{const offset=(new Date(month.getFullYear(),month.getMonth(),1).getDay()+6)%7;const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();const total=Math.ceil((offset+count)/7)*7;return Array.from({length:total},(_,i)=>{const d=new Date(month.getFullYear(),month.getMonth(),i-offset+1);return{d,value:key(d),inside:d.getMonth()===month.getMonth()}})},[month]);
 const title=new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(month);
 const selectedEvents=events.filter(e=>e.date===selected);
 const upcoming=events.filter(e=>e.date>=key(now)).slice(0,3);
 const choose=(date:string)=>{setSelected(date);const d=new Date(date+'T12:00:00');setMonth(new Date(d.getFullYear(),d.getMonth(),1))};
 return <main className="inner calendar-page calendar-compact">
  <header className="calendar-mini-head"><div className="calendar-mini-icon"><CalendarDays/></div><div><small>YANINDA TÜRKİYE</small><h1>Takvim</h1></div><span className="calendar-live"><i/> CANLI SAAT</span></header>
  <section className="calendar-digital"><div className="calendar-digital-top"><span><Clock3/> TÜRKİYE SAATİ</span><span>{new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Istanbul'}).format(clock)}</span></div><strong>{new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'Europe/Istanbul'}).format(clock)}</strong><div className="calendar-digital-bottom"><Sunrise/><span>{new Intl.DateTimeFormat('tr-TR',{year:'numeric',timeZone:'Europe/Istanbul'}).format(clock)} · Yerel saat</span><b>Europe / Istanbul</b></div></section>
  <section className="calendar-mini-panel"><div className="calendar-month-head"><button aria-label="Önceki ay" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><h2>{title}</h2><button aria-label="Sonraki ay" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button><button className="calendar-today" onClick={()=>choose(key(now))}>Bugün</button></div>
   <div className="calendar-grid calendar-weekdays">{['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(x=><span key={x}>{x}</span>)}</div>
   <div className="calendar-grid">{cells.map(c=>{const ev=events.some(e=>e.date===c.value);return <button key={c.value} className={'calendar-day'+(!c.inside?' outside':'')+(selected===c.value?' selected':'')+(c.value===key(now)?' today':'')} onClick={()=>setSelected(c.value)}><span>{c.d.getDate()}</span>{ev&&<i className="event-dot"/>}</button>})}</div>
   <div className="calendar-mini-legend"><i/> Önemli gün / resmî tatil</div>
  </section>
  <section className="calendar-mini-events"><div className="calendar-mini-title"><div><small>SEÇİLİ TARİH</small><h2>{fmt(selected,{day:'numeric',month:'long'})}</h2></div><span>{selectedEvents.length} kayıt</span></div>
   {selectedEvents.length?selectedEvents.map(e=><article key={e.date+e.title}><i className={'calendar-kind '+e.kind}/><div><b>{e.title}</b><small>{e.detail}</small></div></article>):<p className="calendar-mini-empty">Bu tarihte kayıtlı önemli gün yok.</p>}
  </section>
  <section className="calendar-mini-events calendar-next"><div className="calendar-mini-title"><div><small>TAKVİMİNDE</small><h2>Yaklaşan günler</h2></div><span>İlk 3</span></div>
   {upcoming.map(e=><button key={e.date+e.title} onClick={()=>choose(e.date)}><time>{fmt(e.date,{day:'2-digit',month:'short'})}</time><b>{e.title}</b><ChevronRight/></button>)}
  </section>
  <p className="calendar-mini-note">Önemli gün ve tatil tarihleri bilgilendirme amaçlıdır; resmî duyuruları kontrol et.</p>
 </main>;
}