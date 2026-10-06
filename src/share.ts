import {Share} from '@capacitor/share';

export type ShareResult='shared'|'copied'|'cancelled'|'failed';

export const mapsLink=(lat:number,lon:number)=>'https://www.google.com/maps/search/?api=1&query='+lat+','+lon;

export async function shareText(title:string,text:string,url?:string):Promise<ShareResult>{
  try{
    if(typeof navigator.share==='function'){
      await navigator.share(url?{title,text,url}:{title,text});
      return 'shared';
    }
    const can=await Share.canShare();
    if(can.value){
      await Share.share(url?{title,text,url}:{title,text});
      return 'shared';
    }
  }catch(e){
    const name=e instanceof Error?e.name+' '+e.message:'';
    if(/abort|cancel/i.test(name))return 'cancelled';
  }
  try{
    await navigator.clipboard.writeText(url?text+'\n'+url:text);
    return 'copied';
  }catch{return 'failed'}
}