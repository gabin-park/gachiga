// 가치가 인스타 분석 서버
// GET /?url=<인스타 게시물·릴스 링크>
//   → { author, caption, places: [{ name, query, city, category, address, note }] }
// GET /?tr=<한국어로 적은 장소 이름>&trip=<여행지 도시>
//   → { names: ['一蘭 新宿', 'Ichiran Shinjuku'], city: 'Tokyo' }  지도 검색이 현지어만 알아서, 현지 표기·영어 이름으로 바꿔 줘요.
//     city는 그 장소가 있는 도시(영어). 여행지를 모를 때 그 도시 근처에서 찾는 데 써요.
// GET /?ko=<후보 목록: 줄마다 '이름<TAB>주소'>
//   → { items: [{ name: '스타벅스', area: '시부야구 진구마에' }] }  현지어 후보를 한국어로 읽을 수 있게 바꿔 줘요(같은 순서).
// GET /?gmaps=<구글맵 공유 링크>
//   → { url, lat, lng, name }  짧은 링크(maps.app.goo.gl)를 열어 좌표를 읽어 줘요(사파리에서는 직접 못 열어서).
// 1) 인스타 공식 임베드 페이지에서 본문 글(캡션)을 읽고
// 2) Workers AI로 글 속 장소를 뽑아, 지도 검색이 잘 되는 이름(query)도 같이 돌려줍니다.
// 사파리에서는 인스타 페이지를 직접 읽을 수 없어서(교차 출처 차단) 이 서버가 대신 읽어요.

const ALLOWED_ORIGINS = [
  'https://gachiga-trip.web.app',
  'https://gachiga-trip.firebaseapp.com',
  'http://localhost:5189', // 로컬 데모 확인용
  'http://localhost:5190', // 로컬 개발 서버
];
// 테스트용 미리보기 주소(gachiga-trip--이름-xxxx.web.app)도 받아요.
const allowed = origin => ALLOWED_ORIGINS.includes(origin) || /^https:\/\/gachiga-trip--[a-z0-9-]+\.web\.app$/.test(origin);
const GMAPS_RE = /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i;
const IG_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i;
const CATEGORIES = ['food', 'cafe', 'sight', 'stay', 'shop', 'etc'];
export const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// 지도 검색어·주소 번역용. 짧은 번역은 이쪽이 3배쯤 빠르고, 일본 밖 지명(침사추이, 호이안)도 더 잘 알아들어요.
export const FAST_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const reply = (body, status = 200) => Response.json(body, { status, headers: cors });

    // 남이 무료 한도를 써 버리지 않게, 가치가 화면에서 온 요청만 받습니다.
    if (!allowed(origin)) return reply({ error: 'forbidden' }, 403);

    const params = new URL(request.url).searchParams;
    if (params.get('ko')) {
      const rows = params.get('ko').split('\n').slice(0, 8).map(l => l.split('\t').map(v => v.slice(0, 160)));
      const items = await koreanLabels(env, rows).catch(e => { console.log(JSON.stringify({ ko: rows.length, error: String(e.message || e) })); return []; });
      return reply({ items });
    }
    if (params.get('tr')) {
      const q = params.get('tr').slice(0, 60), city = (params.get('trip') || '').slice(0, 40);
      // 같은 여행지에서 같은 말로 찾은 적이 있으면(누구든) 저장해 둔 번역을 바로 줘요.
      const kvKey = `tr6:${city}|${q}`; // tr5: 동네(area)까지 들어 있고, 빠른 모델로 바꾼 번역
      const saved = await env.KO_WORDS?.get(kvKey, 'json').catch(() => null);
      if (saved) return reply(saved);
      const out = await localNames(env, q, city).catch(e => { console.log(JSON.stringify({ tr: q, error: String(e.message || e) })); return { names: [], city: '' }; });
      console.log(JSON.stringify({ tr: q, trip: city, ...out }));
      if (out.names.length) await env.KO_WORDS?.put(kvKey, JSON.stringify(out)).catch(() => {});
      return reply(out);
    }
    if (params.get('gmaps')) {
      const out = await resolveGmaps(params.get('gmaps')).catch(e => ({ error: String(e.message || e) }));
      console.log(JSON.stringify({ gmaps: params.get('gmaps').slice(0, 80), ok: Number.isFinite(out.lat) }));
      return reply(out, out.error === 'not-gmaps' ? 400 : 200);
    }
    const code = params.get('url')?.match(IG_RE)?.[1];
    const trip = (params.get('trip') || '').slice(0, 40); // 여행지 도시(예: 도쿄) — 장소의 도시를 짐작하는 데 써요
    if (!code) return reply({ error: 'not-instagram' }, 400);

    let post;
    try {
      post = await readCaption(code);
    } catch (e) {
      console.log(JSON.stringify({ code, result: 'instagram-blocked', detail: String(e.message || e) }));
      return reply({ error: 'instagram-blocked', detail: String(e.message || e) }, 502);
    }
    // 실패 원인을 찾을 수 있게 결과만 짧게 남겨요(Cloudflare 대시보드 > Workers > gachiga-ig > Logs).
    const log = extra => console.log(JSON.stringify({ code, author: post.author, captionLength: post.caption.length, ...extra }));
    if (!post.caption) { log({ result: 'no-caption' }); return reply({ ...post, places: [] }); }

    try {
      const places = await findPlaces(env, post, trip);
      log({ result: 'ok', places: places.map(p => p.name) });
      return reply({ ...post, places });
    } catch (e) {
      log({ result: 'ai-failed', detail: String(e.message || e) });
      return reply({ ...post, places: [], error: 'ai-failed', detail: String(e.message || e) });
    }
  },
};

