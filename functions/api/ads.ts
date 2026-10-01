export async function onRequestGet({request,env}:{request:Request;env:{DB?:D1Database}}){
  if(!env.DB)return Response.json({ads:[]});
  try{
    const url=new URL(request.url);
    const placement=(url.searchParams.get('placement')||'home_top').replace(/[^a-z_]/g,'').slice(0,30);
    const rows=await env.DB.prepare("SELECT id,title,text,image_url,target_url,placement FROM ads WHERE status='active' AND placement=? ORDER BY id DESC LIMIT 10").bind(placement).all();
    return Response.json({ads:rows.results||[]},{headers:{'cache-control':'public, max-age=60'}});
  }catch{return Response.json({ads:[]});}
}