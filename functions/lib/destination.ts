import {districtMap} from '../../src/turkeyDistricts';
import {trSlug} from '../../src/text';

type Entry={slug:string;label:string;rank:number;province:boolean};
const PRIORITY=['İstanbul','Ankara','İzmir','Bursa','Antalya'];
let index:Entry[]|null=null;

function build():Entry[]{
  const out:Entry[]=[];
  for(const [province,list] of Object.entries(districtMap)){
    const rank=PRIORITY.includes(province)?PRIORITY.indexOf(province):99;
    out.push({slug:trSlug(province),label:province,rank:-1,province:true});
    for(const d of list){
      if(d==='Merkez'||trSlug(d).length<4)continue;
      out.push({slug:trSlug(d),label:d+', '+province,rank,province:false});
    }
  }
  return out;
}
export function resolveDestination(message:string):string|null{
  index??=build();
  const text='-'+trSlug(message)+'-';
  let best:Entry|null=null;
  for(const e of index){
    const maxSuffix=e.province?3:4;
    const re=new RegExp('-'+e.slug+'[a-z]{0,'+maxSuffix+'}(?=-)');
    if(!re.test(text))continue;
    if(!best||e.slug.length>best.slug.length||(e.slug.length===best.slug.length&&(e.province&&!best.province||(e.province===best.province&&e.rank<best.rank))))best=e;
  }
  if(best)return best.label;
  const m=message.match(/^(.*?)\s*(?:['’]?\s*(?:ya|ye|na|ne|a|e)\s+)?nasıl\s+gid/i)||message.match(/yol tarifi\s*(.+)$/i);
  const raw=(m?.[1]||'').replace(/['’](?:ya|ye|na|ne|a|e)$/i,'').replace(/[^\p{L}\p{N}\s.'-]/gu,' ').replace(/\s+/g,' ').trim();
  return raw.length>=3&&raw.length<=80?raw+', Türkiye':null;
}