// 한국어로 적은 장소 이름 → 지도에서 찾히는 현지 표기와 영어 이름
const TR_PROMPT = `너는 여행 앱의 지도 검색 도우미야. 한국 사람이 해외 장소 이름을 한국어로 적었어.
지도 검색에서 그 장소가 나오도록, 그 나라에서 실제로 쓰는 표기(local)와 영어 공식 이름(en)으로 바꿔.
규칙:
- 가게·체인점이면 브랜드 이름 + 지점·동네까지. 예: "이치란 라멘 신주쿠" → local "一蘭 新宿", en "Ichiran Shinjuku".
- 관광지·역·동네도 같은 방식. 예: "청수사" → local "清水寺", en "Kiyomizu-dera".
- 잘 모르는 이름이면 소리 나는 대로 현지 글자와 영어로 옮겨. 지어낸 지점이나 주소는 붙이지 마.
- local은 그 장소가 있는 나라의 말로(일본 → 일본어, 프랑스 → 프랑스어 "Tour Eiffel", 태국 → 태국어). 한자는 일본·중국·대만·홍콩 장소일 때만 써.
- 여행지가 영어권이면 local과 en을 같게 써도 돼.
- city: 그 장소가 있는 도시의 영어 이름(예: "Tokyo", "Kyoto"). [여행지]가 있으면 보통 그 도시. 모르면 빈 문자열.
- country: 그 장소가 있는 나라의 영어 이름(예: "Japan", "Spain").
- area: 적은 말에 동네·지역 이름이 들어 있으면 그 동네를 현지 표기로(예: "돈키호테 시부야" → "渋谷", "스타벅스 소호" → "SoHo"). [여행지]와 다른 근처 도시를 적었어도 그 도시를 넣어(여행지 다낭에서 "반미 호이안" → "Hội An"). 동네 이름이 없거나 장소 이름 자체가 동네면 빈 문자열.`;
const TR_SCHEMA = { type: 'object', properties: { local: { type: 'string' }, en: { type: 'string' }, city: { type: 'string' }, country: { type: 'string' }, area: { type: 'string' } }, required: ['local', 'en', 'city', 'country', 'area'] };
export async function localNames(env, q, city) {
  const out = await env.AI.run(FAST_MODEL, {
    messages: [
      { role: 'system', content: TR_PROMPT },
      { role: 'user', content: `${city ? `[여행지: ${city}]\n` : ''}${q}` },
    ],
    response_format: { type: 'json_schema', json_schema: TR_SCHEMA },
    max_tokens: 120,
    temperature: 0,
  });
  let data = out?.response;
  if (typeof data === 'string') { try { data = JSON.parse(data.match(/\{[\s\S]*\}/)?.[0] || data); } catch { data = {}; } }
  const clean = v => (typeof v === 'string' ? v.trim().slice(0, 80) : '');
  // AI가 가끔 다른 나라 글자로 옮겨요(사그라다 파밀리아 → サグラダ・ファミリア). 그 나라 글자가 아니면 현지 이름은 버리고 영어 이름만 써요.
  const country = clean(data?.country);
  const wrongScript = t => (/[\u3040-\u30ff]/.test(t) && country !== 'Japan') || (/[\u4e00-\u9fff]/.test(t) && !/^(Japan|China|Taiwan|Hong Kong|Macau|Macao)$/.test(country)) || /[가-힣]/.test(t);
  const local = wrongScript(clean(data?.local)) ? '' : clean(data?.local);
  const area = wrongScript(clean(data?.area)) ? '' : clean(data?.area);
  return { names: [...new Set([local, clean(data?.en)].filter(n => n && n !== q))], city: clean(data?.city).slice(0, 40), area: area.slice(0, 40) };
}

