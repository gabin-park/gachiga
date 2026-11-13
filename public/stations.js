// 기차역·고속버스 터미널 목록: 티켓에 쓰는 이름|지역|정식 이름|검색어|위치 검색어(없으면 지역)
// 목록에 없는 곳은 app.js가 온라인(오픈스트리트맵)에서 더 찾고, 그래도 없으면 이름을 그대로 적어요.
// 지역·위치 검색어는 날씨·지도 위치를 찾을 때 써요.
const TRAIN = `
서울|서울|서울역|seoul
용산|서울|용산역|yongsan
영등포|서울|영등포역|yeongdeungpo
청량리|서울|청량리역|cheongnyangni
수서|서울|수서역 (SRT)|suseo srt
광명|광명|광명역|gwangmyeong
행신|고양|행신역|haengsin goyang
수원|수원|수원역|suwon
동탄|화성|동탄역 (SRT)|dongtan srt
평택지제|평택|평택지제역 (SRT)|pyeongtaek jije srt
평택|평택|평택역|pyeongtaek
천안아산|아산|천안아산역|cheonan asan
천안|천안|천안역|cheonan
온양온천|아산|온양온천역|onyang asan
오송|청주|오송역|osong sejong 세종
청주|청주|청주역|cheongju
대전|대전|대전역|daejeon
서대전|대전|서대전역|seodaejeon
공주|공주|공주역|gongju
논산|논산|논산역|nonsan
홍성|홍성|홍성역|hongseong
대천|보령|대천역|daecheon boryeong 보령
군산|군산|군산역|gunsan
익산|익산|익산역|iksan
전주|전주|전주역|jeonju
남원|남원|남원역|namwon
정읍|정읍|정읍역|jeongeup
광주송정|광주|광주송정역|gwangju songjeong
나주|나주|나주역|naju
목포|목포|목포역|mokpo
순천|순천|순천역|suncheon
여천|여수|여천역|yeocheon yeosu
여수엑스포|여수|여수엑스포역|yeosu expo
김천구미|김천|김천구미역|gimcheon gumi
구미|구미|구미역|gumi
서대구|대구|서대구역|seodaegu daegu
동대구|대구|동대구역|dongdaegu daegu
대구|대구|대구역|daegu
신경주|경주|신경주역|singyeongju gyeongju 경주
포항|포항|포항역|pohang
울산|울산|울산역 (통도사)|ulsan
태화강|울산|태화강역|taehwagang ulsan
부산|부산|부산역|busan
부전|부산|부전역|bujeon busan
구포|부산|구포역|gupo busan
밀양|밀양|밀양역|miryang
창원중앙|창원|창원중앙역|changwon
창원|창원|창원역|changwon
마산|창원|마산역|masan changwon
진주|진주|진주역|jinju
강릉|강릉|강릉역|gangneung
정동진|강릉|정동진역|jeongdongjin gangneung
동해|동해|동해역|donghae
평창|평창|평창역|pyeongchang
진부|평창|진부역 (오대산)|jinbu odaesan pyeongchang
둔내|횡성|둔내역|dunnae hoengseong
횡성|횡성|횡성역|hoengseong
만종|원주|만종역|manjong wonju
서원주|원주|서원주역|seowonju wonju
원주|원주|원주역|wonju
제천|제천|제천역|jecheon
단양|단양|단양역|danyang
영주|영주|영주역|yeongju
안동|안동|안동역|andong
춘천|춘천|춘천역|chuncheon
남춘천|춘천|남춘천역|namchuncheon chuncheon
가평|가평|가평역|gapyeong
`;

