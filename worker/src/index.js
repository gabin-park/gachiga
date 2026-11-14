// 가치가 인스타 분석 서버
// GET /?url=<인스타 게시물·릴스 링크>
//   → { author, caption, places: [{ name, query, city, category, address, note }] }
// GET /?tr=<한국어로 적은 장소 이름>&trip=<여행지 도시>
//   → { names: ['一蘭 新宿', 'Ichiran Shinjuku'] }  지도 검색이 현지어만 알아서, 현지 표기·영어 이름으로 바꿔 줘요.
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
    if (params.get('tr')) {
      const q = params.get('tr').slice(0, 60), city = (params.get('trip') || '').slice(0, 40);
      const names = await localNames(env, q, city).catch(e => { console.log(JSON.stringify({ tr: q, error: String(e.message || e) })); return []; });
      console.log(JSON.stringify({ tr: q, city, names }));
      return reply({ names });
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
- 여행지가 영어권이면 local과 en을 같게 써도 돼.`;
const TR_SCHEMA = { type: 'object', properties: { local: { type: 'string' }, en: { type: 'string' } }, required: ['local', 'en'] };
export async function localNames(env, q, city) {
  const out = await env.AI.run(MODEL, {
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
  return [...new Set([clean(data?.local), clean(data?.en)].filter(n => n && n !== q))];
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