// 현지어 장소 후보 → 한국어 이름과 주소
// AI에게 주소 전체를 맡기면 동네·번지를 자주 빼먹어요. 그래서 AI는 낱말 번역만 하고,
// 주소를 나누고 순서를 맞추고 번지 숫자를 붙이는 일은 여기서 코드로 해요.
const KO_PROMPT = `너는 여행 앱 도우미야. 해외 지도에 나온 낱말(가게 이름, 브랜드, 구·동네·길 이름, 도시 이름)을 한국 사람이 읽을 수 있게 한국어로 옮겨.
번호 붙은 낱말을 받으면, 같은 순서·같은 개수로 한국어만 ko 배열에 담아 돌려줘.
- 브랜드는 한국 표기(スターバックス → 스타벅스, McDonald's → 맥도날드).
- 고유 이름은 현지 발음을 한국어로(清水寺 → 기요미즈데라, 一蘭 → 이치란, 神宮前 → 진구마에, Rue de Rivoli → 리볼리 거리, Pike Street → 파이크 스트리트). 일본 한자는 일본어 발음으로 읽어.
- 일본 행정 이름: 渋谷区 → 시부야구, 成田市 → 나리타시, 神宮前四丁目 → 진구마에 4초메, 港区 → 미나토구, 中央区 → 주오구, 宇田川町 → 우다가와초, 新宿中央通り → 신주쿠 주오도리(通り는 도리). 한자·가나를 남기지 마.
- 프랑스 구: 1er Arrondissement → 1구.
- 중국·대만·홍콩 가게는 한국에서 부르는 이름으로(添好運 → 팀호완, 鼎泰豐 → 딘타이펑). 베트남어는 소리대로(Phượng → 프엉, Chợ Hàn → 한 시장, Chợ는 시장).
- 이미 한국어거나 쉬운 영어면 그대로. 지어내거나 빼지 말고 받은 낱말만 옮겨.`;
const KO_SCHEMA = {
  type: 'object',
  properties: { ko: { type: 'array', items: { type: 'string' } } },
  required: ['ko'],
};
const POSTCODE = /^[A-Z]{0,2}\d{3}-?\d{4}$|^\d{4,6}(-\d{4})?$|^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i;
const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;
const CLEAN = /^[가-힣a-zA-Z0-9\s.,'&·()\-]+$/;
const NUMBER = /^\d[\d\s-]*[a-z]?$/i;
// "3 4, 神宮前四丁目, 渋谷区, 東京都, 日本" → 작은 곳부터 [번지, 동네, 구] (나라·주·우편번호·가게 이름은 빼요)
function addressParts(name, address) {
  // 베트남 주소의 '주민 그룹(Tổ dân phố)'은 길 찾기에 안 쓰여서 빼요.
  let parts = address.split(',').map(p => p.trim()).filter(p => p && p !== name && !POSTCODE.test(p) && !/^Tổ dân phố/i.test(p));
  parts = parts.filter((p, i) => !parts.slice(0, i).some(q => q.startsWith(p))); // 西原三丁目 다음의 西原처럼 겹치는 건 빼요
  if (parts.length > 1) parts = parts.slice(0, -1); // 나라
  if (parts.length > 1) parts = parts.slice(0, -1); // 주·도
  return parts.slice(0, 4).map(p => {
    if (NUMBER.test(p)) return { num: p.replace(/\s+/g, '-') }; // 일본 번지 "24 12" → 24-12
    const m = p.match(/^(.*\D)\s+(\d[\w-]*)$/); // "Pike Street 1912" → 길 이름 + 번지
    return m ? { word: m[1], num: m[2] } : { word: p };
  });
}
export async function koreanLabels(env, rows) {
  const split = rows.map(([name, address = '']) => ({ name, parts: addressParts(name, address) }));
  const words = [...new Set(split.flatMap(r => [r.name, ...r.parts.map(p => p.word)]).filter(w => w && /\p{L}/u.test(w) && !/[가-힣]/.test(w)))].slice(0, 40);
  // 누가 한 번 옮긴 낱말은 KV에 모아 두고 다음부터 AI 없이 바로 써요.
  const kvKey = w => `ko6:${w}`.slice(0, 480); // ko6: 빠른 모델로 바꾸고 답 검사를 늘리면서 예전 답은 버려요
  const saved = env.KO_WORDS ? await Promise.all(words.map(w => env.KO_WORDS.get(kvKey(w)).catch(() => null))) : [];
  const ko = new Map(words.map((w, i) => [w, saved[i]]).filter(([, v]) => v));
  const todo = words.filter(w => !ko.has(w));
  // 낱말이 많으면 4개씩 나눠 동시에 물어봐요. 한 번에 길게 쓰게 하면 그만큼 오래 걸려요.
  const ask = (list, temperature) => {
    const groups = [];
    for (let i = 0; i < list.length; i += 4) groups.push(list.slice(i, i + 4));
    return Promise.all(groups.map(group => askGroup(group, temperature)));
  };
  const askGroup = async (group, temperature) => {
    const out = await env.AI.run(FAST_MODEL, {
      messages: [
        { role: 'system', content: KO_PROMPT },
        { role: 'user', content: group.map((w, i) => `${i + 1}. ${w}`).join('\n') },
      ],
      response_format: { type: 'json_schema', json_schema: KO_SCHEMA },
      max_tokens: 200,
      temperature,
    }).catch(() => null);
    let data = out?.response;
    if (typeof data === 'string') { try { data = JSON.parse(data.match(/\{[\s\S]*\}/)?.[0] || data); } catch { data = {}; } }
    // AI가 가끔 붙이는 "1. " 번호는 떼요.
    const got = Array.isArray(data?.ko) ? data.ko.map(v => String(v || '').replace(/^\s*\d+[.)]\s*/, '').trim().slice(0, 40)) : [];
    // 개수가 안 맞으면 어느 게 어느 건지 몰라서 버려요(원래 글자로 보여줘요).
    if (got.length !== group.length) return;
    await Promise.all(group.map((w, i) => {
      // 한글·영문·숫자로만 된 답만 써요. 한자·가나가 남거나(중앙通り) 엉뚱한 글자가 섞이면(민ато구)
      // 원래 글자로 두고 저장하지 않아요. 다음에 다시 물어봐요.
      // 일본어를 영어로 바꾼 답(銀座 → ginza), 한 낱말에 한글과 영문이 섞인 답(응uyen)도 버려요
      if (!CLEAN.test(got[i]) || (CJK.test(w) && /[a-z]/i.test(got[i])) || /[가-힣][a-z]|[a-z][가-힣]/i.test(got[i])) return null;
      ko.set(w, got[i]);
      return env.KO_WORDS?.put(kvKey(w), got[i]).catch(() => {});
    }));
  };
  await ask(todo, 0);
  // 걸러진 낱말은 한 번만 다시 물어봐요(같은 답이 나오지 않게 조금 다르게).
  const miss = todo.filter(w => !ko.has(w));
  if (miss.length) await ask(miss, 0.4);
  // 못 옮긴 낱말: 영어 같은 로마자는 읽을 수 있어서 그대로 두고, 한자·가나·타이 문자 등은 그 부분을 빼요.
  // 안 빼면 '다이토구 아사쿠사 2초메 馬道通り'처럼 한 줄에 섞여요. 다 빠지면 앱이 원래 주소를 보여줘요.
  const readable = w => !/[^\p{Script=Latin}\p{Script=Hangul}\p{N}\p{P}\p{Zs}]/u.test(w);
  // AI가 丁目의 숫자를 '삼초메'처럼 한글로 쓸 때가 있어서 '3초메'로 맞춰요(이미 저장된 답도 여기서 고쳐져요).
  const NUM = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
  const chome = t => t.replace(/(^|\s)(십)?([일이삼사오육칠팔구])?초메/g, (all, sp, ten, one) =>
    ten || one ? `${sp}${(ten ? 10 : 0) + (NUM[one] || 0)}초메` : all);
  const say = w => chome(ko.get(w) || (readable(w) ? w : ''));
  return split.map(r => ({
    name: ko.get(r.name) || (/[가-힣]/.test(r.name) ? r.name : ''), // 이미 한국어 이름(에펠탑)이면 그대로
    area: r.parts.reverse().filter(p => !p.word || say(p.word)).map(p => [p.word && say(p.word), p.num].filter(Boolean).join(' ')).join(' ').slice(0, 80),
  }));
}

