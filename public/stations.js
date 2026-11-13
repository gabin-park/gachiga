// 기차역·고속버스 터미널 목록: 티켓에 쓰는 이름|지역|정식 이름|검색어
// 목록에 없는 곳도 이름을 그대로 적으면 쓸 수 있어요. 지역은 날씨·지도 위치를 찾을 때 써요.
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

const parse = raw => raw.trim().split('\n').map(line => {
  const [name, city, full, en] = line.split('|');
  return { name, city, full, en };
});
export const STOPS = { train: parse(TRAIN), bus: parse(BUS) };

export function searchStops(kind, query, limit = 6) {
  const q = query.trim().toLowerCase().replace(/역$|터미널$/, '');
  if (!q) return [];
  const scored = [];
  for (const s of STOPS[kind] || []) {
    let score = 0;
    if (s.name === q) score = 100;
    else if (s.name.startsWith(q) || s.city.startsWith(q) || s.en.startsWith(q)) score = 80;
    else if (s.full.includes(q) || s.en.includes(q)) score = 40;
    if (score) scored.push([score, s]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map(([, s]) => s);
}

// 적어 둔 이름의 지역. 목록에 없으면 적은 이름을 그대로 써요.
export const stopCity = (kind, name) => (STOPS[kind] || []).find(s => s.name === name)?.city || name;
