export type OpeningHoursDisplay={label:string;value:string};

const days:Record<string,string>={
  Mo:"Pzt",Tu:"Sal",We:"Çar",Th:"Per",Fr:"Cum",Sa:"Cmt",Su:"Paz"
};
const dayToken="(?:Mo|Tu|We|Th|Fr|Sa|Su)";
const timeToken="(?:[01]\\d|2[0-4]):[0-5]\\d";

function translateDaySpec(value:string):string|null{
  const parts=value.split(",");
  if(!parts.length)return null;
  const translated:string[]=[];
  for(const part of parts){
    const match=new RegExp("^("+dayToken+")(?:-("+dayToken+"))?$").exec(part);
    if(!match)return null;
    translated.push(match[2]?days[match[1]]+"-"+days[match[2]]:days[match[1]]);
  }
  return translated.join(", ");
}

function validTime(value:string):boolean{
  const match=/^(\d{2}):(\d{2})$/.exec(value);
  if(!match)return false;
  const hours=Number(match[1]),minutes=Number(match[2]);
  return hours<=24&&minutes<=59&&(hours!==24||minutes===0);
}

function translateIntervals(value:string):string|null{
  const intervals=value.split(",").map(part=>part.trim());
  if(!intervals.length)return null;
  const translated:string[]=[];
  for(const interval of intervals){
    const match=new RegExp("^("+timeToken+")-("+timeToken+")$").exec(interval);
    if(!match||!validTime(match[1])||!validTime(match[2]))return null;
    translated.push(match[1]+"-"+match[2]);
  }
  return translated.join(", ");
}

/**
 * Translates the supported subset of OSM opening_hours syntax.
 * Unsupported clauses are omitted; if any clause is omitted, the result
 * explicitly warns that the displayed schedule may be incomplete.
 */
export function formatOpeningHours(raw:string|undefined,category:string):OpeningHoursDisplay|null{
  const source=raw?.trim();
  if(!source)return null;
  if(source==="24/7")return {label:"Açık",value:"24 saat / 7 gün"};

  const clauses=source.split(/[;\r\n]+/).map(part=>part.trim()).filter(Boolean);
  const translated:string[]=[];
  let skipped=false;

  for(const clause of clauses){
    if(clause==="24/7"){
      translated.push("24 saat / 7 gün");
      continue;
    }
    if(clause==="PH off"){
      translated.push("Resmî tatillerde kapalı");
      continue;
    }
    if(clause==="PH eve off"){
      translated.push("Resmî tatil arifesi kapalı");
      continue;
    }
    const holidayEve=/^PH eve\s+(.+)$/.exec(clause);
    if(holidayEve){
      const intervals=translateIntervals(holidayEve[1]);
      if(intervals)translated.push("Resmî tatil arifesi "+intervals);
      else skipped=true;
      continue;
    }

    const dayRule=new RegExp("^("+dayToken+"(?:-"+dayToken+")?(?:,"+dayToken+"(?:-"+dayToken+")?)*)\\s+(.+)$").exec(clause);
    if(!dayRule){skipped=true;continue;}
    const day=translateDaySpec(dayRule[1]);
    if(!day){skipped=true;continue;}
    if(dayRule[2]==="off"){
      translated.push(day+" kapalı");
      continue;
    }
    const intervals=translateIntervals(dayRule[2]);
    if(!intervals){skipped=true;continue;}
    translated.push(day+" "+intervals);
  }

  if(!translated.length)return null;
  if(skipped)translated.push("Saatler eksik olabilir");
  return {
    label:category.toLowerCase()==="atm"?"Şube saatleri":"Saatler",
    value:translated.join(" · ")
  };
}
