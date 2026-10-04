import {useState} from "react";
import {Bot,Send} from "lucide-react";

export default function AdminAI(){
 const [message,setMessage]=useState(""),[reply,setReply]=useState(""),[loading,setLoading]=useState(false);
 async function send(){
  const text=message.trim();if(!text||loading)return;setLoading(true);setReply("");
  try{const r=await fetch("/api/admin/ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:text})});const d=await r.json().catch(()=>({}));setReply(typeof d.reply==="string"?d.reply:"İstek işlenemedi.")}catch{setReply("Bağlantı kurulamadı.")}finally{setLoading(false)}
 }
 return <div className="panel admin-ai"><div className="panel-title"><div><h2><Bot/> Yanımda AI Yönetici Asistanı</h2><p>Admin panelinde teknik ve yönetim desteği alın.</p></div></div>{reply&&<div className="admin-ai-reply">{reply}</div>}<form onSubmit={e=>{e.preventDefault();send()}}><input value={message} onChange={e=>setMessage(e.target.value)} maxLength={500} placeholder="Örn. Sitede AI botunu nasıl kontrol ederim?"/><button disabled={loading||!message.trim()}><Send/>{loading?"Gönderiliyor":"Sor"}</button></form></div>
}
