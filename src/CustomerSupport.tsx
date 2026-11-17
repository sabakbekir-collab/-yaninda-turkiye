import {useMemo,useState} from 'react';
import {ArrowLeft,ExternalLink,Phone,Search,ShieldAlert} from 'lucide-react';
import {Link} from 'react-router-dom';

type Shortcut={name:string;group:'Operatör'|'Banka'|'Kargo';phone:string;keys?:string;note?:string};
const shortcuts:Shortcut[]=[
{name:'Turkcell',group:'Operatör',phone:'532 532 00 00',keys:'2, 2'},
{name:'Vodafone',group:'Operatör',phone:'542 542 00 00',keys:'1, 0'},
{name:'Türk Telekom',group:'Operatör',phone:'444 1 500',keys:'2, 0'},
{name:'BİMcell',group:'Operatör',phone:'444 4 551',keys:'0'},
{name:'Digiturk',group:'Operatör',phone:'0212 473 73 73',keys:'0'},
{name:'tivibu',group:'Operatör',phone:'444 0 375',keys:'4'},
{name:'PTT',group:'Operatör',phone:'0850 222 17 88',keys:'8, 1'},
{name:'TTNET',group:'Operatör',phone:'444 0 375',keys:'1, 6'},
{name:'Millenicom',group:'Operatör',phone:'0850 333 0 444',keys:'1, 1'},
{name:'Kuveyt Türk',group:'Banka',phone:'444 0 123',keys:'2, 0'},
{name:'Türkiye Finans',group:'Banka',phone:'0850 222 22 44',keys:'0'},
{name:'İş Bankası',group:'Banka',phone:'0850 724 0 724',keys:'0, 6'},
{name:'Akbank',group:'Banka',phone:'444 2 525',keys:'4, 2'},
{name:'DenizBank',group:'Banka',phone:'0850 222 0 800',keys:'0'},
{name:'Garanti BBVA',group:'Banka',phone:'444 0 333',keys:'1, 3, 5'},
{name:'VakıfBank',group:'Banka',phone:'0850 222 0 724',keys:'3, 0'},
{name:'QNB',group:'Banka',phone:'0850 222 2 900',keys:'3, 2, 6, 2'},
{name:'ING',group:'Banka',phone:'0850 222 0 600',keys:'3, 0'},
{name:'Ziraat Bankası',group:'Banka',phone:'444 0 000',keys:'1, 6, 0'},
{name:'HSBC',group:'Banka',phone:'444 0 111',keys:'1, 8, 4'},
{name:'Halkbank',group:'Banka',phone:'0850 222 0 400',keys:'0'},
{name:'Yapı Kredi',group:'Banka',phone:'0850 222 0 444',keys:'2',note:'Görselde, ardından kart şifresi girilmesi gerektiği belirtiliyor.'},
{name:'Şekerbank',group:'Banka',phone:'444 78 78'},
{name:'TEB',group:'Banka',phone:'444 0 666'},
{name:'Enpara',group:'Banka',phone:'0850 222 36 63'},
{name:'Yurtiçi Kargo',group:'Kargo',phone:'444 99 99',keys:'1, 3'},
{name:'Aras Kargo',group:'Kargo',phone:'444 25 52',keys:'6'},
{name:'MNG Kargo',group:'Kargo',phone:'444 06 06',keys:'1, 0'},
{name:'Sürat Kargo',group:'Kargo',phone:'444 0 127'}
];
const groups=['Tümü','Operatör','Banka','Kargo'] as const;
export default function CustomerSupport(){
 const[query,setQuery]=useState('');
 const[group,setGroup]=useState<(typeof groups)[number]>('Tümü');
 const filtered=useMemo(()=>shortcuts.filter(x=>(group==='Tümü'||x.group===group)&&((x.name+' '+x.phone).toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')))),[group,query]);
 return <main className="inner support-page">
  <div className="page-title"><Link to="/" aria-label="Ana sayfa"><ArrowLeft/></Link><div><small>YANINDA TÜRKİYE</small><h1>Müşteri Hizmetleri</h1></div></div>
  <p className="support-lead">Operatör, banka ve kargo firmalarının çağrı merkezlerine hızlı ulaş. Numaraya dokunarak aramayı başlat.</p>
  <div className="support-warning" role="note"><ShieldAlert/><span>Bu liste gönderdiğin görselden aktarılmıştır; numaralar ve tuşlama adımları resmî kaynaklardan henüz doğrulanmamıştır. Aramadan önce ilgili kurumun resmî sitesini kontrol et. Banka işlemlerinde kart şifreni veya SMS doğrulama kodunu kimseyle paylaşma.</span></div>
  <label className="support-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kurum veya telefon ara" /></label>
  <div className="support-filters" role="group" aria-label="Kurum türü">{groups.map(x=><button type="button" key={x} className={group===x?'active':''} onClick={()=>setGroup(x)}>{x}</button>)}</div>
  <p className="support-count">{filtered.length} kurum listeleniyor</p>
  <div className="support-list">{filtered.map(x=><article className="support-card" key={x.name}>
   <div className="support-card-top"><span className="support-category">{x.group}</span><h2>{x.name}</h2></div>
   <a className="support-phone" href={'tel:'+x.phone.replace(/[^0-9+]/g,'')}><Phone/><strong>{x.phone}</strong><span>Ara</span></a>
   {x.keys&&<p className="support-keys">Sesli yanıt tuşlaması: <b>{x.keys}</b></p>}
   {x.note&&<small className="support-note">{x.note}</small>}
  </article>)}</div>
  {!filtered.length&&<p className="support-empty">Aramana uygun kurum bulunamadı.</p>}
  <p className="support-foot">Tuşlama kısayolları her zaman aynı olmayabilir. Bu sayfa kurumların resmî müşteri hizmetleri kanallarının yerine geçmez.</p>
 </main>
}