// 미국 Amtrak 주요 역 (+ 캐나다 밴쿠버)
const TRAIN_US = `
뉴욕|뉴욕|New York Penn Station (NYP) · 미국|new york penn nyp nyc|New York
워싱턴 DC|워싱턴 DC|Washington Union Station (WAS) · 미국|washington dc union was|Washington, DC
보스턴|보스턴|Boston South Station (BOS) · 미국|boston south bos|Boston
보스턴 백베이|보스턴|Boston Back Bay (BBY) · 미국|boston back bay bby|Boston
필라델피아|필라델피아|Philadelphia 30th Street (PHL) · 미국|philadelphia 30th phl|Philadelphia
볼티모어|볼티모어|Baltimore Penn Station (BAL) · 미국|baltimore penn bal|Baltimore
뉴어크|뉴어크|Newark Penn Station (NWK) · 미국|newark penn nwk new jersey|Newark, New Jersey
프로비던스|프로비던스|Providence (PVD) · 미국|providence pvd|Providence
뉴헤이븐|뉴헤이븐|New Haven Union Station (NHV) · 미국|new haven nhv|New Haven
올버니|올버니|Albany–Rensselaer (ALB) · 미국|albany rensselaer alb|Albany, New York
버펄로|버펄로|Buffalo Exchange Street (BUF) · 미국|buffalo buf|Buffalo
나이아가라|나이아가라 폴스|Niagara Falls (NFL) · 미국|niagara falls nfl 나이아가라 폭포|Niagara Falls, New York
리치먼드|리치먼드|Richmond Staples Mill (RVR) · 미국|richmond rvr virginia|Richmond, Virginia
롤리|롤리|Raleigh Union Station (RGH) · 미국|raleigh rgh|Raleigh
샬럿|샬럿|Charlotte (CLT) · 미국|charlotte clt|Charlotte
애틀랜타|애틀랜타|Atlanta Peachtree (ATL) · 미국|atlanta peachtree atl|Atlanta
서배너|서배너|Savannah (SAV) · 미국|savannah sav|Savannah
찰스턴|찰스턴|Charleston (CHS) · 미국|charleston chs|Charleston, South Carolina
잭슨빌|잭슨빌|Jacksonville (JAX) · 미국|jacksonville jax|Jacksonville
올랜도|올랜도|Orlando (ORL) · 미국|orlando orl|Orlando
탬파|탬파|Tampa Union Station (TPA) · 미국|tampa tpa|Tampa
마이애미|마이애미|Miami (MIA) · 미국|miami mia|Miami
뉴올리언스|뉴올리언스|New Orleans Union Passenger Terminal (NOL) · 미국|new orleans nol|New Orleans
시카고|시카고|Chicago Union Station (CHI) · 미국|chicago union chi|Chicago
밀워키|밀워키|Milwaukee Intermodal (MKE) · 미국|milwaukee mke|Milwaukee
디트로이트|디트로이트|Detroit (DET) · 미국|detroit det|Detroit
세인트루이스|세인트루이스|St. Louis Gateway (STL) · 미국|st louis saint stl|St. Louis
캔자스시티|캔자스시티|Kansas City Union Station (KCY) · 미국|kansas city kcy|Kansas City, Missouri
세인트폴|미니애폴리스|St. Paul Union Depot (MSP) · 미국|st paul minneapolis msp 미니애폴리스|Saint Paul
피츠버그|피츠버그|Pittsburgh Union Station (PGH) · 미국|pittsburgh pgh|Pittsburgh
클리블랜드|클리블랜드|Cleveland Lakefront (CLE) · 미국|cleveland cle|Cleveland
신시내티|신시내티|Cincinnati Union Terminal (CIN) · 미국|cincinnati cin|Cincinnati
덴버|덴버|Denver Union Station (DEN) · 미국|denver den|Denver
솔트레이크|솔트레이크시티|Salt Lake City (SLC) · 미국|salt lake city slc 솔트레이크시티|Salt Lake City
댈러스|댈러스|Dallas Union Station (DAL) · 미국|dallas dal|Dallas
포트워스|포트워스|Fort Worth (FTW) · 미국|fort worth ftw|Fort Worth
샌안토니오|샌안토니오|San Antonio (SAS) · 미국|san antonio sas|San Antonio
휴스턴|휴스턴|Houston (HOS) · 미국|houston hos|Houston
오스틴|오스틴|Austin (AUS) · 미국|austin aus texas|Austin, Texas
앨버커키|앨버커키|Albuquerque (ABQ) · 미국|albuquerque abq|Albuquerque
플래그스태프|플래그스태프|Flagstaff (FLG) · 그랜드캐니언 가는 길|flagstaff flg grand canyon 그랜드캐니언|Flagstaff
LA|로스앤젤레스|Los Angeles Union Station (LAX) · 미국|los angeles la union lax 엘에이 로스앤젤레스|Los Angeles
샌디에이고|샌디에이고|San Diego Santa Fe Depot (SAN) · 미국|san diego santa fe san|San Diego
애너하임|애너하임|Anaheim ARTIC (ANA) · 디즈니랜드 근처|anaheim artic ana disneyland 디즈니랜드|Anaheim
샌타바버라|샌타바버라|Santa Barbara (SBA) · 미국|santa barbara sba 산타바바라|Santa Barbara
샌루이스오비스포|샌루이스오비스포|San Luis Obispo (SLO) · 미국|san luis obispo slo|San Luis Obispo
에머리빌|샌프란시스코|Emeryville (EMY) · 샌프란시스코 연결 버스|emeryville san francisco sf emy 샌프란시스코|Emeryville
오클랜드|오클랜드|Oakland Jack London Square (OKJ) · 미국|oakland jack london okj|Oakland, California
새너제이|새너제이|San Jose Diridon (SJC) · 미국|san jose diridon sjc 산호세|San Jose
새크라멘토|새크라멘토|Sacramento Valley (SAC) · 미국|sacramento sac|Sacramento
트러키|트러키|Truckee (TRU) · 레이크 타호 근처|truckee tru lake tahoe 타호|Truckee
리노|리노|Reno (RNO) · 미국|reno rno|Reno
포틀랜드|포틀랜드|Portland Union Station (PDX) · 오리건|portland union oregon pdx|Portland, Oregon
시애틀|시애틀|Seattle King Street (SEA) · 미국|seattle king street sea|Seattle
터코마|터코마|Tacoma Dome (TAC) · 미국|tacoma dome tac|Tacoma
에버렛|에버렛|Everett (EVR) · 미국|everett evr|Everett, Washington
벨링햄|벨링햄|Bellingham (BEL) · 미국|bellingham bel|Bellingham
스포캔|스포캔|Spokane (SPK) · 미국|spokane spk|Spokane
유진|유진|Eugene (EUG) · 미국|eugene eug|Eugene, Oregon
웨스트글레이셔|웨스트글레이셔|West Glacier (WGL) · 글레이셔 국립공원|west glacier wgl 글레이셔|West Glacier
밴쿠버|밴쿠버|Vancouver Pacific Central (VAC) · 캐나다|vancouver pacific central vac canada|Vancouver, British Columbia
`;

