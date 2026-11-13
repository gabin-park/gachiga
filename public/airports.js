// 항공권에 쓰는 공항 목록: 코드|도시|공항 이름|나라|영문 검색어
// 같은 도시에 공항이 여럿이면 많이 쓰는 곳을 먼저 둡니다(여행 이름으로 도착지를 추천할 때 앞의 것을 고릅니다).
// 목록에 없는 공항도 3글자 코드를 직접 넣으면 쓸 수 있어요.
const RAW = `
ICN|서울|인천국제공항|한국|seoul incheon
GMP|서울|김포국제공항|한국|seoul gimpo
PUS|부산|김해국제공항|한국|busan gimhae
CJU|제주|제주국제공항|한국|jeju
TAE|대구|대구국제공항|한국|daegu
CJJ|청주|청주국제공항|한국|cheongju
KWJ|광주|광주공항|한국|gwangju
MWX|무안|무안국제공항|한국|muan
YNY|양양|양양국제공항|한국|yangyang
RSU|여수|여수공항|한국|yeosu
USN|울산|울산공항|한국|ulsan
NRT|도쿄|나리타국제공항|일본|tokyo narita
HND|도쿄|하네다공항|일본|tokyo haneda
KIX|오사카|간사이국제공항|일본|osaka kansai
ITM|오사카|이타미공항|일본|osaka itami
FUK|후쿠오카|후쿠오카공항|일본|fukuoka
CTS|삿포로|신치토세공항|일본|sapporo chitose hokkaido
OKA|오키나와|나하공항|일본|okinawa naha
NGO|나고야|주부국제공항|일본|nagoya chubu
KOJ|가고시마|가고시마공항|일본|kagoshima
KMJ|구마모토|구마모토공항|일본|kumamoto
HIJ|히로시마|히로시마공항|일본|hiroshima
SDJ|센다이|센다이공항|일본|sendai
OIT|오이타|오이타공항|일본|oita beppu yufuin
MYJ|마쓰야마|마쓰야마공항|일본|matsuyama
TAK|다카마쓰|다카마쓰공항|일본|takamatsu
KMQ|고마쓰|고마쓰공항|일본|komatsu kanazawa
FSZ|시즈오카|후지산시즈오카공항|일본|shizuoka fuji
KKJ|기타큐슈|기타큐슈공항|일본|kitakyushu
NGS|나가사키|나가사키공항|일본|nagasaki
UBJ|야마구치|야마구치우베공항|일본|yamaguchi ube
OKJ|오카야마|오카야마공항|일본|okayama
KIJ|니가타|니가타공항|일본|niigata
AOJ|아오모리|아오모리공항|일본|aomori
ISG|이시가키|신이시가키공항|일본|ishigaki
PEK|베이징|서우두국제공항|중국|beijing capital
PKX|베이징|다싱국제공항|중국|beijing daxing
PVG|상하이|푸둥국제공항|중국|shanghai pudong
SHA|상하이|훙차오국제공항|중국|shanghai hongqiao
CAN|광저우|바이윈국제공항|중국|guangzhou
SZX|선전|바오안국제공항|중국|shenzhen
TAO|칭다오|자오둥국제공항|중국|qingdao
DLC|다롄|저우수이쯔국제공항|중국|dalian
SHE|선양|타오셴국제공항|중국|shenyang
YNJ|옌지|옌지차오양촨국제공항|중국|yanji
CTU|청두|톈푸국제공항|중국|chengdu
XIY|시안|셴양국제공항|중국|xian
HGH|항저우|샤오산국제공항|중국|hangzhou
KMG|쿤밍|창수이국제공항|중국|kunming
ZUH|주하이|진완공항|중국|zhuhai
SYX|싼야|펑황국제공항|중국|sanya hainan
HKG|홍콩|홍콩국제공항|홍콩|hong kong
MFM|마카오|마카오국제공항|마카오|macau macao
TPE|타이베이|타오위안국제공항|대만|taipei taoyuan
TSA|타이베이|쑹산공항|대만|taipei songshan
KHH|가오슝|가오슝국제공항|대만|kaohsiung
RMQ|타이중|타이중국제공항|대만|taichung
ULN|울란바토르|칭기즈칸국제공항|몽골|ulaanbaatar mongolia
VVO|블라디보스토크|블라디보스토크국제공항|러시아|vladivostok
BKK|방콕|수완나품국제공항|태국|bangkok suvarnabhumi
DMK|방콕|돈므앙국제공항|태국|bangkok don mueang
HKT|푸껫|푸껫국제공항|태국|phuket
CNX|치앙마이|치앙마이국제공항|태국|chiang mai
USM|코사무이|사무이공항|태국|koh samui
KBV|끄라비|끄라비국제공항|태국|krabi
SGN|호찌민|떤선녓국제공항|베트남|ho chi minh saigon
HAN|하노이|노이바이국제공항|베트남|hanoi
DAD|다낭|다낭국제공항|베트남|da nang danang
CXR|나트랑|깜라인국제공항|베트남|nha trang cam ranh
PQC|푸꾸옥|푸꾸옥국제공항|베트남|phu quoc
DLI|달랏|리엔크엉공항|베트남|dalat
HPH|하이퐁|깟비국제공항|베트남|haiphong halong
MNL|마닐라|니노이아키노국제공항|필리핀|manila
CEB|세부|막탄세부국제공항|필리핀|cebu mactan
MPH|보라카이|카티클란공항|필리핀|boracay caticlan
KLO|보라카이|칼리보국제공항|필리핀|boracay kalibo
TAG|보홀|팡라오국제공항|필리핀|bohol panglao
CRK|클라크|클라크국제공항|필리핀|clark angeles
SIN|싱가포르|창이공항|싱가포르|singapore changi
KUL|쿠알라룸푸르|쿠알라룸푸르국제공항|말레이시아|kuala lumpur
BKI|코타키나발루|코타키나발루국제공항|말레이시아|kota kinabalu
PEN|페낭|페낭국제공항|말레이시아|penang
LGK|랑카위|랑카위국제공항|말레이시아|langkawi
DPS|발리|응우라라이국제공항|인도네시아|bali denpasar
CGK|자카르타|수카르노하타국제공항|인도네시아|jakarta
BTH|바탐|항나딤공항|인도네시아|batam
VTE|비엔티안|왓따이국제공항|라오스|vientiane laos
LPQ|루앙프라방|루앙프라방국제공항|라오스|luang prabang
PNH|프놈펜|프놈펜국제공항|캄보디아|phnom penh
SAI|시엠레아프|시엠레아프앙코르국제공항|캄보디아|siem reap angkor
RGN|양곤|양곤국제공항|미얀마|yangon
DEL|델리|인디라간디국제공항|인도|delhi india
BOM|뭄바이|차트라파티시바지국제공항|인도|mumbai
KTM|카트만두|트리부반국제공항|네팔|kathmandu nepal
CMB|콜롬보|반다라나이케국제공항|스리랑카|colombo sri lanka
MLE|몰디브|벨라나국제공항|몰디브|maldives male
DXB|두바이|두바이국제공항|아랍에미리트|dubai
AUH|아부다비|자이드국제공항|아랍에미리트|abu dhabi
DOH|도하|하마드국제공항|카타르|doha qatar
IST|이스탄불|이스탄불공항|튀르키예|istanbul turkey
SAW|이스탄불|사비하괵첸공항|튀르키예|istanbul sabiha
TAS|타슈켄트|타슈켄트국제공항|우즈베키스탄|tashkent
ALA|알마티|알마티국제공항|카자흐스탄|almaty
SYD|시드니|시드니공항|호주|sydney
MEL|멜버른|멜버른공항|호주|melbourne
BNE|브리즈번|브리즈번공항|호주|brisbane
OOL|골드코스트|골드코스트공항|호주|gold coast
PER|퍼스|퍼스공항|호주|perth
CNS|케언스|케언스공항|호주|cairns
AKL|오클랜드|오클랜드공항|뉴질랜드|auckland new zealand
CHC|크라이스트처치|크라이스트처치공항|뉴질랜드|christchurch
ZQN|퀸스타운|퀸스타운공항|뉴질랜드|queenstown
GUM|괌|안토니오원팻국제공항|괌|guam
SPN|사이판|사이판국제공항|북마리아나제도|saipan
ROR|팔라우|로만투멧쳉국제공항|팔라우|palau koror
NAN|피지|난디국제공항|피지|fiji nadi
PPT|타히티|파아국제공항|프랑스령 폴리네시아|tahiti papeete
HNL|호놀룰루|대니얼K이노우에국제공항|미국|honolulu hawaii oahu
OGG|마우이|카훌루이공항|미국|maui hawaii
KOA|코나|코나국제공항|미국|kona big island hawaii
LAX|로스앤젤레스|로스앤젤레스국제공항|미국|los angeles la
SFO|샌프란시스코|샌프란시스코국제공항|미국|san francisco
SJC|산호세|산호세국제공항|미국|san jose silicon valley
OAK|오클랜드(미국)|오클랜드국제공항|미국|oakland
SEA|시애틀|시애틀타코마국제공항|미국|seattle tacoma
PDX|포틀랜드|포틀랜드국제공항|미국|portland oregon
LAS|라스베이거스|해리리드국제공항|미국|las vegas
SAN|샌디에이고|샌디에이고국제공항|미국|san diego
PHX|피닉스|스카이하버국제공항|미국|phoenix grand canyon
DEN|덴버|덴버국제공항|미국|denver
SLC|솔트레이크시티|솔트레이크시티국제공항|미국|salt lake city
DFW|댈러스|댈러스포트워스국제공항|미국|dallas fort worth
IAH|휴스턴|조지부시국제공항|미국|houston
AUS|오스틴|오스틴버그스트롬국제공항|미국|austin
ORD|시카고|오헤어국제공항|미국|chicago ohare
MSP|미니애폴리스|미니애폴리스세인트폴국제공항|미국|minneapolis
DTW|디트로이트|디트로이트메트로폴리탄공항|미국|detroit
ATL|애틀랜타|하츠필드잭슨국제공항|미국|atlanta
MIA|마이애미|마이애미국제공항|미국|miami
MCO|올랜도|올랜도국제공항|미국|orlando disney
BOS|보스턴|로건국제공항|미국|boston
JFK|뉴욕|존F케네디국제공항|미국|new york jfk
EWR|뉴욕|뉴어크리버티국제공항|미국|new york newark
LGA|뉴욕|라과디아공항|미국|new york laguardia
IAD|워싱턴 D.C.|덜레스국제공항|미국|washington dulles
DCA|워싱턴 D.C.|레이건내셔널공항|미국|washington reagan
PHL|필라델피아|필라델피아국제공항|미국|philadelphia
ANC|앵커리지|테드스티븐스국제공항|미국|anchorage alaska
YVR|밴쿠버|밴쿠버국제공항|캐나다|vancouver
YYZ|토론토|피어슨국제공항|캐나다|toronto
YUL|몬트리올|트뤼도국제공항|캐나다|montreal
YYC|캘거리|캘거리국제공항|캐나다|calgary banff
MEX|멕시코시티|베니토후아레스국제공항|멕시코|mexico city
CUN|칸쿤|칸쿤국제공항|멕시코|cancun
GRU|상파울루|과룰류스국제공항|브라질|sao paulo
GIG|리우데자네이루|갈레앙국제공항|브라질|rio de janeiro
EZE|부에노스아이레스|에세이사국제공항|아르헨티나|buenos aires
LIM|리마|호르헤차베스국제공항|페루|lima peru machu picchu
SCL|산티아고|아르투로메리노베니테스국제공항|칠레|santiago chile
BOG|보고타|엘도라도국제공항|콜롬비아|bogota
LHR|런던|히스로공항|영국|london heathrow
LGW|런던|개트윅공항|영국|london gatwick
EDI|에든버러|에든버러공항|영국|edinburgh scotland
MAN|맨체스터|맨체스터공항|영국|manchester
DUB|더블린|더블린공항|아일랜드|dublin ireland
CDG|파리|샤를드골공항|프랑스|paris charles de gaulle
ORY|파리|오를리공항|프랑스|paris orly
NCE|니스|코트다쥐르공항|프랑스|nice
FRA|프랑크푸르트|프랑크푸르트공항|독일|frankfurt
MUC|뮌헨|뮌헨공항|독일|munich
BER|베를린|브란덴부르크공항|독일|berlin
AMS|암스테르담|스히폴공항|네덜란드|amsterdam schiphol
BRU|브뤼셀|브뤼셀공항|벨기에|brussels
ZRH|취리히|취리히공항|스위스|zurich switzerland
GVA|제네바|제네바공항|스위스|geneva
VIE|빈|빈국제공항|오스트리아|vienna wien
PRG|프라하|바츨라프하벨공항|체코|prague
BUD|부다페스트|리스트페렌츠국제공항|헝가리|budapest
WAW|바르샤바|쇼팽공항|폴란드|warsaw
FCO|로마|피우미치노공항|이탈리아|rome fiumicino
MXP|밀라노|말펜사공항|이탈리아|milan malpensa
VCE|베네치아|마르코폴로공항|이탈리아|venice venezia
FLR|피렌체|페레톨라공항|이탈리아|florence firenze
NAP|나폴리|나폴리국제공항|이탈리아|naples amalfi
MAD|마드리드|바라하스공항|스페인|madrid
BCN|바르셀로나|엘프라트공항|스페인|barcelona
AGP|말라가|말라가공항|스페인|malaga
LIS|리스본|움베르투델가두공항|포르투갈|lisbon
OPO|포르투|프란시스쿠사카르네이루공항|포르투갈|porto
ATH|아테네|엘레프테리오스베니젤로스공항|그리스|athens
JTR|산토리니|산토리니공항|그리스|santorini thira
CPH|코펜하겐|카스트루프공항|덴마크|copenhagen
ARN|스톡홀름|알란다공항|스웨덴|stockholm
OSL|오슬로|가르데르모엔공항|노르웨이|oslo
HEL|헬싱키|반타공항|핀란드|helsinki
KEF|레이캬비크|케플라비크국제공항|아이슬란드|reykjavik iceland
ZAG|자그레브|자그레브공항|크로아티아|zagreb croatia
DBV|두브로브니크|두브로브니크공항|크로아티아|dubrovnik
SPU|스플리트|스플리트공항|크로아티아|split
CAI|카이로|카이로국제공항|이집트|cairo egypt
RAK|마라케시|메나라공항|모로코|marrakech morocco
JNB|요하네스버그|O.R.탐보국제공항|남아프리카공화국|johannesburg
CPT|케이프타운|케이프타운국제공항|남아프리카공화국|cape town
NBO|나이로비|조모케냐타국제공항|케냐|nairobi kenya
`;