// 공개 게시물의 임베드(본문 포함) 페이지에서 작성자와 본문을 꺼냅니다.
export async function readCaption(code) {
  const res = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
  });
  if (!res.ok) throw new Error(`instagram ${res.status}`);
  return parseEmbed(await res.text());
}

export function parseEmbed(html) {
  const block = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/)?.[1]
    || html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
  const author = block.match(/class="CaptionUsername"[^>]*>([^<]+)</)?.[1]?.trim() || '';
  const caption = decode(block
    .replace(/<a[^>]*class="CaptionUsername"[^>]*>[^<]*<\/a>/, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { author, caption };
}

const decode = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export const PROMPT = `너는 여행 앱의 도우미야. 인스타그램 게시물 본문에서 "가 볼 수 있는 실제 장소"(가게, 카페, 식당, 관광지, 숙소, 상점 등)만 골라.
규칙:
- 본문에 이름이 분명히 나온 곳만. 지어내지 마. 도시·나라 이름 자체, 해시태그 나열, 브랜드 일반명은 장소가 아니야.
- name: 본문에 쓰인 이름 그대로(한국어면 한국어).
- query: 지도에서 검색하면 그 장소가 나올 이름. 현지 표기나 영어 공식 이름 + 지점/동네. 예: "Ichiran Shibuya", "東京タワー", "Blue Bottle Coffee Seongsu".
- city: 본문이나 맥락으로 알 수 있으면 영어로. 본문에 없으면 [여행지 힌트]의 도시를 영어로. 그것도 없으면 빈 문자열.
- category: food(식당) cafe(카페·디저트·술집) sight(구경·관광) stay(숙소) shop(쇼핑) etc(그 외) 중 하나.
- address: 본문에 그 장소의 주소가 적혀 있으면 그대로(📍 뒤나 '주소' 뒤에 오는 글), 없으면 빈 문자열.
- note: 본문에 나온 그 장소 관련 짧은 팁(메뉴, 웨이팅, 위치 등) 한 줄, 없으면 빈 문자열. 한국어로. 팁이 없으면 꼭 빈 문자열(분류 제목이나 지어낸 말 금지).
- 맛집 총정리처럼 이름만 줄줄이 나열된 목록도 하나하나 모두 장소야. 빠짐없이 넣어.
- [작성자]가 가게·호텔 같은 장소 자체의 계정으로 보이고(예: @kappa.tokyo, @bluebottle_shibuya) 본문이 그 가게 소개라면, 그 가게를 장소로 넣어.
- 장소가 없으면 places를 빈 배열로.`;

export const SCHEMA = {
  type: 'object',
  properties: {
    places: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          query: { type: 'string' },
          city: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          address: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['name', 'query', 'city', 'category', 'address', 'note'],
      },
    },
  },
  required: ['places'],
};

