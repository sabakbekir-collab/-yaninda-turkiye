export type OpeningHoursDisplay={label:string;value:string};

const days:Record<string,string>={
  Mo:"Pzt",Tu:"Sal",We:"Çar",Th:"Per",Fr:"Cum",Sa:"Cmt",Su:"Paz"
};

function translateDays(value:string):string|null{
  const match=/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(value);
  if(!match)return null;
  return match[2]?days[match[1]]+"-"+days[match[2]]:days[match[1]];
}

/** Converts only known OSM opening_hours syntax; unknown or malformed text is hidden. */
export function formatOpeningHours(raw:string|undefined,category:string):OpeningHoursDisplay|null{
  const source=raw?.trim();
  if(!source)return null;
  if(source==="24/7")return {label:"Açık",value:"24 saat / 7 gün"};

  const clauses=source.split(";").map(part=>part.trim()).filter(Boolean);
  if(!clauses.length)return null;
  const translated:string[]=[];
  for(const clause of clauses){
    if(clause==="PH off"){translated.push("Resmî tatillerde kapalı");continue;}
    const off=/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))? off$/.exec(clause);
    if(off){
      const day=translateDays(off[1]+(off[2]?"-"+off[2]:""));
      if(!day)return null;
      translated.push(day+" kapalı");
      continue;
    }
    const hours=/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))? (\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(clause);
    if(hours){
      const day=translateDays(hours[1]+(hours[2]?"-"+hours[2]:""));
      const validTime=(value:string)=>{const [h,m]=value.split(":").map(Number);return h<=24&&m<=59&&(h!==24||m===0)};
      if(!day||!validTime(hours[3])||!validTime(hours[4]))return null;
      translated.push(day+" "+hours[3]+"-"+hours[4]);
      continue;
    }
    return null;
  }
  if(!translated.length)return null;
  return {label:category.toLowerCase()==="atm"?"Şube saatleri":"Saatler",value:translated.join(" · ")};
}