export const AIRPORTS = RAW.trim().split('\n').map(line => {
  const [code, city, name, country, en] = line.split('|');
  return { code, city, name, country, en };
});

const BY_CODE = Object.fromEntries(AIRPORTS.map(a => [a.code, a]));
export const airportByCode = code => BY_CODE[String(code || '').toUpperCase()];

// "시애틀", "sea", "seattle", "하네다" 모두 찾을 수 있어요.
export function searchAirports(query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const a of AIRPORTS) {
    const code = a.code.toLowerCase();
    let score = 0;
    if (code === q) score = 100;
    else if (a.city.startsWith(q) || a.en.startsWith(q)) score = 80;
    else if (code.startsWith(q)) score = 60;
    else if (a.city.includes(q) || a.name.includes(q) || a.en.includes(q)) score = 40;
    else if (a.country.startsWith(q)) score = 20;
    if (score) scored.push([score, a]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map(([, a]) => a);
}

// 여행 이름에 도시 이름이 들어 있으면 그 도시의 대표 공항을 골라 줍니다. "시애틀 먹방" → SEA
export function guessAirport(text) {
  const t = String(text || '').toLowerCase();
  let best = null;
  for (const a of AIRPORTS) {
    const city = a.city.replace(/\(.*\)/, '');
    if (a.country === '한국' && a.city === '서울') continue;
    if (t.includes(city) && (!best || city.length > best.city.replace(/\(.*\)/, '').length)) best = a;
  }
  return best;
}

// 예전에 도시 코드(SEL, TYO…)로 저장한 여행도 도시 이름이 나오게 합니다.
const METRO = { SEL: '서울', TYO: '도쿄', OSA: '오사카', NYC: '뉴욕', LON: '런던', PAR: '파리', BJS: '베이징', SHA: '상하이', MIL: '밀라노', ROM: '로마', WAS: '워싱턴 D.C.', CHI: '시카고' };
export const cityOfCode = code => airportByCode(code)?.city || METRO[String(code || '').toUpperCase()] || '';

// 공항 위치(위도, 경도): 날씨를 공항 근처 도시 기준으로 가져올 때 써요.
// 도시 이름으로 지도 검색을 하면 '도쿄야끼'(서울의 식당)처럼 엉뚱한 곳이 나올 수 있어서 좌표를 직접 적어 둬요.
const COORDS = {
  ICN:[37.449,126.451],GMP:[37.566,126.801],PUS:[35.18,128.938],CJU:[33.511,126.493],TAE:[35.894,128.659],
  CJJ:[36.717,127.499],KWJ:[35.126,126.809],MWX:[34.991,126.383],YNY:[38.061,128.669],RSU:[34.842,127.617],
  USN:[35.593,129.352],NRT:[35.765,140.386],HND:[35.552,139.78],KIX:[34.427,135.244],ITM:[34.786,135.438],
  FUK:[33.586,130.451],CTS:[42.775,141.692],NGO:[34.858,136.805],KOJ:[31.803,130.719],KMJ:[32.837,130.855],
  HIJ:[34.436,132.919],SDJ:[38.14,140.917],OIT:[33.479,131.737],MYJ:[33.827,132.7],KMQ:[36.395,136.407],
  FSZ:[34.797,138.182],KKJ:[33.846,131.035],NGS:[32.917,129.914],UBJ:[33.93,131.279],OKJ:[34.757,133.855],
  KIJ:[37.956,139.121],AOJ:[40.735,140.691],ISG:[24.397,124.247],PEK:[40.08,116.585],PKX:[39.51,116.41],
  PVG:[31.143,121.805],SZX:[22.639,113.811],DLC:[38.966,121.539],SHE:[41.64,123.483],YNJ:[42.883,129.451],
  CTU:[30.579,103.947],XIY:[34.447,108.752],HGH:[30.23,120.434],KMG:[25.104,102.944],ZUH:[22.006,113.376],
  SYX:[18.303,109.412],HKG:[22.315,113.934],MFM:[22.15,113.592],TPE:[25.078,121.233],TSA:[25.064,121.55],
  KHH:[22.577,120.35],RMQ:[24.262,120.627],ULN:[47.843,106.767],VVO:[43.399,132.148],BKK:[13.692,100.751],
  DMK:[13.913,100.607],HKT:[8.113,98.317],CNX:[18.767,98.967],USM:[9.547,100.062],KBV:[8.1,98.985],
  SGN:[10.819,106.652],CXR:[11.998,109.219],PQC:[10.17,103.994],DLI:[11.753,108.368],HPH:[20.819,106.725],
  MNL:[14.505,121.004],CEB:[10.309,123.98],MPH:[11.924,121.953],KLO:[11.686,122.381],TAG:[9.573,123.77],
  CRK:[15.186,120.56],BKI:[5.937,116.051],LGK:[6.33,99.729],DPS:[-8.75,115.167],CGK:[-6.126,106.656],
  BTH:[1.121,104.115],VTE:[17.988,102.563],LPQ:[19.899,102.163],PNH:[11.547,104.844],RGN:[16.907,96.133],
  DEL:[28.567,77.103],KTM:[27.697,85.359],CMB:[7.181,79.884],MLE:[4.192,73.529],DXB:[25.253,55.364],
  AUH:[24.433,54.651],DOH:[25.269,51.61],IST:[41.263,28.742],SAW:[40.899,29.309],TAS:[41.258,69.281],
  SYD:[-33.946,151.177],BNE:[-27.384,153.118],OOL:[-28.164,153.505],CNS:[-16.886,145.755],AKL:[-37.008,174.792],
  CHC:[-43.489,172.532],ZQN:[-45.018,168.74],SPN:[15.118,145.726],PPT:[-17.554,-149.607],HNL:[21.325,-157.925],
  OGG:[20.899,-156.43],KOA:[19.739,-156.046],LAX:[33.943,-118.409],SFO:[37.619,-122.376],SJC:[37.362,-121.929],
  OAK:[37.731,-122.22],SEA:[47.449,-122.309],PDX:[45.589,-122.594],PHX:[33.436,-111.998],SLC:[40.787,-111.982],
  DFW:[32.896,-97.037],IAH:[29.987,-95.342],AUS:[30.195,-97.67],ORD:[41.98,-87.904],MSP:[44.882,-93.208],
  DTW:[42.222,-83.351],ATL:[33.641,-84.423],MCO:[28.431,-81.308],JFK:[40.64,-73.779],EWR:[40.697,-74.176],
  LGA:[40.776,-73.873],IAD:[38.949,-77.449],DCA:[38.852,-77.037],PHL:[39.878,-75.24],ANC:[61.174,-149.996],
  YVR:[49.195,-123.179],YYZ:[43.681,-79.613],YUL:[45.461,-73.75],YYC:[51.129,-114.013],MEX:[19.436,-99.072],
  CUN:[21.037,-86.877],GIG:[-22.799,-43.231],EZE:[-34.822,-58.536],SCL:[-33.393,-70.786],LHR:[51.471,-0.456],
  LGW:[51.156,-0.178],EDI:[55.95,-3.373],CDG:[49.013,2.55],ORY:[48.725,2.359],NCE:[43.663,7.208],
  FRA:[50.041,8.556],MUC:[48.354,11.786],AMS:[52.31,4.76],BRU:[50.901,4.484],ZRH:[47.453,8.56],
  GVA:[46.238,6.109],VIE:[48.122,16.558],PRG:[50.101,14.26],WAW:[52.166,20.967],FCO:[41.794,12.253],
  MXP:[45.628,8.715],VCE:[45.505,12.341],FLR:[43.81,11.205],NAP:[40.886,14.291],BCN:[41.297,2.078],
  AGP:[36.675,-4.499],OPO:[41.248,-8.681],ATH:[37.936,23.944],JTR:[36.399,25.479],CPH:[55.618,12.656],
  OSL:[60.194,11.1],KEF:[63.985,-22.606],ZAG:[45.741,16.068],DBV:[42.561,18.268],SPU:[43.539,16.298],
  RAK:[31.607,-8.036],JNB:[-26.133,28.236],CPT:[-33.965,18.602],NBO:[-1.33,36.925],OKA:[26.213,127.679],
  TAK:[34.333,134.05],SHA:[31.222,121.458],CAN:[23.117,113.25],TAO:[36.065,120.38],HAN:[21.024,105.841],
  DAD:[16.068,108.221],SIN:[1.29,103.85],KUL:[3.141,101.687],PEN:[5.411,100.335],SAI:[13.362,103.861],
  BOM:[19.073,72.883],ALA:[43.252,76.912],MEL:[-37.814,144.963],PER:[-31.952,115.861],GUM:[13.476,144.749],
  ROR:[7.34,134.473],NAN:[-17.803,177.416],LAS:[36.175,-115.137],SAN:[32.716,-117.165],DEN:[39.739,-104.985],
  MIA:[25.774,-80.194],BOS:[42.358,-71.06],GRU:[-23.547,-46.636],LIM:[-12.043,-77.028],BOG:[4.61,-74.082],
  MAN:[53.481,-2.237],DUB:[53.333,-6.249],BER:[52.524,13.411],BUD:[47.498,19.04],MAD:[40.416,-3.703],
  LIS:[38.725,-9.15],ARN:[59.329,18.069],HEL:[60.17,24.935],CAI:[30.063,31.25]
};
const METRO_MAIN = { SEL: 'ICN', TYO: 'HND', OSA: 'KIX', NYC: 'JFK', LON: 'LHR', PAR: 'CDG', BJS: 'PEK', SHA: 'PVG', MIL: 'MXP', ROM: 'FCO', WAS: 'IAD', CHI: 'ORD' };
export const airportCoords = code => {
  const c = String(code || '').toUpperCase(), v = COORDS[c] || COORDS[METRO_MAIN[c]];
  return v && { lat: v[0], lng: v[1] };
};
