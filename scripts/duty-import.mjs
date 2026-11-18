#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
/* global process, console */
const input = process.argv[2];
if (!input) { console.error('Kullanım: node scripts/duty-import.mjs <dosya.csv> [çıktı.sql]'); process.exit(2); }
const csv = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
const lines = csv.trim().split(/\r?\n/);
const headers = lines.shift().split(',').map(x=>x.trim().toLocaleLowerCase('tr-TR'));
const required=['il','ilce','ad','telefon','adres','tarih'];
if (required.some(h=>!headers.includes(h))) { console.error('CSV başlıkları eksik. Beklenen: '+required.join(',')); process.exit(2); }
function parseRow(line) {
  const cells=[]; let cell='', quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i]; if(c==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;} else if(c===','&&!quoted){cells.push(cell);cell='';}else cell+=c;}
  cells.push(cell); return Object.fromEntries(headers.map((h,i)=>[h,(cells[i]||'').trim()]));
}
const provinces=['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkâri','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'];
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/İ/g,'I').toLocaleLowerCase('tr-TR').trim();
const escape=s=>"'"+s.replace(/'/g,"''")+"'";
const valid=[];
let rejected=0;
for(const line of lines){if(!line.trim())continue;const r=parseRow(line);const p=provinces.find(x=>normalize(x)===normalize(r.il));const date=r.tarih;
  if(!p||!r.ilce||r.ilce.length>80||!r.ad||r.ad.length>160||!r.adres||r.adres.length>400||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\+?[0-9() .-]{7,24}$/.test(r.telefon)){rejected++;continue;}
  valid.push({...r,il:p,telefon:r.telefon.replace(/[^0-9+]/g,'')});
}
const statements=valid.map(r=>`INSERT INTO duty_pharmacies(duty_date,province,district,name,phone,address,source,fetched_at) VALUES(${escape(r.tarih)},${escape(r.il)},${escape(r.ilce)},${escape(r.ad)},${escape(r.telefon)},${escape(r.adres)},'manual-csv',CURRENT_TIMESTAMP) ON CONFLICT(duty_date,province,district,name) DO UPDATE SET phone=excluded.phone,address=excluded.address,source=excluded.source,fetched_at=excluded.fetched_at;`);
const out=process.argv[3]||path.resolve(process.cwd(),'duty-import-output.sql');
fs.writeFileSync(out,`-- Generated local import only. Review and manually apply. Valid rows: ${valid.length}; rejected: ${rejected}\n${statements.join('\n')}\n`);
console.log(`SQL generated locally. Valid rows: ${valid.length}; rejected: ${rejected}. No database connection or write was performed.`);