async function findPlaces(env, { caption, author }, trip) {
  const out = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: `${trip ? `[여행지 힌트: ${trip}]\n` : ''}${author ? `[작성자: @${author}]\n` : ''}${caption.slice(0, 3000)}` },
    ],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
    max_tokens: 6000, // 맛집 총정리처럼 수십 곳이 나와도 답이 중간에 끊기지 않게
    temperature: 0.1,
  });
  return cleanPlaces(out?.response);
}

// AI 답은 객체나 JSON 글자로 오고, 모양이 조금 틀릴 수 있어서 한 번 다듬습니다.
export function cleanPlaces(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw); } catch {
      // 답이 길어서 끝이 잘렸으면, 온전한 장소만 하나씩 건져요.
      data = { places: (raw.match(/\{[^{}]*"name"[^{}]*\}/g) || []).map(t => { try { return JSON.parse(t); } catch { return null; } }) };
    }
  }
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const seen = new Set();
  return (Array.isArray(data?.places) ? data.places : [])
    .map(p => ({
      name: str(p?.name).slice(0, 60),
      query: str(p?.query).slice(0, 100),
      city: str(p?.city).slice(0, 40),
      category: CATEGORIES.includes(p?.category) ? p.category : 'etc',
      address: str(p?.address).slice(0, 150),
      note: str(p?.note).length > 3 ? str(p?.note).slice(0, 200) : '', // 분류 이름 같은 짧은 글은 버려요
    }))
    .filter(p => p.name && !seen.has(p.name) && seen.add(p.name))
    .slice(0, 50);
}