const BUS = `
서울경부|서울|서울고속버스터미널 (경부·영동선)|seoul 강남 고속터미널 gangnam
센트럴시티|서울|센트럴시티터미널 (호남선)|seoul central city 강남 고속터미널
동서울|서울|동서울종합터미널|dongseoul seoul 강변
서울남부|서울|서울남부터미널|nambu seoul
상봉|서울|상봉터미널|sangbong seoul
인천|인천|인천종합버스터미널|incheon
수원|수원|수원종합버스터미널|suwon
성남|성남|성남종합버스터미널|seongnam
고양백석|고양|고양백석 고속버스터미널|goyang baekseok
의정부|의정부|의정부 고속버스터미널|uijeongbu
평택|평택|평택 고속버스터미널|pyeongtaek
천안|천안|천안종합버스터미널|cheonan
온양|아산|온양 고속버스터미널|onyang asan
대전복합|대전|대전복합터미널|daejeon
세종|세종|세종터미널|sejong
청주|청주|청주고속버스터미널|cheongju
공주|공주|공주종합버스터미널|gongju
서산|서산|서산공용버스터미널|seosan
전주|전주|전주고속버스터미널|jeonju
군산|군산|군산고속버스터미널|gunsan
익산|익산|익산고속버스터미널|iksan
정읍|정읍|정읍고속버스터미널|jeongeup
남원|남원|남원고속버스터미널|namwon
광주|광주|광주종합버스터미널 (유스퀘어)|gwangju u-square
목포|목포|목포종합버스터미널|mokpo
순천|순천|순천종합버스터미널|suncheon
여수|여수|여수종합버스터미널|yeosu
동대구|대구|동대구복합환승센터|dongdaegu daegu
서대구|대구|서대구고속버스터미널|seodaegu daegu
부산|부산|부산종합버스터미널 (노포)|busan nopo
서부산|부산|서부산종합버스터미널 (사상)|seobusan sasang busan
울산|울산|울산고속버스터미널|ulsan
경주|경주|경주고속버스터미널|gyeongju
포항|포항|포항고속버스터미널|pohang
창원|창원|창원종합버스터미널|changwon
마산|창원|마산고속버스터미널|masan changwon
진주|진주|진주고속버스터미널|jinju
통영|통영|통영종합버스터미널|tongyeong
거제|거제|거제 고현버스터미널|geoje gohyeon
안동|안동|안동터미널|andong
강릉|강릉|강릉고속버스터미널|gangneung
속초|속초|속초고속버스터미널|sokcho
동해|동해|동해종합버스터미널|donghae
삼척|삼척|삼척종합버스터미널|samcheok
원주|원주|원주고속버스터미널|wonju
춘천|춘천|춘천시외버스터미널|chuncheon
`;

