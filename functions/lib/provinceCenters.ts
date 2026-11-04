// Province-wide searches must use the provincial capital, not the polygon's geographic centroid.
const fold=(v:string)=>v.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');

const CENTERS:Array<[string,number,number]>=[
  ['Adana',37.0000,35.3213],['Adıyaman',37.7648,38.2786],['Afyonkarahisar',38.7507,30.5567],['Ağrı',39.7191,43.0503],
  ['Amasya',40.6499,35.8353],['Ankara',39.9334,32.8597],['Antalya',36.8969,30.7133],['Artvin',41.1828,41.8183],
  ['Aydın',37.8560,27.8416],['Balıkesir',39.6484,27.8826],['Bilecik',40.1451,29.9799],['Bingöl',38.8855,40.4980],
  ['Bitlis',38.4006,42.1095],['Bolu',40.7395,31.6116],['Burdur',37.7203,30.2908],['Bursa',40.1826,29.0665],
  ['Çanakkale',40.1553,26.4142],['Çankırı',40.6013,33.6134],['Çorum',40.5506,34.9556],['Denizli',37.7765,29.0864],
  ['Diyarbakır',37.9144,40.2306],['Edirne',41.6818,26.5623],['Elazığ',38.6810,39.2264],['Erzincan',39.7500,39.5000],
  ['Erzurum',39.9043,41.2679],['Eskişehir',39.7667,30.5256],['Gaziantep',37.0662,37.3833],['Giresun',40.9128,38.3895],
  ['Gümüşhane',40.4603,39.4814],['Hakkâri',37.5744,43.7408],['Hatay',36.2025,36.1606],['Isparta',37.7648,30.5566],
  ['Mersin',36.8121,34.6415],['İstanbul',41.0082,28.9784],['İzmir',38.4237,27.1428],['Kars',40.6013,43.0975],
  ['Kastamonu',41.3887,33.7827],['Kayseri',38.7312,35.4787],['Kırklareli',41.7355,27.2253],['Kırşehir',39.1425,34.1709],
  ['Kocaeli',40.7654,29.9408],['Konya',37.8746,32.4932],['Kütahya',39.4167,29.9833],['Malatya',38.3552,38.3095],
  ['Manisa',38.6191,27.4289],['Kahramanmaraş',37.5858,36.9371],['Mardin',37.3212,40.7245],['Muğla',37.2153,28.3636],
  ['Muş',38.7432,41.5064],['Nevşehir',38.6939,34.6857],['Niğde',37.9667,34.6833],['Ordu',40.9839,37.8764],
  ['Rize',41.0201,40.5234],['Sakarya',40.7889,30.4053],['Samsun',41.2867,36.3300],['Siirt',37.9333,41.9500],
  ['Sinop',42.0231,35.1531],['Sivas',39.7477,37.0179],['Tekirdağ',40.9833,27.5167],['Tokat',40.3167,36.5500],
  ['Trabzon',41.0027,39.7168],['Tunceli',39.1079,39.5401],['Şanlıurfa',37.1591,38.7969],['Uşak',38.6823,29.4082],
  ['Van',38.4891,43.4089],['Yozgat',39.8181,34.8147],['Zonguldak',41.4564,31.7987],['Aksaray',38.3687,34.0370],
  ['Bayburt',40.2552,40.2249],['Karaman',37.1759,33.2287],['Kırıkkale',39.8468,33.5153],['Batman',37.8812,41.1351],
  ['Şırnak',37.5164,42.4611],['Bartın',41.6344,32.3375],['Ardahan',41.1105,42.7022],['Iğdır',39.9237,44.0450],
  ['Yalova',40.6500,29.2667],['Karabük',41.2061,32.6204],['Kilis',36.7184,37.1212],['Osmaniye',37.0742,36.2478],
  ['Düzce',40.8438,31.1565],
];
const BY_KEY=new Map<string,{lat:number;lon:number}>(CENTERS.map(([n,lat,lon])=>[fold(n),{lat,lon}]));
for(const [alias,name] of [['afyon','Afyonkarahisar'],['hakkari','Hakkâri'],['icel','Mersin'],['maras','Kahramanmaraş'],['antep','Gaziantep'],['urfa','Şanlıurfa'],['izmit','Kocaeli'],['adapazari','Sakarya']] as const){
  const hit=BY_KEY.get(fold(name));if(hit&&!BY_KEY.has(alias))BY_KEY.set(alias,hit);
}
/** City-centre coordinates of a province, or null if the name is unknown. */
export function provinceCenter(province:string):{lat:number;lon:number}|null{
  return BY_KEY.get(fold(province))??null;
}
/** True when the district field means the whole province / central district. */
export function isWholeProvince(district:string,province:string):boolean{
  const d=fold(district);
  return !d||d==='merkez'||d==='tumilceler'||d===fold(province);
}
