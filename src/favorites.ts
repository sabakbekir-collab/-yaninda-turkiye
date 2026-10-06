import {useCallback,useEffect,useState} from 'react';
import type {Place} from './types';

const KEY='yt-favorites-v1';

function read():Place[]{
  try{
    const v:unknown=JSON.parse(localStorage.getItem(KEY)||'[]');
    if(!Array.isArray(v))return [];
    return v.filter((p):p is Place=>Boolean(p)&&typeof p.id==='string'&&typeof p.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  }catch{return []}
}
function write(list:Place[]){
  try{
    localStorage.setItem(KEY,JSON.stringify(list.slice(0,100)));
    window.dispatchEvent(new Event('yt-favorites'));
  }catch{/* depolama kapalıysa sessizce geç */}
}
function snapshot(p:Place):Place{
  return {...p,isDuty:false,distance:undefined,verifiedAt:undefined,dutyUpdatedAt:undefined,source:p.isDuty?'Kayıtlı eczane':p.source};
}
export function useFavorites(){
  const [list,setList]=useState<Place[]>(read);
  useEffect(()=>{
    const refresh=()=>setList(read());
    window.addEventListener('yt-favorites',refresh);
    window.addEventListener('storage',refresh);
    return()=>{window.removeEventListener('yt-favorites',refresh);window.removeEventListener('storage',refresh)};
  },[]);
  const has=useCallback((id:string)=>list.some(p=>p.id===id),[list]);
  const toggle=useCallback((p:Place)=>{
    const cur=read();
    write(cur.some(x=>x.id===p.id)?cur.filter(x=>x.id!==p.id):[snapshot(p),...cur]);
  },[]);
  const clear=useCallback(()=>write([]),[]);
  return {list,has,toggle,clear};
}