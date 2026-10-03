/**
 * Türkiye il/ilçe referans listesi.
 * İlçe adları, 81 il / 973 ilçe yapısını temsil eden açık veri listesinden alınmıştır.
 * Uygulama bunları tamamen offline kullanır; ilçe seçimi için API çağrısı gerekmez.
 */
import { trSlug } from './text';

export const districtMap: Record<string, string[]> = {
Adana:['Seyhan','Ceyhan','Feke','Karaisalı','Karataş','Kozan','Pozantı','Saimbeyli','Tufanbeyli','Yumurtalık','Yüreğir','Aladağ','İmamoğlu','Sarıçam','Çukurova'],
Adıyaman:['Merkez','Besni','Çelikhan','Gerger','Gölbaşı','Kahta','Samsat','Sincik','Tut'],
Afyonkarahisar:['Merkez','Bolvadin','Çay','Dazkırı','Dinar','Emirdağ','İhsaniye','Sandıklı','Sinanpaşa','Sultandağı','Şuhut','Başmakçı','Bayat','İscehisar','Çobanlar','Evciler','Hocalar','Kızılören'],
Ağrı:['Merkez','Diyadin','Doğubayazıt','Eleşkirt','Hamur','Patnos','Taşlıçay','Tutak'],
Aksaray:['Merkez','Ortaköy','Ağaçören','Güzelyurt','Sarıyahşi','Eskil','Gülağaç','Sultanhanı'],
Amasya:['Merkez','Göynücek','Gümüşhacıköy','Merzifon','Suluova','Taşova','Hamamözü'],
Ankara:['Altındağ','Ayaş','Bala','Beypazarı','Çamlıdere','Çankaya','Çubuk','Elmadağ','Güdül','Haymana','Kalecik','Kızılcahamam','Nallıhan','Polatlı','Şereflikoçhisar','Yenimahalle','Gölbaşı','Keçiören','Mamak','Sincan','Kahramankazan','Akyurt','Etimesgut','Evren','Pursaklar'],
Antalya:['Akseki','Alanya','Elmalı','Finike','Gazipaşa','Gündoğmuş','Kaş','Korkuteli','Kumluca','Manavgat','Serik','Demre','İbradı','Kemer','Aksu','Döşemealtı','Kepez','Konyaaltı','Muratpaşa'],
Ardahan:['Merkez','Çıldır','Göle','Hanak','Posof','Damal'],
Artvin:['Ardanuç','Arhavi','Merkez','Borçka','Hopa','Şavşat','Yusufeli','Murgul','Kemalpaşa'],
Aydın:['Bozdoğan','Çine','Germencik','Karacasu','Koçarlı','Kuşadası','Kuyucak','Nazilli','Söke','Sultanhisar','Yenipazar','Buharkent','İncirliova','Karpuzlu','Köşk','Didim','Efeler'],
Balıkesir:['Ayvalık','Balya','Bandırma','Bigadiç','Burhaniye','Dursunbey','Edremit','Erdek','Gönen','Havran','İvrindi','Kepsut','Manyas','Savaştepe','Sındırgı','Susurluk','Marmara','Gömeç','Altıeylül','Karesi'],
Bartın:['Merkez','Kurucaşile','Ulus','Amasra'],
Batman:['Merkez','Beşiri','Gercüş','Kozluk','Sason','Hasankeyf'],
Bayburt:['Merkez','Aydıntepe','Demirözü'],
Bilecik:['Merkez','Bozüyük','Gölpazarı','Osmaneli','Pazaryeri','Söğüt','Yenipazar','İnhisar'],
Bingöl:['Merkez','Genç','Karlıova','Kiğı','Solhan','Adaklı','Yayladere','Yedisu'],
Bitlis:['Adilcevaz','Ahlat','Merkez','Hizan','Mutki','Tatvan','Güroymak'],
Bolu:['Merkez','Gerede','Göynük','Kıbrıscık','Mengen','Mudurnu','Seben','Dörtdivan','Yeniçağa'],
Burdur:['Ağlasun','Bucak','Merkez','Gölhisar','Tefenni','Yeşilova','Karamanlı','Kemer','Altınyayla','Çavdır','Çeltikçi'],
Bursa:['Gemlik','İnegöl','İznik','Karacabey','Keles','Mudanya','Mustafakemalpaşa','Orhaneli','Orhangazi','Yenişehir','Büyükorhan','Harmancık','Nilüfer','Osmangazi','Yıldırım','Gürsu','Kestel'],
Çanakkale:['Ayvacık','Bayramiç','Biga','Bozcaada','Çan','Merkez','Eceabat','Ezine','Gelibolu','Gökçeada','Lapseki','Yenice'],
Çankırı:['Merkez','Çerkeş','Eldivan','Ilgaz','Kurşunlu','Orta','Şabanözü','Yapraklı','Atkaracalar','Kızılırmak','Bayramören','Korgun'],
Çorum:['Alaca','Bayat','Merkez','İskilip','Kargı','Mecitözü','Ortaköy','Osmancık','Sungurlu','Boğazkale','Uğurludağ','Dodurga','Laçin','Oğuzlar'],
Denizli:['Acıpayam','Buldan','Çal','Çameli','Çardak','Çivril','Güney','Kale','Sarayköy','Tavas','Babadağ','Bekilli','Honaz','Serinhisar','Pamukkale','Baklan','Beyağaç','Bozkurt','Merkezefendi'],
Diyarbakır:['Bismil','Çermik','Çınar','Çüngüş','Dicle','Ergani','Hani','Hazro','Kulp','Lice','Silvan','Eğil','Kocaköy','Bağlar','Kayapınar','Sur','Yenişehir'],
Düzce:['Akçakoca','Merkez','Yığılca','Cumayeri','Gölyaka','Çilimli','Gümüşova','Kaynaşlı'],
Edirne:['Merkez','Enez','Havsa','İpsala','Keşan','Lalapaşa','Meriç','Uzunköprü','Süloğlu'],
Elazığ:['Ağın','Baskil','Merkez','Karakoçan','Keban','Maden','Palu','Sivrice','Arıcak','Kovancılar','Alacakaya'],
Erzincan:['Çayırlı','Merkez','İliç','Kemah','Kemaliye','Refahiye','Tercan','Üzümlü','Otlukbeli'],
Erzurum:['Aşkale','Çat','Hınıs','Horasan','İspir','Karayazı','Narman','Oltu','Olur','Pasinler','Şenkaya','Tekman','Tortum','Karaçoban','Uzundere','Pazaryolu','Aziziye','Köprüköy','Palandöken','Yakutiye'],
Eskişehir:['Çifteler','Mahmudiye','Mihalıççık','Sarıcakaya','Seyitgazi','Sivrihisar','Alpu','Beylikova','İnönü','Günyüzü','Han','Mihalgazi','Odunpazarı','Tepebaşı'],
Gaziantep:['Araban','İslahiye','Nizip','Oğuzeli','Yavuzeli','Şahinbey','Şehitkamil','Karkamış','Nurdağı'],
Giresun:['Alucra','Bulancak','Dereli','Espiye','Eynesil','Merkez','Görele','Keşap','Şebinkarahisar','Tirebolu','Piraziz','Yağlıdere','Çamoluk','Çanakçı','Doğankent','Güce'],
Gümüşhane:['Merkez','Kelkit','Şiran','Torul','Köse','Kürtün'],
Hakkâri:['Çukurca','Merkez','Şemdinli','Yüksekova','Derecik'],
Hatay:['Altınözü','Dörtyol','Hassa','İskenderun','Kırıkhan','Reyhanlı','Samandağ','Yayladağı','Erzin','Belen','Kumlu','Antakya','Arsuz','Defne','Payas'],
Iğdır:['Aralık','Merkez','Tuzluca','Karakoyunlu'],
Isparta:['Atabey','Eğirdir','Gelendost','Merkez','Keçiborlu','Senirkent','Sütçüler','Şarkikaraağaç','Uluborlu','Yalvaç','Aksu','Gönen','Yenişarbademli'],
İstanbul:['Adalar','Bakırköy','Beşiktaş','Beykoz','Beyoğlu','Çatalca','Eyüpsultan','Fatih','Gaziosmanpaşa','Kadıköy','Kartal','Sarıyer','Silivri','Şile','Şişli','Üsküdar','Zeytinburnu','Büyükçekmece','Kağıthane','Küçükçekmece','Pendik','Ümraniye','Bayrampaşa','Avcılar','Bağcılar','Bahçelievler','Güngören','Maltepe','Sultanbeyli','Tuzla','Esenler','Arnavutköy','Ataşehir','Başakşehir','Beylikdüzü','Çekmeköy','Esenyurt','Sancaktepe','Sultangazi'],
İzmir:['Aliağa','Bayındır','Bergama','Bornova','Çeşme','Dikili','Foça','Karaburun','Karşıyaka','Kemalpaşa','Kınık','Kiraz','Menemen','Ödemiş','Seferihisar','Selçuk','Tire','Torbalı','Urla','Beydağ','Buca','Konak','Menderes','Balçova','Çiğli','Gaziemir','Narlıdere','Güzelbahçe','Bayraklı','Karabağlar'],
Kahramanmaraş:['Afşin','Andırın','Elbistan','Göksun','Pazarcık','Türkoğlu','Çağlayancerit','Ekinözü','Nurhak','Dulkadiroğlu','Onikişubat'],
Karabük:['Eflani','Eskipazar','Merkez','Ovacık','Safranbolu','Yenice'],
Karaman:['Ermenek','Merkez','Ayrancı','Kazımkarabekir','Başyayla','Sarıveliler'],
Kars:['Arpaçay','Digor','Kağızman','Merkez','Sarıkamış','Selim','Susuz','Akyaka'],
Kastamonu:['Abana','Araç','Azdavay','Bozkurt','Cide','Çatalzeytin','Daday','Devrekani','İnebolu','Merkez','Küre','Taşköprü','Tosya','İhsangazi','Pınarbaşı','Şenpazar','Ağlı','Doğanyurt','Hanönü','Seydiler'],
Kayseri:['Bünyan','Develi','Felahiye','İncesu','Pınarbaşı','Sarıoğlan','Sarız','Tomarza','Yahyalı','Yeşilhisar','Akkışla','Talas','Kocasinan','Melikgazi','Hacılar','Özvatan'],
Kilis:['Merkez','Elbeyli','Musabeyli','Polateli'],
Kırıkkale:['Delice','Keskin','Merkez','Sulakyurt','Bahşılı','Balışeyh','Çelebi','Karakeçili','Yahşihan'],
Kırklareli:['Babaeski','Demirköy','Merkez','Kofçaz','Lüleburgaz','Pehlivanköy','Pınarhisar','Vize'],
Kırşehir:['Çiçekdağı','Kaman','Merkez','Mucur','Akpınar','Akçakent','Boztepe'],
Kocaeli:['Gebze','Gölcük','Kandıra','Karamürsel','Körfez','Derince','Başiskele','Çayırova','Darıca','Dilovası','İzmit','Kartepe'],
Konya:['Akşehir','Beyşehir','Bozkır','Cihanbeyli','Çumra','Doğanhisar','Ereğli','Hadim','Ilgın','Kadınhanı','Karapınar','Kulu','Sarayönü','Seydişehir','Yunak','Akören','Altınekin','Derebucak','Hüyük','Karatay','Meram','Selçuklu','Taşkent','Ahırlı','Çeltik','Derbent','Emirgazi','Güneysınır','Halkapınar','Tuzlukçu','Yalıhüyük'],
Kütahya:['Altıntaş','Domaniç','Emet','Gediz','Merkez','Simav','Tavşanlı','Aslanapa','Dumlupınar','Hisarcık','Şaphane','Çavdarhisar','Pazarlar'],
Malatya:['Akçadağ','Arapgir','Arguvan','Darende','Doğanşehir','Hekimhan','Pütürge','Yeşilyurt','Battalgazi','Doğanyol','Kale','Kuluncak','Yazıhan'],
Manisa:['Akhisar','Alaşehir','Demirci','Gördes','Kırkağaç','Kula','Salihli','Sarıgöl','Saruhanlı','Selendi','Soma','Turgutlu','Ahmetli','Gölmarmara','Köprübaşı','Şehzadeler','Yunusemre'],
Mardin:['Derik','Kızıltepe','Mazıdağı','Midyat','Nusaybin','Ömerli','Savur','Dargeçit','Yeşilli','Artuklu'],
Mersin:['Anamur','Erdemli','Gülnar','Mut','Silifke','Tarsus','Aydıncık','Bozyazı','Çamlıyayla','Akdeniz','Mezitli','Toroslar','Yenişehir'],
Muğla:['Bodrum','Datça','Fethiye','Köyceğiz','Marmaris','Milas','Ula','Yatağan','Dalaman','Ortaca','Kavaklıdere','Menteşe','Seydikemer'],
Muş:['Bulanık','Malazgirt','Merkez','Varto','Hasköy','Korkut'],
Nevşehir:['Avanos','Derinkuyu','Gülşehir','Hacıbektaş','Kozaklı','Merkez','Ürgüp','Acıgöl'],
Niğde:['Bor','Çamardı','Merkez','Ulukışla','Altunhisar','Çiftlik'],
Ordu:['Akkuş','Aybastı','Fatsa','Gölköy','Korgan','Kumru','Mesudiye','Perşembe','Ulubey','Ünye','Gülyalı','Gürgentepe','Çamaş','Çatalpınar','Çaybaşı','İkizce','Kabadüz','Kabataş','Altınordu'],
Osmaniye:['Bahçe','Kadirli','Merkez','Düziçi','Hasanbeyli','Sumbas','Toprakkale'],
Rize:['Ardeşen','Çamlıhemşin','Çayeli','Fındıklı','İkizdere','Kalkandere','Pazar','Merkez','Güneysu','Derepazarı','Hemşin','İyidere'],
Sakarya:['Akyazı','Geyve','Hendek','Karasu','Kaynarca','Sapanca','Kocaali','Pamukova','Taraklı','Ferizli','Karapürçek','Söğütlü','Adapazarı','Arifiye','Erenler','Serdivan'],
Samsun:['Alaçam','Bafra','Çarşamba','Havza','Kavak','Ladik','Terme','Vezirköprü','Asarcık','19 Mayıs','Salıpazarı','Tekkeköy','Ayvacık','Yakakent','Atakum','Canik','İlkadım'],
Siirt:['Baykan','Eruh','Kurtalan','Pervari','Merkez','Şirvan','Tillo'],
Sinop:['Ayancık','Boyabat','Durağan','Erfelek','Gerze','Merkez','Türkeli','Dikmen','Saraydüzü'],
Sivas:['Divriği','Gemerek','Gürün','Hafik','İmranlı','Kangal','Koyulhisar','Merkez','Suşehri','Şarkışla','Yıldızeli','Zara','Akıncılar','Altınyayla','Doğanşar','Gölova','Ulaş'],
Şanlıurfa:['Akçakale','Birecik','Bozova','Ceylanpınar','Halfeti','Hilvan','Siverek','Suruç','Viranşehir','Harran','Eyyübiye','Haliliye','Karaköprü'],
Şırnak:['Beytüşşebap','Cizre','İdil','Silopi','Merkez','Uludere','Güçlükonak'],
Tekirdağ:['Çerkezköy','Çorlu','Hayrabolu','Malkara','Muratlı','Saray','Şarköy','Marmaraereğlisi','Ergene','Kapaklı','Süleymanpaşa'],
Tokat:['Almus','Artova','Erbaa','Niksar','Reşadiye','Merkez','Turhal','Zile','Pazar','Yeşilyurt','Başçiftlik','Sulusaray'],
Trabzon:['Akçaabat','Araklı','Arsin','Çaykara','Maçka','Of','Sürmene','Tonya','Vakfıkebir','Yomra','Beşikdüzü','Şalpazarı','Çarşıbaşı','Dernekpazarı','Düzköy','Hayrat','Köprübaşı','Ortahisar'],
Tunceli:['Çemişgezek','Hozat','Mazgirt','Nazımiye','Ovacık','Pertek','Pülümür','Merkez'],
Uşak:['Banaz','Eşme','Karahallı','Sivaslı','Ulubey','Merkez'],
Van:['Başkale','Çatak','Erciş','Gevaş','Gürpınar','Muradiye','Özalp','Bahçesaray','Çaldıran','Edremit','Saray','İpekyolu','Tuşba'],
Yalova:['Merkez','Altınova','Armutlu','Çınarcık','Çiftlikköy','Termal'],
Yozgat:['Akdağmadeni','Boğazlıyan','Çayıralan','Çekerek','Sarıkaya','Sorgun','Şefaatli','Yerköy','Merkez','Aydıncık','Çandır','Kadışehri','Saraykent','Yenifakılı'],
Zonguldak:['Çaycuma','Devrek','Ereğli','Merkez','Alaplı','Gökçebey','Kilimli','Kozlu']
};

// Kaynak listedeki iki olası yazım farklılığını kullanıcı aramasında da tolere et.
districtMap['Bingöl'][2] = 'Karlıova';
districtMap['Karaman'][5] = 'Sarıveliler';

export const districtsFor = (province: string): string[] => {
  if (districtMap[province]) return districtMap[province];
  const key = trSlug(province);
  const match = key ? Object.keys(districtMap).find((name) => trSlug(name) === key) : undefined;
  return match ? districtMap[match] : [];
};
export const districtCount = Object.values(districtMap).reduce((sum, list) => sum + list.length, 0);
