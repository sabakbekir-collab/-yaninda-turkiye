import {useEffect,useRef,useState} from "react";
import {MessageCircle,Send,X,LocateFixed,Navigation} from "lucide-react";
import {getCurrentLocation,getLocationPermissionState,LocationError} from "./location";
import "./chat.css";
import {track} from "./api";

type Msg={role:"user"|"assistant";content:string};
type Place={name:string;address?:string;phone?:string;lat?:number;lon?:number;distance?:number;isDuty?:boolean};
type Reply={reply?:string;places?:Place[];route?:{url:string;label:string}};
type SelectedArea={province?:string;district?:string};
function readSelectedArea():SelectedArea{try{const value=JSON.parse(localStorage.getItem("yt-nearby-selection-v5")||"{}") as SelectedArea;return {province:typeof value.province==="string"?value.province:"",district:typeof value.district==="string"?value.district:""};}catch{return {};}}
const distanceText=(km?:number)=>typeof km==="number"&&Number.isFinite(km)?(km<1?Math.round(km*1000)+" m":new Intl.NumberFormat("tr-TR",{maximumFractionDigits:1}).format(km)+" km"):"";

export default function ChatWidget(){
 const [open,setOpen]=useState(false),[input,setInput]=useState(""),[loading,setLoading]=useState(false),[location,setLocation]=useState<{lat:number;lon:number}>();
 const [locationBusy,setLocationBusy]=useState(false),[locationError,setLocationError]=useState("");
 const [messages,setMessages]=useState<Msg[]>([{role:"assistant",content:"Merhaba 👋 Ben Yanımda AI. Seçtiğin il ve ilçedeki hizmetleri bulabilir, yol tarifi konusunda yardımcı olabilir ve site içinde seni doğru yere yönlendirebilirim. Konum izni vermen gerekmez. Örneğin “Beyoğlu'na nasıl gidilir?” veya “yakınımdaki nöbetçi eczaneyi bul” diyebilirsin."}]);
 const [results,setResults]=useState<Place[]>([]);
 const [route,setRoute]=useState<Reply["route"]>();
 const end=useRef<HTMLDivElement>(null);

 useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[messages,loading]);

 async function ensureLocation(){
  if(location)return location;
  setLocationBusy(true);setLocationError("");
  try{
   const current=await getCurrentLocation({forceFresh:true});
   setLocation(current);
   return current;
  }catch(error){
   const code=error instanceof LocationError?error.code:"unknown";
   if(code==="permission_denied")track("location_permission",{result:"denied",source:"ai"});
   setLocationError(
    code==="permission_denied"
     ?"Konum izni reddedildi. iPhone Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri → Safari bölümünü kontrol et."
     :code==="timeout"
      ?"Konum isteği zaman aşımına uğradı. Açık alanda tekrar dene veya il/ilçe seç."
      :code==="unavailable"
       ?"GPS kapalı veya cihaz konumu alınamıyor. Konum Servisleri'ni aç ya da il/ilçe seç."
       :"Konum hizmeti kullanılamıyor. İl/ilçe seçerek devam edebilirsin."
   );
   return undefined;
  }finally{setLocationBusy(false)}
 }

 async function send(){
  const text=input.trim();if(!text||loading)return;
  track("ai_message",{message_count:messages.filter(m=>m.role==="user").length+1,topic:text.slice(0,60)});
  setInput("");setResults([]);setRoute(undefined);setLocationError("");
  const next=[...messages,{role:"user" as const,content:text}].slice(-12);
  setMessages(m=>[...m,{role:"user",content:text}]);setLoading(true);
  try{
   // Manual area remains the default. For nearby queries, silently reuse GPS
   // only when permission is already granted; never trigger a permission prompt.
   const area=readSelectedArea();
   const asksNearby=/yakınım|yakınımd|en yakın|çevremde|civarımda/i.test(text);
   let currentLocation=location;
   if(asksNearby&&!currentLocation){
    try{
     if(await getLocationPermissionState()==="granted")currentLocation=await ensureLocation();
    }catch{/* Manual province/district search remains available. */}
   }
   const r=await fetch("/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:next,location:currentLocation,area})});
   const d=await r.json().catch(()=>({})) as Reply;
   setMessages(m=>[...m,{role:"assistant",content:typeof d.reply==="string"?d.reply:"Şu anda cevap veremiyorum. Lütfen tekrar deneyin."}]);
   if(Array.isArray(d.places))setResults(d.places);
   if(d.route)setRoute(d.route);
  }catch{
   setMessages(m=>[...m,{role:"assistant",content:"Bağlantı kurulamadı. Lütfen tekrar deneyin."}]);
  }finally{setLoading(false)}
 }

 const useLocation=()=>{void ensureLocation()};

 return <>
  <button className="yai-launcher" onClick={()=>{if(!open)track("ai_open");setOpen(true)}} aria-label="Yanımda AI"><MessageCircle/><span>Yanımda AI</span></button>
  {open&&<div className="yai-overlay" onClick={()=>setOpen(false)}>
   <section className="yai-panel" onClick={e=>e.stopPropagation()}>
    <header><div><b>Yanımda AI</b><small>Konum, hizmet ve yol tarifi yardımcın</small></div><button onClick={()=>setOpen(false)} aria-label="Kapat"><X/></button></header>
    <div className="yai-messages">
     {messages.map((m,i)=><div key={i} className={"yai-msg "+m.role}><div>{m.content}</div></div>)}
     {results.length>0&&<div className="yai-results">{results.map((p,i)=><div className="yai-place" key={p.name+"-"+i}><b>{p.name}</b>{p.isDuty&&<em>NÖBETÇİ</em>}<small>{p.address||"Adres bilgisi yok"} {distanceText(p.distance)&&"• "+distanceText(p.distance)}</small><div>{p.phone&&<a href={"tel:"+p.phone}>Ara</a>} {p.lat&&p.lon&&<a target="_blank" rel="noreferrer" href={"https://www.google.com/maps/dir/?api=1&destination="+p.lat+","+p.lon}>Yol Tarifi</a>}</div></div>)}</div>}
     {route&&<a className="yai-route" target="_blank" rel="noreferrer" href={route.url}>🧭 {route.label}</a>}
     {loading&&<div className="yai-msg assistant"><div className="yai-typing">Yanıt hazırlıyor…</div></div>}
     <div ref={end}/>
    </div>
    {locationError&&<div className="yai-location-error">{locationError}</div>}
    <div className="yai-quick">
      <button onClick={useLocation} disabled={locationBusy}><LocateFixed/> {locationBusy?"Konum alınıyor…":location?"Konum hazır":"Konumumu kullan"}</button>
      <button onClick={()=>setInput("Beyoğlu'na nasıl gidilir?")}><Navigation/> Beyoğlu'na nasıl gidilir?</button>
      <button onClick={()=>setInput("Yakınımdaki nöbetçi eczaneyi bul")}>💊 Nöbetçi eczane</button>
    </div>
    <form className="yai-input" onSubmit={e=>{e.preventDefault();send()}}><textarea value={input} maxLength={500} onChange={e=>setInput(e.target.value)} placeholder="Örn. Beyoğlu'na nasıl gidilir?"/><button disabled={loading||!input.trim()}><Send/></button></form>
   </section>
  </div>}
 </>
}