// 미국 고속버스: 회사마다 정류장이 자주 바뀌어서 도시 단위로 넣어요
const BUS_US = `
뉴욕|뉴욕|New York Port Authority 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|new york port authority nyc|New York
워싱턴 DC|워싱턴 DC|Washington Union Station 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|washington dc union|Washington, DC
보스턴|보스턴|Boston South Station 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|boston south|Boston
필라델피아|필라델피아|Philadelphia 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|philadelphia|Philadelphia
볼티모어|볼티모어|Baltimore 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|baltimore|Baltimore
애틀랜틱시티|애틀랜틱시티|Atlantic City 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|atlantic city|Atlantic City
피츠버그|피츠버그|Pittsburgh 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|pittsburgh|Pittsburgh
시카고|시카고|Chicago 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|chicago|Chicago
디트로이트|디트로이트|Detroit 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|detroit|Detroit
클리블랜드|클리블랜드|Cleveland 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|cleveland|Cleveland
콜럼버스|콜럼버스|Columbus 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|columbus ohio|Columbus, Ohio
인디애나폴리스|인디애나폴리스|Indianapolis 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|indianapolis|Indianapolis
내슈빌|내슈빌|Nashville 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|nashville|Nashville
멤피스|멤피스|Memphis 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|memphis|Memphis
애틀랜타|애틀랜타|Atlanta 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|atlanta|Atlanta
올랜도|올랜도|Orlando 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|orlando|Orlando
마이애미|마이애미|Miami 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|miami|Miami
탬파|탬파|Tampa 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|tampa|Tampa
뉴올리언스|뉴올리언스|New Orleans 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|new orleans|New Orleans
휴스턴|휴스턴|Houston 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|houston|Houston
댈러스|댈러스|Dallas 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|dallas|Dallas
오스틴|오스틴|Austin 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|austin texas|Austin, Texas
샌안토니오|샌안토니오|San Antonio 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|san antonio|San Antonio
덴버|덴버|Denver 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|denver|Denver
솔트레이크|솔트레이크시티|Salt Lake City 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|salt lake city 솔트레이크시티|Salt Lake City
피닉스|피닉스|Phoenix 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|phoenix|Phoenix
투손|투손|Tucson 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|tucson|Tucson
라스베이거스|라스베이거스|Las Vegas 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|las vegas 라스베가스 베가스|Las Vegas
LA|LA|Los Angeles 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|los angeles la 엘에이 로스앤젤레스|Los Angeles
샌디에이고|샌디에이고|San Diego 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|san diego|San Diego
샌프란시스코|샌프란시스코|San Francisco 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|san francisco sf|San Francisco
오클랜드|오클랜드|Oakland 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|oakland|Oakland, California
새너제이|새너제이|San Jose 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|san jose 산호세|San Jose
새크라멘토|새크라멘토|Sacramento 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|sacramento|Sacramento
리노|리노|Reno 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|reno|Reno
포틀랜드|포틀랜드|Portland 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|portland oregon|Portland, Oregon
시애틀|시애틀|Seattle 버스 정류장 (Greyhound·FlixBus·Megabus) · 미국|seattle|Seattle
밴쿠버|밴쿠버|Vancouver 버스 정류장 (Greyhound·FlixBus·Megabus) · 캐나다|vancouver canada|Vancouver, British Columbia
토론토|토론토|Toronto 버스 정류장 (Greyhound·FlixBus·Megabus) · 캐나다|toronto canada|Toronto
몬트리올|몬트리올|Montreal 버스 정류장 (Greyhound·FlixBus·Megabus) · 캐나다|montreal canada|Montreal
`;

const parse = raw => raw.trim().split('\n').filter(Boolean).map(line => {
  const [name, city, full, en, geo] = line.split('|');
  return { name, city, full, en, geo };
});
export const STOPS = { train: parse(TRAIN + TRAIN_US), bus: parse(BUS + BUS_US) };

export function searchStops(kind, query, limit = 6) {
  const q = query.trim().toLowerCase().replace(/역$|터미널$/, '');
  if (!q) return [];
  const scored = [];
  for (const s of STOPS[kind] || []) {
    let score = 0;
    const name = s.name.toLowerCase();
    if (name === q) score = 100;
    else if (name.startsWith(q) || s.city.startsWith(q) || s.en.startsWith(q)) score = 80;
    else if (s.full.includes(q) || s.en.includes(q)) score = 40;
    if (score) scored.push([score, s]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map(([, s]) => s);
}

// 적어 둔 이름의 지역. 목록에 없으면 적은 이름을 그대로 써요.
export const stopCity = (kind, name) => (STOPS[kind] || []).find(s => s.name === name)?.city || name;
// 날씨·지도용 위치 검색어: 미국처럼 같은 도시 이름이 여러 곳인 경우 주까지 붙여 둔 이름
export const stopGeo = (kind, name) => (STOPS[kind] || []).find(s => s.name === name)?.geo;