// 구글맵 링크: 리다이렉트를 따라가며 주소창에 좌표가 나오면 바로 돌려줘요.
// 끝까지 좌표가 없으면 장소 이름만 돌려줘요.
export async function resolveGmaps(link) {
  if (!GMAPS_RE.test(link)) return { error: 'not-gmaps' };
  let url = link;
  for (let i = 0; i < 6; i++) {
    const found = gmapsCoords(url);
    if (found) return { url, ...found, name: gmapsName(url) };
    // 구글 본 페이지는 서버에서 열면 막혀요(/sorry). 좌표가 없으면 이름만 돌려주고 화면에서 이름으로 찾아요.
    if (!/(^|\.)goo\.gl$/.test(new URL(url).hostname)) return { url, lat: null, lng: null, name: gmapsName(url) };
    const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' } });
    const next = res.headers.get('Location');
    if (res.status >= 300 && res.status < 400 && next) {
      const to = new URL(next, url);
      // 유럽 등에서 동의 페이지로 보내면, 원래 가려던 주소(continue)로 갈아타요.
      url = (to.hostname.startsWith('consent.') || to.pathname.startsWith('/sorry')) && to.searchParams.get('continue') ? to.searchParams.get('continue') : to.href;
      continue;
    }
    return { url, lat: null, lng: null, name: gmapsName(url) };
  }
  return { url, lat: null, lng: null, name: gmapsName(url) };
}

export function gmapsCoords(u) {
  const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || u.match(/[?&](?:q|query|ll|center|daddr)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}

function gmapsName(u) {
  try {
    const place = u.match(/\/maps\/place\/([^/@?]+)/)?.[1];
    if (place) return decodeURIComponent(place.replace(/\+/g, ' ')).slice(0, 80);
    const q = new URL(u).searchParams.get('q');
    return q && !/^-?\d+\.\d+,/.test(q) ? q.slice(0, 80) : '';
  } catch { return ''; }
}
