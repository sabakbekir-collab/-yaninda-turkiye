export type Theme='light'|'dark';
const KEY='yt-theme';

export function getTheme():Theme{
  try{
    const v=localStorage.getItem(KEY);
    if(v==='dark'||v==='light')return v;
  }catch{/* yoksay */}
  return typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
export function applyTheme(theme:Theme){
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#0b1220':'#092d4f');
}
export function saveTheme(theme:Theme){
  try{localStorage.setItem(KEY,theme)}catch{/* yoksay */}
  applyTheme(theme);
}