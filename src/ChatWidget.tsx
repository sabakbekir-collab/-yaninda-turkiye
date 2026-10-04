import {useEffect,useRef,useState} from "react";
import {MessageCircle,Send,X,Mic,Volume2} from "lucide-react";
import "./chat.css";

type Msg={role:"user"|"assistant";content:string};
export default function ChatWidget(){
 const [open,setOpen]=useState(false),[input,setInput]=useState(""),[loading,setLoading]=useState(false);
 const [messages,setMessages]=useState<Msg[]>([{role:"assistant",content:"Merhaba 👋 Ben Yanımda AI. Yakınınızdaki işletme ve hizmetleri bulmanıza ve Yanımda Türkiye'yi kullanmanıza yardımcı olabilirim. Nasıl yardımcı olabilirim?"}]);
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[messages,loading]);
 async function send(){
  const text=input.trim();if(!text||loading)return;
  setInput("");setMessages(m=>[...m,{role:"user",content:text}]);setLoading(true);
  try{
   const r=await fetch("/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:[...messages,{role:"user",content:text}].slice(-12)})});
   const d=await r.json().catch(()=>({}));
   setMessages(m=>[...m,{role:"assistant",content:typeof d.reply==="string"?d.reply:"Şu anda cevap veremiyorum. Lütfen tekrar deneyin."}]);
  }catch{setMessages(m=>[...m,{role:"assistant",content:"Bağlantı kurulamadı. Lütfen tekrar deneyin."}])}
  finally{setLoading(false)}
 }
 return <>
  <button className="yai-launcher" onClick={()=>setOpen(true)} aria-label="Yanımda AI"><MessageCircle/><span>Yanımda AI</span></button>
  {open&&<div className="yai-overlay" onClick={()=>setOpen(false)}>
   <section className="yai-panel" onClick={e=>e.stopPropagation()}>
    <header><div><b>Yanımda AI</b><small>Canlı yapay zekâ yardımcısı</small></div><button onClick={()=>setOpen(false)} aria-label="Kapat"><X/></button></header>
    <div className="yai-messages">{messages.map((m,i)=><div key={i} className={"yai-msg "+m.role}><div>{m.content}</div></div>)}{loading&&<div className="yai-msg assistant"><div className="yai-typing">Yazıyor…</div></div>}<div ref={end}/></div>
    <div className="yai-quick"><button onClick={()=>setInput("Yakınımda ne var?")}>📍 Yakınımda ne var?</button><button onClick={()=>setInput("Nöbetçi eczane bul")}>💊 Nöbetçi eczane</button></div>
    <form className="yai-input" onSubmit={e=>{e.preventDefault();send()}}><textarea value={input} maxLength={500} onChange={e=>setInput(e.target.value)} placeholder="Mesajınızı yazın..." rows={1}/><button disabled={loading||!input.trim()}><Send/></button></form>
   </section>
  </div>}
 </>
}
