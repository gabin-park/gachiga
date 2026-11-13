import { store, isDemo } from './store.js';
import { airportByCode, searchAirports, guessAirport, cityOfCode } from './airports.js';
import { searchStops, stopCity } from './stations.js';
import { tripScene } from './scenes.js';

const KINDS = ['events', 'places', 'expenses'];
// 장소 종류: 지도 핀·카드에 같은 색과 선 아이콘(ICONS의 cat_*)을 써요
const CATEGORIES = [
  { id: 'food', label: '맛집', color: '#f06a2c' },
  { id: 'cafe', label: '카페', color: '#a8743a' },
  { id: 'sight', label: '구경', color: '#7c5cd6' },
  { id: 'stay', label: '숙소', color: '#1098ad' },
  { id: 'shop', label: '쇼핑', color: '#d6336c' },
  { id: 'etc', label: '기타', color: '#2f9e44' },
];
// 비행기 모양 (24×24)
const PLANE = 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';
// 인스타 글을 읽고 장소를 뽑아 주는 Cloudflare 서버(worker/). 비워 두면 반자동(게시물 보며 이름 적기)으로 동작해요.
const IG_API = 'https://gachiga-ig.gachiga-trip.workers.dev/';
// 인스타 게시물·릴스 링크 (첫 화면을 그릴 때 공유받은 링크를 읽느라 위쪽에 둡니다)
const DAY_COLOR = '#3a86ff'; // 일정 지도 핀·길 색(모든 날 같은 색)
const IG_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i;
const CURRENCIES = [
  ['KRW', '한국 원'], ['JPY', '일본 엔'], ['USD', '미국 달러'], ['EUR', '유로'], ['TWD', '대만 달러'], ['THB', '태국 바트'],
  ['VND', '베트남 동'], ['CNY', '중국 위안'], ['HKD', '홍콩 달러'], ['SGD', '싱가포르 달러'], ['PHP', '필리핀 페소'],
  ['GBP', '영국 파운드'], ['AUD', '호주 달러'], ['CAD', '캐나다 달러'], ['CHF', '스위스 프랑'], ['MYR', '말레이시아 링깃'],
];
// 환율·날씨는 받아 온 뒤 화면을 다시 그려요. (첫 화면을 그릴 때도 쓰여서 위에 둬요)
let fxRates = null; // { time, updated, rates: 1원당 외화 }
let guideRoot = null; // 사용법 슬라이드 창
let installPrompt = null; // 안드로이드 크롬·삼성 인터넷의 '앱 설치' 창 (beforeinstallprompt)
// 카톡·인스타처럼 앱 안에서 열린 브라우저. 구글이 여기선 로그인을 막아요.
const IN_APP = (() => {
  const ua = navigator.userAgent, android = /Android/.test(ua);
  const name = /KAKAOTALK/i.test(ua) ? '카톡' : /Instagram/.test(ua) ? '인스타' : /FBAN|FBAV|FB_IAB/.test(ua) ? '페이스북'
    : /Line\//.test(ua) ? '라인' : /NAVER\(inapp|DaumApps|everytimeApp/.test(ua) || (android && /; wv\)/.test(ua)) ? '이 앱' : '';
  return name ? { name, android, kakao: name === '카톡' } : null;
})();
const tipsSeen = (() => { try { return JSON.parse(localStorage.getItem('gachiga-tips') || '{}'); } catch { return {}; } })(); // 닫은 탭 팁
const fxState = { loading: false, failAt: 0, cur: '', amount: '' };
const wx = { for: '', days: null };
const PROFILE_COLORS = ['#13294b', '#2f9e8f', '#3b82c4', '#5b6fd6', '#8b5cc7', '#c2559a', '#e0565b', '#ff7a59', '#e69a28', '#8a7a3a', '#6b7280', '#2b3a42'];
const TABS = [
  { id: 'timeline', label: '일정', icon: 'calendar' },
  { id: 'places', label: '장소', icon: 'compass' },
  { id: 'expenses', label: '정산', icon: 'wallet' },
];
const HANDLE_RE = /^[a-z0-9_.]{3,20}$/;

// 선으로 그린 아이콘 (24×24, currentColor)
const ICONS = {
  m_plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  m_car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  m_bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  m_train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
  cat_food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  cat_cafe: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
  cat_sight: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  cat_stay: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  cat_shop: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  cat_etc: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2Z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 3.5a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M22 11h-6"/>',
  userMinus: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M22 11h-6"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3Z"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  wx_sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  wx_partly: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  wx_cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  wx_fog: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 17H7M17 21H9"/>',
  wx_rain: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6M8 14v6M12 16v6"/>',
  wx_snow: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
  wx_storm: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 1.5 8.74"/><path d="m13 12-3 5h4l-3 5"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  nav: '<path d="M3 11 22 2l-9 19-2-8-8-2Z"/>',
  pin: '<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  insta: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-10 6L2 7"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  crown: '<path d="m2 7 4.5 10h11L22 7l-5.5 4L12 4l-4.5 7Z"/><path d="M6.5 20h11"/>',
};
const icon = (name, size = 20) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// 장소의 종류들. 예전 장소는 category 하나만 있어요. 첫 번째가 지도 핀·아이콘에 쓰는 대표 종류예요.
function placeCats(p) { return p.categories?.length ? p.categories : [p.category || 'etc']; }
function catOf(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES.at(-1); }
// 연한 색 타일 위에 그 종류 색의 선 아이콘
function catTile(id, size = 20) {
  const c = catOf(id);
  return `<span class="cat-tile" style="--c:${c.color}">${icon('cat_' + c.id, size)}</span>`;
}

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');
const $toast = document.getElementById('toast');

const state = {
  user: undefined, // undefined = 확인 중, null = 로그아웃
  profile: null,
  friends: [],
  requestsIn: [],
  requestsOut: [],
  invites: [],
  trips: [],
  view: 'home',
  tripId: null,
  trip: null,
  events: [],
  places: [],
  expenses: [],
  tab: 'timeline',
  placeFilter: 'all',
  mapDay: '', // 일정 지도에서 고른 날짜 ('' = 자동, 'all' = 전체)
};
let unsubUser = [];
let unsubTrip = [];
// 열린 시트의 저장 · 위험 동작 · 실시간 다시 그리기 함수
let sheetSubmit = null;
let sheetDanger = null;
let sheetLive = null;

// ---------- 유틸 ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = n => String(n).padStart(2, '0');
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 날짜·시간은 모두 이 휴대폰의 시간대 기준이에요. 한국에 있으면 한국 시간, 샌프란시스코에 있으면 그곳 시간.
const todayStr = () => toDateStr(new Date());
const zoneName = () => new Intl.DateTimeFormat('ko-KR', { timeZoneName: 'long' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
const clockLabel = () => new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(new Date());
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); };
const WEEK = '일월화수목금토';
const fmtDate = s => { const d = parseDate(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`; };
const fmtShort = s => { const d = parseDate(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
const groupBy = (list, fn) => list.reduce((m, x) => ((m[fn(x)] ||= []).push(x), m), {});
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const safeUrl = u => (/^https?:\/\//i.test(u) ? u : 'https://' + u);
const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99') || (a.createdAt || 0) - (b.createdAt || 0);
// 하루 일정 순서: 끌어서 정한 순서(order)가 있으면 그대로, 새로 넣은 일정은 시간에 맞는 자리에 끼워요.
function sortDay(list) {
  const base = [...list].sort(byTime);
  const ordered = base.filter(e => e.order != null).sort((a, b) => a.order - b.order);
  if (!ordered.length) return base;
  for (const e of base.filter(e => e.order == null)) {
    const at = e.time ? ordered.findIndex(o => o.time && o.time > e.time) : -1;
    ordered.splice(at < 0 ? ordered.length : at, 0, e);
  }
  return ordered;
}

const currency = () => state.trip?.currency || 'KRW';
const fmtCache = {};
const formatter = c => (fmtCache[c] ||= new Intl.NumberFormat('ko-KR', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }));
const money = n => formatter(currency()).format(n);
const minorUnit = () => 10 ** -formatter(currency()).resolvedOptions().maximumFractionDigits;
// 지출은 기록할 때의 통화로 저장하고, 화면에선 지금 고른 통화로 환산해서 보여줘요.
// 통화가 없는 예전 기록은 여행 통화로 적은 것으로 쳐요(통화를 바꿀 때 예전 통화를 붙여 둬요).
const xCur = x => x.currency || currency();
const xAmt = x => conv(Number(x.amount) || 0, xCur(x), currency());

const me = () => ({
  uid: state.user.uid,
  name: state.profile?.name || state.user.name,
  photo: state.profile?.photo ?? state.user.photo,
  handle: state.profile?.handle || '',
  color: state.profile?.color || '',
  showPhoto: state.profile?.showPhoto !== false,
});
const isOwner = (t = state.trip) => t?.ownerId === state.user?.uid;
const memberName = uid => state.trip?.memberInfo?.[uid]?.name || '알 수 없음';

// 다른 사람의 프로필(색·사진 설정)은 처음 화면에 나올 때 구독해 두고 바뀌면 바로 반영합니다.
const people = {};
let peopleSubs = {};
let renderQueued = false;
const queueRender = () => {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
};
function live(uid) {
  if (uid === state.user?.uid) return me();
  if (uid && state.user && !peopleSubs[uid]) {
    peopleSubs[uid] = store.watchProfile(uid, p => { people[uid] = p; queueRender(); }, () => {});
  }
  return people[uid];
}

function avatarOf(info, uid, cls = '') {
  const p = { ...info, ...live(uid) };
  const name = p.name || '?';
  if (p.photo && p.showPhoto !== false) return `<img class="avatar ${cls}" src="${esc(p.photo)}" alt="${esc(name)}" referrerpolicy="no-referrer">`;
  const bg = p.color ? `background:${esc(p.color)}` : `--h:${hue(uid)}`;
  return `<span class="avatar ${cls}" style="${bg}" title="${esc(name)}">${esc([...name][0])}</span>`;
}
const avatar = (uid, cls) => avatarOf(state.trip?.memberInfo?.[uid], uid, cls);

function personRow(p, actions = '') {
  return `
  <div class="person">
    ${avatarOf(p, p.uid, 'md')}
    <div class="person-body"><b>${esc(p.name)}</b>${p.handle ? `<span>@${esc(p.handle)}</span>` : ''}</div>
    <div class="person-actions">${actions}</div>
  </div>`;
}

function tripStatus(t) {
  if (!t.startDate) return { label: '날짜 미정', kind: 'tbd' };
  const toStart = dayDiff(todayStr(), t.startDate);
  if (toStart > 0) return { label: `D-${toStart}`, kind: 'soon' };
  if (dayDiff(todayStr(), t.endDate || t.startDate) >= 0) return { label: `DAY ${1 - toStart}`, kind: 'now' };
  return { label: '다녀옴', kind: 'past' };
}
const isPast = t => tripStatus(t).kind === 'past';

function dateRange(t) {
  if (!t.startDate) return '날짜를 정해보세요';
  if (!t.endDate || t.endDate === t.startDate) return fmtDate(t.startDate);
  const n = dayDiff(t.startDate, t.endDate);
  return `${fmtShort(t.startDate)} – ${fmtShort(t.endDate)} · ${n}박 ${n + 1}일`;
}

function defaultDate() {
  const t = state.trip, today = todayStr();
  if (t?.startDate && today >= t.startDate && today <= (t.endDate || t.startDate)) return today;
  return t?.startDate || today;
}

function relDay(d) {
  const n = dayDiff(todayStr(), d);
  return n === 0 ? '오늘' : n === 1 ? '내일' : fmtDate(d);
}

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2400);
}
function errorText(e) {
  if (e?.code === 'permission-denied') return '접근 권한이 없어요. 여행에서 나갔거나 내보내졌을 수 있어요.';
  if (e?.code === 'not-found') return '여행을 찾을 수 없어요.';
  if (e?.code === 'handle-taken') return '이미 누가 쓰고 있는 아이디예요.';
  return '문제가 생겼어요: ' + (e?.message || e);
}
function run(fn, okMsg) {
  return Promise.resolve().then(fn).then(() => { if (okMsg) toast(okMsg); }).catch(e => { console.error(e); toast(errorText(e)); });
}
function copyText(text, okMsg) {
  navigator.clipboard.writeText(text).then(() => toast(okMsg)).catch(() => prompt('복사하세요', text));
}

// ---------- 데이터 구독 & 라우팅 ----------

store.onAuth(async user => {
  unsubUser.forEach(u => u());
  unsubUser = [];
  Object.values(peopleSubs).forEach(u => u());
  peopleSubs = {};
  closeTrip();
  Object.assign(state, { user, profile: null, friends: [], requestsIn: [], requestsOut: [], invites: [], trips: [], tripsLoaded: false });
  if (!user) return route();
  render();
  try {
    state.profile = await store.ensureProfile(user);
  } catch (e) {
    console.error(e);
    toast(errorText(e));
    return;
  }
  const onErr = e => { console.error(e); toast(errorText(e)); };
  const set = key => value => { state[key] = value; render(); };
  unsubUser = [
    store.watchProfile(user.uid, p => { if (p) set('profile')(p); }, onErr),
    store.watchFriends(user.uid, set('friends'), onErr),
    store.watchFriendRequests(user.uid, 'in', set('requestsIn'), onErr),
    store.watchFriendRequests(user.uid, 'out', set('requestsOut'), onErr),
    store.watchTrips(user.uid, trips => { state.tripsLoaded = true; set('trips')(trips); }, onErr),
    store.watchTripInvites(user.uid, set('invites'), onErr),
  ];
  route();
});

function parseHash() {
  const [, kind = '', id, tab] = location.hash.split('/'); // #/trip/ID/places, #/me
  return { kind, id, tab };
}

function route() {
  if (!state.user || !state.profile) return render();
  const { kind, id, tab } = parseHash();
  state.view = kind === 'me' ? 'me' : kind === 'past' ? 'past' : 'home';
  if (kind === 'trip' && id) {
    state.tab = TABS.some(t => t.id === tab) ? tab : 'timeline';
    openTrip(id);
  } else {
    closeTrip();
  }
  render();
}
window.addEventListener('hashchange', route);

function openTrip(id) {
  if (state.tripId === id) return;
  closeTrip();
  state.tripId = id;
  const leave = msg => setTimeout(() => {
    if (state.tripId !== id) return;
    toast(msg);
    closeTrip();
    location.replace('#/');
  });
  const fail = e => leave(errorText(e));
  unsubTrip = [
    store.watchTrip(id, t => {
      if (!t) return leave('여행이 삭제됐어요.');
      if (!t.members.includes(state.user.uid)) return leave('이 여행의 멤버가 아니게 됐어요.');
      state.trip = t;
      render();
    }, fail),
    ...KINDS.map(k => store.watchItems(id, k, items => { state[k] = items; render(); }, fail)),
  ];
}

function closeTrip() {
  unsubTrip.forEach(u => u());
  unsubTrip = [];
  Object.assign(state, { tripId: null, trip: null, events: [], places: [], expenses: [], placeFilter: 'all', mapDay: '' });
}

// ---------- 화면 ----------

// 로고: 'ㄱ'자 항로 끝에 비행기. 가치가의 첫 글자이자 함께 가는 길이에요.
function logo(size = 34) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="가치가">
    <rect width="100" height="100" rx="24" fill="#13294B"/>
    <path d="M24 30H62Q72 30 72 40V60" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24" cy="30" r="9" fill="#3A86FF"/>
    <g transform="translate(72 74) rotate(180) scale(1.5) translate(-11.5 -12)" fill="#3A86FF"><path d="${PLANE}"/></g>
  </svg>`;
}

function render() {
  let view;
  if (state.user === undefined || (state.user && !state.profile)) view = 'splash';
  else if (!state.user) view = 'login';
  else if (!state.profile.handle) view = 'onboard';
  else if (state.tripId) view = 'trip';
  else view = state.view;

  // 입력 중인 폼이 있는 화면은 같은 화면이면 다시 그리지 않습니다.
  if (['login', 'onboard'].includes(view) && $app.dataset.view === view) return;
  $app.dataset.view = view;
  $app.innerHTML = view === 'splash' ? `<div class="splash">${logo(64)}</div>`
    : view === 'login' ? viewLogin()
    : view === 'onboard' ? viewOnboarding()
    : view === 'trip' ? viewTrip()
    : view === 'me' ? viewMe()
    : view === 'past' ? viewPast()
    : viewHome();
  mountMap();
  renderGuide(!['splash', 'login', 'onboard'].includes(view));
  if (view === 'trip') wantWeather();
  refreshLiveSheet();
  if (view === 'onboard') checkHandleInput(document.querySelector('.onboard input[name=handle]')); // 추천 아이디도 바로 확인
}

// ---------- 사용법 안내 ----------
// 처음 아이디를 만들면 핵심 기능을 카드 몇 장으로 보여줘요. 내 프로필에서 다시 볼 수 있어요.
const GART = {
  ticket: '<rect x="10" y="30" width="100" height="60" rx="12" fill="#fff"/><path d="M10 48v-6a12 12 0 0 1 12-12h76a12 12 0 0 1 12 12v6Z" fill="#13294b"/><path d="M82 52v34" stroke="#c9d3e2" stroke-width="3" stroke-dasharray="4 4"/><rect x="10" y="30" width="100" height="60" rx="12" fill="none" stroke="#2f74f0" stroke-width="4"/><path d="M22 66h24M22 78h40" stroke="#13294b" stroke-width="5" stroke-linecap="round"/><circle cx="96" cy="69" r="9" fill="none" stroke="#ff7a59" stroke-width="3"/>',
  friends: '<circle cx="44" cy="46" r="15" fill="#ff7a59"/><circle cx="76" cy="46" r="15" fill="#2f74f0"/><path d="M16 96c3-16 15-24 28-24s25 8 28 24M48 96c3-16 15-24 28-24s25 8 28 24" stroke="#13294b" stroke-width="5" fill="none" stroke-linecap="round"/>',
  places: '<path d="M60 12a28 28 0 0 1 28 28c0 22-28 52-28 52S32 62 32 40a28 28 0 0 1 28-28Z" fill="#fff" stroke="#2f74f0" stroke-width="4.5"/><path d="M60 55s-13-7.5-13-16a6.8 6.8 0 0 1 13-3.4 6.8 6.8 0 0 1 13 3.4c0 8.5-13 16-13 16Z" fill="#ff7a59"/><ellipse cx="60" cy="104" rx="18" ry="4" fill="#cfd7e3"/>',
  route: '<rect x="8" y="16" width="104" height="88" rx="18" fill="#fff"/><path d="M26 86c16 0 16-28 34-28s20-30 34-30" stroke="#2f74f0" stroke-width="5" stroke-dasharray="3 8" stroke-linecap="round" fill="none"/><circle cx="26" cy="86" r="10" fill="#2f74f0"/><circle cx="60" cy="58" r="10" fill="#2f74f0"/><circle cx="94" cy="28" r="10" fill="#ff7a59"/><text x="26" y="90.5" font-size="12" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">1</text><text x="60" y="62.5" font-size="12" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">2</text><text x="94" y="32.5" font-size="12" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">3</text>',
  insta: '<rect x="14" y="14" width="68" height="68" rx="20" fill="#fff" stroke="#2f74f0" stroke-width="4.5"/><circle cx="48" cy="48" r="16" fill="none" stroke="#2f74f0" stroke-width="4.5"/><circle cx="67" cy="29" r="3.5" fill="#2f74f0"/><path d="M88 58a16 16 0 0 1 16 16c0 12-16 28-16 28S72 86 72 74a16 16 0 0 1 16-16Z" fill="#ff7a59"/><circle cx="88" cy="74" r="6" fill="#fff"/>',
  money: '<path d="M26 14h68v88l-8-6-9 6-8-6-9 6-8-6-9 6-8-6-9 6Z" fill="#fff" stroke="#2f74f0" stroke-width="4" stroke-linejoin="round"/><path d="M40 36h40M40 50h40M40 64h22" stroke="#13294b" stroke-width="5" stroke-linecap="round"/><circle cx="86" cy="80" r="16" fill="#ff7a59"/><path d="M79 80h14M86 73v14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
  home: '<rect x="34" y="14" width="52" height="92" rx="12" fill="#fff" stroke="#2f74f0" stroke-width="4"/><path d="M52 22h16" stroke="#c9d3e2" stroke-width="3" stroke-linecap="round"/><g fill="#e3edff"><rect x="43" y="34" width="14" height="14" rx="4"/><rect x="63" y="34" width="14" height="14" rx="4"/><rect x="43" y="54" width="14" height="14" rx="4"/><rect x="63" y="54" width="14" height="14" rx="4"/><rect x="43" y="74" width="14" height="14" rx="4"/></g><rect x="63" y="74" width="14" height="14" rx="4" fill="#13294b"/><circle cx="84" cy="86" r="13" fill="#ff7a59"/><path d="M84 80v12M78 86h12" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>',
};
// 본문은 읽기 쉽게 문단(문장 묶음)마다 나누고, 한 줄이 폰 폭에 맞게 끊어 둬요.
const GUIDE = [
  ['ticket', '여행마다 항공권 한 장', [['새 여행을 만들고 날짜·공항을 적으면', '나만의 탑승권이 생겨요.'], ['출발 전엔 D-day를,', '여행 중엔 오늘이 DAY 몇인지 알려줘요.']]],
  ['friends', '친구를 태워요', [['아이디로 친구를 맺고,', '함께 갈 여행에 초대해요.'], ['친구가 수락하면', '같이 계획하고 같이 정산해요.']]],
  ['places', '가고 싶은 곳 모으기', [['가게나 장소 이름을 검색하면', '지도에 핀이 꽂혀요.'], ['마음에 드는 곳엔 하트를 눌러요.', '하트를 많이 받은 곳이 위로 올라와요.']]],
  ['insta', '인스타 링크로 바로 담기', [['인스타 게시물·릴스 링크를 복사해', '장소를 추가할 때 붙여넣으세요.'], ['글 속 가게·장소를 찾아', '위치까지 자동으로 담아줘요.']]],
  ['route', 'DAY별 일정과 길', [['갈 곳과 시간을 적으면', 'DAY별로 정리되고 지도에 길이 이어져요.'], ['"구글맵"으로 그날 경로를 바로 열고,', '날씨도 함께 볼 수 있어요.']]],
  ['money', '정산은 자동으로', [['지출을 적을 때 통화를 고르면', '오늘 환율로 알아서 바꿔줘요.'], ['누가 누구에게 얼마 보낼지 알려주고,', '복사해서 단톡방에 붙여넣기만 하면 돼요.']]],
  ['home', '홈 화면에 앱처럼 두기', [['주소를 칠 필요 없이', '홈 화면에서 바로 열어요.']]], // 둘째 문단은 폰·브라우저마다 HOME_STEPS에서
];
// 홈 화면에 추가하는 방법은 폰과 브라우저마다 달라서, 쓰는 사람 환경에 맞는 순서를 보여줘요.
const HOME_STEPS = {
  'ios-safari': ['{more} → 공유 → 홈 화면에 추가,', '세 번만 누르면 돼요.'],
  'ios-chrome': ['주소창 옆 {share} → 홈 화면에 추가,', '두 번만 누르면 돼요.'],
  'android-prompt': ['아래 버튼을 누르면', '홈 화면에 바로 추가돼요.'],
  'android-chrome': ['{dots} → 홈 화면에 추가,', '두 번만 누르면 돼요.'],
  'android-other': ['브라우저 메뉴에서', '\'홈 화면에 추가\'를 눌러요.'],
};
// 이미 홈 화면 앱으로 열었거나, 컴퓨터·카톡 같은 앱 안 브라우저면 카드를 빼요(null).
function homePlatform() {
  const ua = navigator.userAgent;
  if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) return null;
  if (/KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|; wv\)/i.test(ua)) return null;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // 아이패드는 맥처럼 보여요
  if (ios) return /CriOS/.test(ua) ? 'ios-chrome' : /FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? null : 'ios-safari';
  if (/Android/.test(ua)) return installPrompt ? 'android-prompt' : /Chrome\//.test(ua) && !/SamsungBrowser|Whale|EdgA|OPR/.test(ua) ? 'android-chrome' : 'android-other';
  return null;
}
const guideCards = () => GUIDE.filter(([art]) => art !== 'home' || homePlatform());
const DOTS = '<i></i><i></i><i></i>';
const guideLine = l => esc(l)
  .replace('{more}', `<span class="ic-more" aria-label="더 보기 버튼">${DOTS}</span>`)
  .replace('{dots}', `<span class="ic-more col" aria-label="메뉴 버튼">${DOTS}</span>`)
  .replace('{share}', `<span class="ic-more share" aria-label="공유 버튼">${icon('share', 13)}</span>`);
function renderGuide(allowed) {
  const show = allowed && state.guide != null;
  if (!show) { guideRoot?.remove(); guideRoot = null; return; }
  if (!guideRoot) {
    guideRoot = Object.assign(document.createElement('div'), { className: 'guide' });
    document.body.appendChild(guideRoot);
    // 옆으로 밀어서 넘기기
    let x0 = null;
    guideRoot.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    guideRoot.addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 50) return;
      const next = state.guide + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < guideCards().length) { state.guide = next; render(); }
    });
  }
  const cards = guideCards(), i = Math.min(state.guide, cards.length - 1), [art, title, base] = cards[i], last = i === cards.length - 1;
  const home = art === 'home' && homePlatform(), text = home ? [...base, HOME_STEPS[home]] : base;
  guideRoot.innerHTML = `
    <div class="guide-card" role="dialog" aria-label="가치가 사용법">
      <button class="guide-skip" data-action="guide-close">${last ? '닫기' : '건너뛰기'}</button>
      <div class="guide-art"><svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">${GART[art]}</svg></div>
      <h2 class="guide-title">${title}</h2>
      <div class="guide-text">${text.map(lines => `<p>${lines.map(guideLine).join('<br>')}</p>`).join('')}
        ${home === 'android-prompt' ? `<button class="btn-sm primary guide-install" data-action="install-app">${icon('plus', 15)} 홈 화면에 추가</button>` : ''}</div>
      <div class="guide-dots">${cards.map((_, j) => `<button class="${j === i ? 'on' : ''}" data-action="guide-go" data-i="${j}" aria-label="${j + 1}번째"></button>`).join('')}</div>
      <div class="guide-nav">
        ${i ? `<button class="btn" data-action="guide-prev">${icon('back', 18)} 이전</button>` : ''}
        <button class="btn primary block" data-action="guide-next">${last ? '시작하기' : '다음'}</button>
      </div>
    </div>`;
}

// 탭마다 처음 한 번만 뜨는 작은 팁. ✕를 누르면 이 기기에선 다시 안 떠요(본 팁은 tipsSeen에 적어 둬요).
function tabTip() {
  const tips = {
    timeline: state.events.length >= 2 && ['순서 바꾸기와 길찾기', '일정을 꾹 누른 채 끌면 순서가 바뀌고, 오른쪽 화살표를 누르면 구글맵 길찾기가 열려요.'],
    places: ['인스타 링크로 바로 담기', '릴스·게시물 링크를 복사해 붙여넣으면 장소를 자동으로 찾고 담아줘요.'],
    expenses: ['외화 지출도 바로 정산돼요', '지출마다 통화를 고르면 오늘 환율로 바꿔 정산해요. 정산 내용은 복사해서 단톡방에 붙여넣기만 하면 돼요.'],
  };
  const tip = tips[state.tab];
  if (!tip || tipsSeen[state.tab]) return '';
  return `
    <div class="tab-tip">
      <span class="tab-tip-ico">${icon('bulb', 16)}</span>
      <span class="tab-tip-body"><b>${tip[0]}</b>${tip[1]}${tip[2] ? ' ' + tip[2] : ''}</span>
      <button class="tab-tip-x" data-action="tip-close" data-id="${state.tab}" aria-label="팁 닫기">${icon('x', 14)}</button>
    </div>`;
}

function viewLogin() {
  return `
  <main class="login">
    <div class="login-logo">${logo(96)}</div>
    <h1 class="brand">가치가</h1>
    <p class="tagline">한 화면에서, 친구랑 같이 짜는 여행</p>
    ${IN_APP ? inAppCard() : `<form data-form="signin" class="login-form">
      ${isDemo ? `<input name="name" placeholder="내 이름" required maxlength="20" autocomplete="nickname">` : ''}
      <button class="btn primary big">${isDemo ? '출발하기' : '<span class="g">G</span> Google로 시작하기'}</button>
    </form>`}
    ${isDemo ? `<p class="demo-note">데모 모드예요. 이 브라우저에만 저장돼요. 새 탭에서 다른 이름으로 들어가면 친구 역할을 해볼 수 있어요.</p>` : ''}
  </main>`;
}

// 앱 안 브라우저면 로그인 버튼 대신 '사파리·크롬에서 열기' 안내를 보여줘요.
function inAppCard() {
  const browser = IN_APP.android ? '크롬' : '사파리';
  const from = { 카톡: 'KAKAO', 인스타: 'INSTAGRAM', 페이스북: 'FACEBOOK', 라인: 'LINE' }[IN_APP.name] || 'APP';
  return `
    <div class="inapp-pass">
      <div class="inapp-pass-band"><span>GATE CHANGE</span><span>탑승구 변경</span></div>
      <div class="inapp-route">
        <div><small>FROM</small><b>${from}</b></div>
        <svg class="ic" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path transform="rotate(90 12 12)" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
        <div><small>TO</small><b>${IN_APP.android ? 'CHROME' : 'SAFARI'}</b></div>
      </div>
      <div class="inapp-pass-body">
        <b>${browser}에서 열어 주세요</b>
        <p>이 화면에서는 구글 로그인이 막혀 있어요.</p>
        <button class="btn primary block" data-action="open-outside">${browser}에서 열기</button>
        <p class="inapp-help">안 열리나요? <button class="tip-link" data-action="copy-site">링크 복사하기</button></p>
      </div>
    </div>`;
}
// 카톡은 바깥 브라우저로 여는 기능을 주고, 안드로이드는 크롬으로 바로 넘길 수 있어요.
// 아이폰의 다른 앱은 사파리 주소(x-safari-)로 시도하고, 막히면 링크 복사로 옮겨요.
function openOutside() {
  const url = location.href;
  if (IN_APP.kakao) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
  else if (IN_APP.android) location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  else location.href = 'x-safari-' + url;
}

function viewOnboarding() {
  const suggestion = 'trip' + String(Math.floor(1000 + Math.random() * 9000));
  return `
  <main class="login onboard">
    <div class="onboard-badge">${icon('at', 40)}</div>
    <h1 class="brand sm">나만의 아이디 정하기</h1>
    <p class="tagline">친구가 이 아이디로 나를 찾아 친구 추가해요.<br>영문 소문자 · 숫자 · _ · . 으로 3~20자</p>
    <form data-form="handle" class="login-form">
      <label class="handle-input"><span>@</span>
        <input name="handle" value="${suggestion}" maxlength="20" autocapitalize="off" autocomplete="off" spellcheck="false" required>
      </label>
      <p class="handle-status" aria-live="polite"></p>
      <button class="btn primary big">이 아이디로 시작하기</button>
    </form>
    <p class="demo-note">나중에 프로필에서 바꿀 수 있어요.</p>
  </main>`;
}

// --- 홈 ---

// 첫 화면엔 다가오는·진행 중인 여행만 보여요. 다녀온 여행은 프로필 > 지난 여행 기록에서 봐요.
// 날짜가 가까운 순서로 놓고, 날짜 미정인 여행은 맨 뒤에 둬요.
function viewHome() {
  const trips = state.trips.filter(t => !isPast(t))
    .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999') || (b.createdAt || 0) - (a.createdAt || 0));
  const pastN = state.trips.length - trips.length;
  const hour = new Date().getHours();
  const hello = hour < 6 ? '늦은 밤이에요' : hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
  const next = trips.find(t => ['soon', 'now'].includes(tripStatus(t).kind));
  const headline = !next ? '어디로 떠나볼까요?'
    : tripStatus(next).kind === 'now' ? `지금은 ${esc(next.name)}<br><span class="hero-big">${tripStatus(next).label}</span>`
    : `${esc(next.name)}까지<br><span class="hero-big">${tripStatus(next).label}</span>`;
  const alerts = state.requestsIn.length;
  return `
  <header class="hero">
    <div class="hero-bar">
      <a href="#/" class="home-logo" aria-label="내 여행">${logo()}</a>
      <a class="hero-avatar" href="#/me" aria-label="내 프로필">
        ${avatarOf(me(), state.user.uid)}
        ${alerts ? `<span class="dot">${alerts}</span>` : ''}
      </a>
    </div>
    <p class="hero-sub">${hello}, ${esc(me().name)}님</p>
    <h1 class="hero-title">${headline}</h1>
    <p class="hero-clock">${icon('clock', 14)} ${esc(zoneName())} · ${clockLabel()}</p>
  </header>
  <main class="page">
    ${isDemo ? `<div class="demo-banner">데모 모드 · 이 브라우저에만 저장돼요</div>` : ''}
    ${state.invites.length ? `
      <h2 class="section-title pad">받은 여행 초대 <span class="count">${state.invites.length}</span></h2>
      ${state.invites.map(inviteCard).join('')}` : ''}
    ${alerts ? `
      <a class="notice-card" href="#/me">
        <span class="notice-icon">${icon('userPlus', 20)}</span>
        <span><b>친구 요청 ${alerts}개</b><br><span class="muted small">프로필에서 수락할 수 있어요</span></span>
        <span class="notice-go">${icon('chevron', 18)}</span>
      </a>` : ''}
    ${trips.length ? `
      <h2 class="section-title pad">내 여행 <span class="count">${trips.length}</span></h2>
      ${trips.map(ticket).join('')}
      <button class="btn primary block" data-action="new-trip">${icon('plus')} 새 여행 만들기</button>` : pastN ? `
      <div class="empty">
        <p><b>다가오는 여행이 없어요</b><br>다녀온 여행 ${pastN}개는 프로필의 지난 여행 기록에 있어요.</p>
        <button class="btn primary" data-action="new-trip">${icon('plus')} 새 여행 만들기</button>
      </div>` : `
      <section class="passport">
        <div class="passport-emblem">${logo(60)}</div>
        <h2 class="passport-title">첫 여행을 계획해 볼까요?</h2>
        <ol class="steps">
          <li><span class="step-stamp">1</span><span><b>친구 맺기</b><span>프로필에서 친구 아이디로 추가해요</span></span></li>
          <li><span class="step-stamp">2</span><span><b>여행 만들기</b><span>이름과 날짜만 정하면 돼요</span></span></li>
          <li><span class="step-stamp">3</span><span><b>멤버 초대</b><span>친구가 수락하면 같이 계획해요</span></span></li>
        </ol>
        <button class="btn primary block" data-action="new-trip">${icon('plus')} 첫 여행 만들기</button>
        <a class="btn ghost-light block" href="#/me">${icon('userPlus')} 친구 추가하기</a>
      </section>`}
  </main>`;
}

function inviteCard(t) {
  const owner = t.memberInfo?.[t.ownerId];
  return `
  <article class="invite-card">
    <div class="invite-card-from">${avatarOf(owner, t.ownerId, 'sm')}<span><b>${esc(owner?.name || '친구')}</b>님이 여행에 초대했어요</span></div>
    <div class="invite-card-name">${esc(t.name)}</div>
    <div class="muted small">${dateRange(t)} · ${t.members.length}명 참여 중</div>
    <div class="btn-row">
      <button class="btn ghost" data-action="decline-invite" data-id="${esc(t.id)}">${icon('x', 18)} 거절</button>
      <button class="btn primary" data-action="accept-invite" data-id="${esc(t.id)}">${icon('check', 18)} 수락하기</button>
    </div>
  </article>`;
}

// --- 항공권 ---

const fmtCode = s => { const d = parseDate(s); return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
const stayLabel = t => {
  if (!t.startDate) return '미정';
  const n = dayDiff(t.startDate, t.endDate || t.startDate);
  return n ? `${n}박 ${n + 1}일` : '당일';
};

// 출발 → 도착. 출발은 사용자가 정한 공항만, 도착을 안 정했으면 여행 이름에 든 도시로 짐작합니다("시애틀 먹방" → SEA).
function tripRoute(t) {
  if (modeOf(t) !== 'plane') {
    const mode = modeOf(t), to = t.to || cityOfCode(guessAirport(t.name)?.code) || '';
    return { from: t.from || '', to, fromCity: stopCity(mode, t.from || ''), toCity: stopCity(mode, to) };
  }
  const from = t.from || '';
  const to = t.to || guessAirport(t.name)?.code || '';
  return { from, to, fromCity: cityOfCode(from), toCity: cityOfCode(to) };
}

function routeRow(t, { heading = false } = {}) {
  const tag = heading ? 'h1' : 'span';
  const r = tripRoute(t);
  return `
  <${tag} class="ticket-title">${esc(t.name)}</${tag}>
  <div class="route-row">
    <div class="rt"><span class="rt-label">FROM</span><span class="rt-code">${esc(r.from || '???')}</span><span class="rt-city">${esc(r.from ? r.fromCity : '출발지 미정')}</span></div>
    <svg class="rt-arc" viewBox="0 0 54 18" aria-hidden="true">
      <path d="M2 15Q27-3 52 15"/>
      <g transform="translate(27 6) rotate(90) scale(.6) translate(-12 -12)"><path d="${PLANE}"/></g>
    </svg>
    <div class="rt to"><span class="rt-label">TO</span><span class="rt-code">${esc(r.to || '???')}</span><span class="rt-city">${esc(r.to ? r.toCity : '도착지 미정')}</span></div>
  </div>`;
}

function ticketFields(t, last) {
  return `
  <div class="ticket-fields">
    <div><span class="f-label">DATE</span><span class="f-val">${t.startDate ? fmtCode(t.startDate) : '미정'}</span></div>
    <div><span class="f-label">RETURN</span><span class="f-val">${t.endDate ? fmtCode(t.endDate) : '—'}</span></div>
    <div><span class="f-label">${last[0]}</span>${last[1]}</div>
  </div>`;
}

// 꼬리표에 찍히는 출국 도장. 잉크 번짐은 index.html의 #ink 필터, 기울기는 여행마다 조금씩 달라요.
function passStamp(t, s) {
  const [top, big] = {
    soon: ['출발까지', s.label],
    now: ['여행 중', s.label],
    past: ['다녀옴', t.endDate ? fmtCode(t.endDate) : ''],
    tbd: ['날짜', '미정'],
  }[s.kind];
  const size = big.length > 4 ? 14 : 17;
  return `<svg class="pass-stamp" viewBox="0 0 80 80" aria-label="${esc(top)} ${esc(big)}">
    <g filter="url(#ink)"><g transform="rotate(${-8 - hue(t.id) % 10} 40 40)">
      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <text x="40" y="34" class="ps-top">${esc(top)}</text>
      <text x="40" y="53" class="ps-big" font-size="${size}">${esc(big)}</text>
    </g></g>
  </svg>`;
}

// --- 이동수단별 티켓 ---
// 비행기는 탑승권, 나머지는 그 수단에서 실제로 보는 표·물건 모양으로 그려요.
// mode가 없는 예전 여행은 모두 비행기예요.
const MODES = { plane: '비행기', train: '기차', bus: '고속버스', car: '자동차' };
const modeOf = t => MODES[t?.mode] ? t.mode : 'plane';
const dotDate = s => { const d = parseDate(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
const tripDates = t => !t.startDate ? '날짜 미정' : !t.endDate || t.endDate === t.startDate ? dotDate(t.startDate) : `${dotDate(t.startDate)}–${dotDate(t.endDate)}`;

// 기차 전광판: 몇 초마다 글자판이 넘어가며 경로 → 상태 → 날짜를 번갈아 보여줘요.
let flapTick = 0;
const FLAP_MAX = 9;
function flapMsgs(t) {
  const r = tripRoute(t), s = tripStatus(t);
  return [`${r.from || '출발'}→${r.to || '도착'}`, s.kind === 'soon' ? `출발 ${s.label}` : s.label, t.startDate ? dotDate(t.startDate) : '']
    .filter(Boolean).map(m => [...m].slice(0, FLAP_MAX));
}
const flapCell = ch => `<span class="flap-c${ch === '→' ? ' y' : ''}"><span>${esc(ch)}</span><i></i></span>`;
function flapCells(t) {
  const msgs = flapMsgs(t), n = Math.max(...msgs.map(m => m.length));
  const now = msgs[flapTick % msgs.length];
  return `<div class="flap-cells" data-msgs="${esc(JSON.stringify(msgs))}">${Array.from({ length: n }, (_, i) => flapCell(now[i] || ' ')).join('')}</div>`;
}
const FLAP_POOL = '가나다라마바사아자차카타파하0123456789';
function flipBoard(el) {
  const msgs = JSON.parse(el.dataset.msgs), next = msgs[flapTick % msgs.length];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  [...el.children].forEach((cell, i) => {
    const target = next[i] || ' ', text = cell.firstChild;
    if (text.textContent === target) return;
    let left = still ? 0 : 3 + i;
    const step = () => {
      const ch = left-- > 0 ? FLAP_POOL[Math.floor(Math.random() * FLAP_POOL.length)] : target;
      cell.classList.remove('go'); void cell.offsetWidth; cell.classList.add('go');
      setTimeout(() => { text.textContent = ch; cell.classList.toggle('y', ch === '→'); }, 45);
      if (left >= 0) setTimeout(step, 90);
    };
    step();
  });
}
// 화면에 보이는 전광판만 넘겨요(배터리 아끼기).
setInterval(() => {
  if (document.hidden) return;
  const boards = [...document.querySelectorAll('.flap-cells')].filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  if (!boards.length) return;
  flapTick++;
  boards.forEach(flipBoard);
}, 4000);

// 비행기가 아닌 여행 카드. last: 끝 칸에 넣을 [이름, 내용] (홈은 일행, 여행 화면은 일정 길이)
function modeCard(t, { heading = false, last }) {
  const tag = heading ? 'h1' : 'span';
  const r = tripRoute(t), s = tripStatus(t);
  const name = cls => `<${tag} class="${cls}">${esc(t.name)}</${tag}>`;
  const dday = s.kind === 'tbd' ? '날짜 미정' : s.label;
  const from = esc(r.from || '출발지 미정'), to = esc(r.to || '도착지 미정');
  switch (modeOf(t)) {
    case 'train': return `
    <div class="mc flap">
      <div class="flap-hd"><span>DEPARTURES · 출발</span>${name('flap-name')}</div>
      ${flapCells(t)}
      <div class="flap-grid">
        <div><small>DATE</small><b>${tripDates(t)}</b></div>
        <div><small>${last[0]}</small>${last[1]}</div>
        <div><small>STATUS</small><b>${dday}</b></div>
      </div>
    </div>`;
    case 'bus': return `
    <div class="mc led">
      <div class="led-screen">
        <div class="led-big"><b>${to}</b> 행</div>
        <div class="led-run"><span>${from} 출발 · ${s.kind === 'soon' ? '출발까지 ' : ''}${dday} · ${esc(t.name)}</span></div>
      </div>
      <div class="led-plate">${name('led-name')}<span class="led-date">${tripDates(t)}</span>${last[1]}</div>
    </div>`;
    default: return `
    <div class="mc sign">
      <div class="sign-in">
        <svg class="sign-arrow" viewBox="0 0 40 52" aria-hidden="true"><path d="M20 2 36 20H26V50H14V20H4Z"/></svg>
        <div class="sign-dest"><b>${to}</b><small>${from}에서 출발</small></div>
        <div class="sign-shield">${dday}</div>
      </div>
      <div class="sign-sub">${name('sign-name')}<span class="sign-date">${tripDates(t)}</span>${last[1]}</div>
    </div>`;
  }
}

function ticket(t) {
  const s = tripStatus(t);
  const crew = `<span class="avatars">${t.members.slice(0, 4).map(uid => avatarOf(t.memberInfo?.[uid], uid, 'xs')).join('')}</span>`;
  const wait = (t.invitedIds || []).length && isOwner(t) ? `<div class="ticket-wait">${t.invitedIds.length}명 수락 대기 중</div>` : '';
  if (modeOf(t) !== 'plane') return `
  <a class="mode-ticket ${s.kind}" href="#/trip/${esc(t.id)}">
    ${modeCard(t, { last: ['CREW', crew] })}
    ${wait}
  </a>`;
  return `
  <a class="ticket ${s.kind}" href="#/trip/${esc(t.id)}">
    <div class="ticket-main">
      <div class="ticket-band">${logo(16)}<span>BOARDING PASS</span>${isOwner(t) ? '<em>CAPTAIN</em>' : ''}</div>
      ${routeRow(t)}
      ${ticketFields(t, ['CREW', crew])}
      ${wait}
    </div>
    <div class="ticket-stub">
      <div class="stub-band"></div>
      ${passStamp(t, s)}
    </div>
  </a>`;
}

// --- 프로필 ---

// 지난 여행 기록: 다녀온 여행을 최근에 다녀온 순서로 보여줘요.
function viewPast() {
  const past = state.trips.filter(isPast).sort((a, b) => (b.endDate || b.startDate || '').localeCompare(a.endDate || a.startDate || ''));
  return `
  <header class="hero me-hero">
    <div class="hero-bar">
      <a class="hero-icon" href="#/me" aria-label="뒤로">${icon('back', 22)}</a>
      <span class="hero-chip">지난 여행 기록</span>
      <span class="hero-icon ghost"></span>
    </div>
  </header>
  <main class="page past-page">
    ${past.length
      ? `<h2 class="section-title pad">다녀온 여행 <span class="count">${past.length}</span></h2>${past.map(ticket).join('')}`
      : `<div class="empty"><p><b>아직 다녀온 여행이 없어요</b><br>여행이 끝나면 여기에 모여요.</p></div>`}
  </main>`;
}

function viewMe() {
  const p = me();
  return `
  <header class="hero me-hero" ${p.color ? `style="--me:${esc(p.color)}"` : ''}>
    <div class="hero-bar">
      <a class="hero-icon" href="#/" aria-label="뒤로">${icon('back', 22)}</a>
      <span class="hero-chip">내 프로필</span>
      <span class="hero-icon ghost"></span>
    </div>
    <div class="me-card">
      ${avatarOf(p, p.uid, 'xl')}
      <div class="me-name">${esc(p.name)}</div>
      <button class="handle-chip" data-action="copy-handle">@${esc(p.handle)} ${icon('copy', 14)}</button>
      <button class="me-style" data-action="profile-style">${icon('palette', 16)} 프로필 꾸미기</button>
    </div>
  </header>
  <main class="page">
    <button class="btn primary block" data-action="add-friend">${icon('userPlus')} 아이디로 친구 추가</button>

    ${state.requestsIn.length ? `
      <h2 class="section-title pad">받은 친구 요청 <span class="count">${state.requestsIn.length}</span></h2>
      <div class="card list">
        ${state.requestsIn.map(r => personRow(r.fromInfo, `
          <button class="btn-sm" data-action="decline-request" data-id="${esc(r.id)}" aria-label="거절">${icon('x', 16)}</button>
          <button class="btn-sm primary" data-action="accept-request" data-id="${esc(r.id)}">${icon('check', 16)} 수락</button>`)).join('')}
      </div>` : ''}

    <h2 class="section-title pad">내 친구 <span class="count">${state.friends.length}</span></h2>
    ${state.friends.length ? `
      <div class="card list">
        ${[...state.friends].sort((a, b) => a.name.localeCompare(b.name)).map(f => personRow(f, `
          <button class="btn-sm subtle" data-action="remove-friend" data-id="${esc(f.uid)}" aria-label="친구 끊기">${icon('userMinus', 16)}</button>`)).join('')}
      </div>` : `
      <div class="empty-mini">아직 친구가 없어요.<br>친구에게 내 아이디 <b>@${esc(p.handle)}</b>를 알려주거나, 친구 아이디로 추가해 보세요.</div>`}

    ${state.requestsOut.length ? `
      <h2 class="section-title pad">보낸 요청 <span class="count">${state.requestsOut.length}</span></h2>
      <div class="card list">
        ${state.requestsOut.map(r => personRow(r.toInfo, `
          <button class="btn-sm subtle" data-action="cancel-request" data-id="${esc(r.id)}">요청 취소</button>`)).join('')}
      </div>` : ''}

    <div class="me-links">
    <a class="btn block" href="#/past">${icon('calendar', 18)} 지난 여행 기록${state.trips.filter(isPast).length ? ` <span class="count">${state.trips.filter(isPast).length}</span>` : ''}</a>
    <button class="btn block" data-action="show-guide">${icon('bulb', 18)} 가치가 사용법 다시 보기</button>
    </div>

    <div class="me-footer">
      <button class="btn block" data-action="edit-handle">${icon('at', 18)} 아이디 변경</button>
      <button class="btn block subtle-danger" data-action="signout">${icon('logout', 18)} 로그아웃</button>
    </div>
  </main>`;
}

// --- 여행 ---

function viewTrip() {
  const t = state.trip;
  if (!t) return `<div class="splash">${logo(64)}</div>`;
  const s = tripStatus(t);
  const owner = isOwner(t);
  const alone = t.members.length < 2;
  const pending = (t.invitedIds || []).length;
  const body = state.tab === 'timeline' ? viewTimeline() : state.tab === 'places' ? viewPlaces() : viewExpenses();
  const crewRow = `
        <button class="crew" data-action="members">
          <span class="avatars">${t.members.slice(0, 5).map(uid => avatar(uid, 'sm')).join('')}</span>
          <span class="crew-count">멤버 ${t.members.length}${pending ? ` · 대기 ${pending}` : ''}</span>
        </button>
        ${owner ? `<button class="crew-add" data-action="members">${icon('userPlus', 16)} 멤버 추가</button>` : ''}`;
  return `
  <header class="hero trip-hero scene-${modeOf(t)}">
    ${tripScene(modeOf(t), t.startDate)}
    <div class="hero-bar">
      <a class="hero-icon" href="#/" aria-label="뒤로">${icon('back', 22)}</a>
      <span class="hero-chip">${s.label}</span>
      <button class="hero-icon" data-action="trip-settings" aria-label="여행 설정">${icon('more', 22)}</button>
    </div>
    ${modeOf(t) === 'plane' ? `
    <section class="trip-pass">
      <div class="tp-top">
        <div class="ticket-band"><a href="#/" class="home-logo" aria-label="내 여행으로">${logo(16)}</a><span>BOARDING PASS</span>${owner ? '<em>CAPTAIN</em>' : ''}</div>
        ${routeRow(t, { heading: true })}
        ${ticketFields(t, ['STAY', `<span class="f-val">${stayLabel(t)}</span>`])}
      </div>
      <div class="tp-bottom hero-crew">${crewRow}</div>
    </section>` : `
    <section class="trip-mode">
      ${modeCard(t, { heading: true, last: ['STAY', `<b class="mc-stay">${stayLabel(t)}</b>`] })}
      <div class="trip-mode-crew hero-crew">${crewRow}</div>
    </section>`}
  </header>
  <main class="page with-nav">
    ${tabTip()}
    ${body}
  </main>
  <button class="fab" data-action="add" aria-label="추가">${icon('plus', 28)}</button>
  <nav class="tabbar">${TABS.map(tab => `
    <a href="#/trip/${esc(t.id)}/${tab.id}" class="${state.tab === tab.id ? 'on' : ''}">${icon(tab.icon, 24)}<span>${tab.id === 'expenses' && alone ? '경비' : tab.label}</span></a>`).join('')}
  </nav>`;
}

// --- 일정 ---

function tripDays(t) {
  const days = [];
  if (t?.startDate) {
    const end = t.endDate && t.endDate >= t.startDate ? t.endDate : t.startDate;
    for (let d = t.startDate; d <= end; d = addDays(d, 1)) days.push(d);
  }
  return days;
}
function dayLabel(d) {
  const t = state.trip, n = t?.startDate ? dayDiff(t.startDate, d) + 1 : 0;
  return n > 0 ? `DAY ${n}` : fmtDate(d);
}

// 일정의 위치: 장소 탭에서 고른 곳이면 그 장소의 위치, 아니면 일정에 저장된 위치
function eventLoc(e) {
  const p = e.placeId && state.places.find(x => x.id === e.placeId);
  return hasCoords(p) ? p : hasCoords(e) ? e : null;
}

// 구글맵 길찾기 링크. 우리 지도에 꽂힌 그 자리로 가도록 좌표로 보내요.
const gmapsPt = l => `${(+l.lat).toFixed(6)},${(+l.lng).toFixed(6)}`;
const gmapsToUrl = e => `https://www.google.com/maps/dir/?api=1&destination=${gmapsPt(eventLoc(e))}`;
// 하루 경로: 첫 일정 → (들를 곳, 구글맵은 9곳까지) → 마지막 일정. 가까우면 걷기, 멀면 차로 열어요.
function gmapsDayUrl(list) {
  const pts = list.map(eventLoc);
  if (pts.length === 1) return `https://www.google.com/maps/search/?api=1&query=${gmapsPt(pts[0])}`;
  const km = pts.slice(1).reduce((sum, p, i) => sum + kmBetween(pts[i], p), 0);
  const mid = pts.slice(1, -1).slice(0, 9).map(gmapsPt).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${gmapsPt(pts[0])}&destination=${gmapsPt(pts.at(-1))}${mid ? '&waypoints=' + encodeURIComponent(mid) : ''}&travelmode=${km < 5 ? 'walking' : 'driving'}`;
}

// 위쪽 지도: 고른 날의 일정을 시간 순서대로 번호 핀 + 실제 길로 이어요.
// 날짜는 "DAY 2 · 12.05 ▾" 버튼을 눌러 펼치는 목록에서 골라요(일정이 없는 날도 목록에 있어요).
function timelineMap(allDays, byDate) {
  const located = d => sortDay(byDate[d] || []).filter(eventLoc);
  const daysWithPins = allDays.filter(d => located(d).length);
  if (!daysWithPins.length) { state.mapSpec = null; return ''; }
  const today = todayStr();
  if (state.mapDay !== 'all' && !allDays.includes(state.mapDay)) {
    state.mapDay = daysWithPins.includes(today) ? today : daysWithPins.find(d => d >= today) || daysWithPins[0];
  }
  const all = state.mapDay === 'all';
  const shown = all ? daysWithPins : [state.mapDay];
  const pins = [], lines = [];
  for (const d of shown) {
    const list = located(d);
    // 전체 보기에선 날마다 번호가 겹치니 "2-1"처럼 DAY 번호를 앞에 붙여요.
    const n = allDays.indexOf(d) + 1;
    list.forEach((e, i) => {
      const loc = eventLoc(e);
      pins.push({ lat: loc.lat, lng: loc.lng, title: e.title, html: `<b class="route-pin ${all ? 'wide' : ''}" style="--c:${DAY_COLOR}">${all ? `${n}-${i + 1}` : i + 1}</b>`, anchor: 'center', click: () => eventSheet(e) });
    });
    if (list.length > 1) lines.push({ color: DAY_COLOR, pts: list.map(e => { const l = eventLoc(e); return [l.lat, l.lng]; }) });
  }
  state.mapSpec = { pins, lines };
  const dayList = !all && located(state.mapDay);
  const label = d => `${dayLabel(d)} · ${fmtShort(d)}`;
  const count = d => {
    const pinsN = located(d).length, evN = (byDate[d] || []).length;
    return pinsN ? `${pinsN}곳` : evN ? '지도에 없음' : '일정 없음';
  };
  return `
    <div class="map-bar">
      <button class="day-drop ${state.mapDayOpen ? 'open' : ''}" data-action="map-day-open" aria-expanded="${!!state.mapDayOpen}">
        ${all ? '전체 일정' : esc(label(state.mapDay))} ${icon('chevronDown', 16)}
      </button>
      ${dayList?.length ? `<a class="gmaps-btn" href="${esc(gmapsDayUrl(dayList))}" target="_blank" rel="noopener">${icon('compass', 15)} 구글맵</a>` : ''}
      ${state.mapDayOpen ? `
      <div class="day-menu-back" data-action="map-day-open"></div>
      <div class="day-menu" role="listbox">
        <button class="${all ? 'on' : ''}" data-action="map-day" data-day="all">전체 일정<span>${daysWithPins.reduce((n, d) => n + located(d).length, 0)}곳</span></button>
        ${allDays.map(d => `<button class="${state.mapDay === d ? 'on' : ''}" data-action="map-day" data-day="${d}">${esc(label(d))} (${WEEK[parseDate(d).getDay()]})<span>${count(d)}</span></button>`).join('')}
      </div>` : ''}
    </div>
    <div class="map-wrap">
      <div id="map-slot" class="map-slot" data-cls="map route-map"></div>
      ${!all && !dayList.length ? `<div class="map-empty">${esc(dayLabel(state.mapDay))}은 아직 지도에 표시할 일정이 없어요<br><small>일정에 장소를 넣으면 핀이 꽂혀요</small></div>` : ''}
    </div>`;
}

function viewTimeline() {
  const t = state.trip;
  const byDate = groupBy(state.events, e => e.date || '');
  const days = tripDays(t);
  const allDays = [...new Set([...days, ...Object.keys(byDate).filter(Boolean)])].sort();
  const undated = byDate[''] || [];
  const today = todayStr();

  state.mapSpec = null;
  if (!allDays.length && !undated.length) {
    return `<div class="empty">
      <div class="empty-icon"><svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true"><rect x="14" y="20" width="68" height="62" rx="14" fill="#e3edff"/><path d="M14 34a14 14 0 0 1 14-14h40a14 14 0 0 1 14 14v6H14Z" fill="#2f74f0"/><rect x="30" y="13" width="6" height="14" rx="3" fill="#13294b"/><rect x="60" y="13" width="6" height="14" rx="3" fill="#13294b"/><rect x="24" y="48" width="8" height="6" rx="2" fill="#fff"/><rect x="24" y="58" width="8" height="6" rx="2" fill="#fff"/><rect x="24" y="68" width="8" height="6" rx="2" fill="#fff"/><rect x="37" y="48" width="8" height="6" rx="2" fill="#fff"/><rect x="37" y="58" width="8" height="6" rx="2" fill="#fff"/><rect x="37" y="68" width="8" height="6" rx="2" fill="#fff"/><rect x="50" y="48" width="8" height="6" rx="2" fill="#fff"/><rect x="50" y="58" width="8" height="6" rx="2" fill="#fff"/><rect x="50" y="68" width="8" height="6" rx="2" fill="#fff"/><rect x="63" y="48" width="8" height="6" rx="2" fill="#fff"/><rect x="63" y="58" width="8" height="6" rx="2" fill="#fff"/><rect x="63" y="68" width="8" height="6" rx="2" fill="#fff"/><g transform="translate(44 40) scale(.9)"><path d="M10 0a10 10 0 0 1 10 10c0 8-10 17-10 17S0 18 0 10A10 10 0 0 1 10 0Z" fill="#ff7a59"/><circle cx="10" cy="10" r="4" fill="#fff"/></g></svg></div>
      <p><b>여행 날짜부터 정해볼까요?</b><br>날짜를 정하면 DAY별로 일정이 정리돼요.</p>
      <button class="btn" data-action="trip-settings">${icon('calendar', 18)} 날짜 정하기</button>
    </div>`;
  }

  return `
    ${timelineMap(allDays, byDate)}

    ${allDays.map(d => {
      const n = t.startDate ? dayDiff(t.startDate, d) + 1 : 0;
      const list = sortDay(byDate[d] || []);
      return `
      <section class="day ${d === today ? 'today' : ''}">
        <h2 class="day-head">
          ${n > 0 ? `<span class="day-num">DAY ${n}</span>` : ''}
          <span>${fmtDate(d)}</span>
          ${d === today ? '<span class="badge">오늘</span>' : ''}
          ${wxBadge(d)}
        </h2>
        <div class="route">
          ${(() => { let k = 0; const color = DAY_COLOR; return list.map(e => eventRow(e, eventLoc(e) ? { n: ++k, color } : null)).join(''); })()}
          <button class="add-inline" data-action="add-event" data-date="${d}">${icon('plus', 16)} 일정 추가</button>
        </div>
      </section>`;
    }).join('')}
    ${undated.length ? `
      <section class="day">
        <h2 class="day-head"><span class="day-num">언젠가</span><span>날짜 미정</span></h2>
        <div class="route">${sortDay(undated).map(e => eventRow(e)).join('')}</div>
      </section>` : ''}`;
}

function timeRange(e) {
  return !e.time ? '시간 미정' : e.endTime ? `${esc(e.time)} – ${esc(e.endTime)}` : esc(e.time);
}

// 위치가 있는 일정은 카드 오른쪽 아래에 구글맵 길찾기 버튼이 있어요(카드를 누르면 수정).
function eventRow(e, pin) {
  return `
  <div class="stop" data-id="${esc(e.id)}">
    <button class="stop-card" data-action="edit-event" data-id="${esc(e.id)}">
      <span class="stop-time">${pin ? `<b class="stop-pin" style="--c:${pin.color}">${pin.n}</b>` : ''}${timeRange(e)}</span>
      <span class="stop-title">${esc(e.title)}</span>
      ${e.place ? `<span class="stop-meta">${icon('pin', 13)} ${esc(e.place)}${!eventLoc(e) && !e.placeId ? ' <em class="no-loc">지도에 없음</em>' : ''}</span>` : ''}
      ${e.note ? `<span class="stop-meta note">${esc(e.note)}</span>` : ''}
    </button>
    ${avatar(e.createdBy, 'xs')}
    ${eventLoc(e) ? `<a class="stop-go" href="${esc(gmapsToUrl(e))}" target="_blank" rel="noopener" aria-label="구글맵으로 길찾기">${icon('nav', 16)}</a>` : ''}
  </div>`;
}

// --- 장소 ---

function viewPlaces() {
  const counts = {};
  for (const p of state.places) for (const c of placeCats(p)) (counts[c] ||= []).push(p);
  const f = counts[state.placeFilter] ? state.placeFilter : 'all';
  const list = state.places
    .filter(p => f === 'all' || placeCats(p).includes(f))
    .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  if (!state.places.length) {
    return `<div class="empty">
      <div class="empty-icon"><svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true"><rect x="10" y="22" width="76" height="58" rx="14" fill="#e3edff"/>
        <path d="M10 56c16-6 26 6 40 0s24-12 36-6" stroke="#cfe4f7" stroke-width="8" fill="none"/>
        <path d="M28 30c10 8 2 20 14 26s22-4 30 6" stroke="#fff" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round" fill="none"/>
        <g transform="translate(22 30)"><path d="M8 0a8 8 0 0 1 8 8c0 6-8 14-8 14S0 14 0 8a8 8 0 0 1 8-8Z" fill="#ff7a59"/><circle cx="8" cy="8" r="3" fill="#fff"/></g>
        <g transform="translate(60 18)"><path d="M10 0a10 10 0 0 1 10 10c0 8-10 17-10 17S0 18 0 10A10 10 0 0 1 10 0Z" fill="#2f74f0"/><circle cx="10" cy="10" r="4" fill="#fff"/></g>
        <g transform="translate(44 52)"><path d="M7 0a7 7 0 0 1 7 7c0 5-7 12-7 12S0 12 0 7a7 7 0 0 1 7-7Z" fill="#8cc152"/><circle cx="7" cy="7" r="2.6" fill="#fff"/></g></svg></div>
      <p><b>가고 싶은 곳을 모아보세요</b><br>이름으로 위치를 찾으면 지도에 핀이 꽂혀요.<br>${state.trip.members.length < 2 ? '꼭 가고 싶은 곳엔 하트를 눌러 두세요. 위로 올라와요.' : '하트를 많이 받은 곳이 위로 올라와요.'}</p>
    </div>`;
  }
  state.mapPlaces = list.filter(hasCoords);
  state.mapSpec = {
    pins: state.mapPlaces.map(p => {
      const cat = catOf(p.category);
      return { lat: p.lat, lng: p.lng, title: p.name, html: `<div class="drop-pin" style="--c:${cat.color}"><i>${icon('cat_' + cat.id, 16)}</i></div>`, anchor: 'bottom', click: () => placeDetail(p.id) };
    }),
    lines: [],
  };
  return `
    ${state.mapPlaces.length ? `<div id="map-slot" class="map-slot"></div>` : `
      <div class="map-hint">${icon('pin', 18)}<span>장소에 위치를 넣으면 여기 지도에 핀이 꽂혀요.<br><span class="muted xsmall">장소를 눌러 수정 → 이름으로 위치 찾기</span></span></div>`}
    <div class="chips scroll">
      <button class="chip ${f === 'all' ? 'on' : ''}" data-action="place-filter" data-id="all">전체 ${state.places.length}</button>
      ${CATEGORIES.filter(c => counts[c.id]).map(c => `
        <button class="chip cat-chip ${f === c.id ? 'on' : ''}" style="--c:${c.color}" data-action="place-filter" data-id="${c.id}">${icon('cat_' + c.id, 15)} ${c.label} ${counts[c.id].length}</button>`).join('')}
    </div>
    <div class="place-list">${list.map(placeCard).join('')}</div>`;
}

function placeCard(p) {
  const cat = catOf(p.category);
  const liked = p.likes?.includes(state.user.uid);
  const scheduled = state.events.find(e => e.placeId === p.id);
  const meta = [
    hasCoords(p) ? `<span class="pr-on">${icon('pin', 12)}지도</span>` : '',
    scheduled ? `<span class="pr-sched">${scheduled.date ? fmtShort(scheduled.date) + ' ' : ''}일정</span>` : '',
    esc(memberName(p.createdBy)),
    `<span class="pr-txt">${esc(p.note || placeCats(p).map(id => catOf(id).label).join('·'))}</span>`, // 길면 여기만 말줄임
  ].filter(Boolean).join('<i>·</i>');
  return `
  <article class="place-row">
    <button class="pr-main" data-action="place-detail" data-id="${esc(p.id)}">
      ${catTile(cat.id, 22)}
      <span class="pr-body">
        <b>${esc(p.name)}</b>
        <small>${meta}</small>
      </span>
    </button>
    <button class="pr-like ${liked ? 'on' : ''}" data-action="like" data-id="${esc(p.id)}" aria-label="좋아요">${icon('heart', 20)}<span>${p.likes?.length || ''}</span></button>
  </article>`;
}

// --- 지도 ---
// 전체 핀은 무료 지도(Leaflet + OpenStreetMap/CARTO)로, 장소 하나는 구글맵 화면으로 보여줍니다.

const hasCoords = p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);
const placeQuery = p => (p.address ? `${p.name} ${p.address}` : hasCoords(p) ? `${p.lat},${p.lng}` : p.name);
const googleMapsUrl = p => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasCoords(p) ? `${p.lat},${p.lng}` : p.name)}`;
const googleEmbedUrl = p => `https://maps.google.com/maps?q=${encodeURIComponent(placeQuery(p))}&z=16&hl=ko&output=embed`;

// 지도는 무료 벡터 지도(MapLibre + OpenFreeMap). 연한 회색 바탕에 바다·공원만 색을 넣고, 글씨는 한국어로 바꿔요.
// 출처 표시는 지우면 안 돼서 오른쪽 아래 작은 ⓘ 안에 접어 둬요.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
let mapLibReady = null;
function loadMapLib() {
  return (mapLibReady ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css';
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js';
    js.onload = () => resolve(window.maplibregl);
    js.onerror = () => { mapLibReady = null; reject(new Error('지도를 불러오지 못했어요')); };
    document.head.append(css, js);
  }));
}

function styleMap(map) {
  for (const l of map.getStyle().layers) {
    if (l.type === 'fill' && /water/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#cfe4f7');
    else if (l.type === 'fill' && /park|wood|grass|landcover/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#dcefd6');
    // 도로 번호판(shield)은 이름이 아니라 번호(ref)를 써야 해서 글씨는 그대로 둬요(이름으로 바꾸면 빈 네모만 남아요).
    // 공항 게이트·보행로 번호판(class: path)은 여행 계획에 필요 없어 숨겨요.
    else if (l.type === 'symbol' && /shield/.test(l.id)) map.setFilter(l.id, ['all', l.filter || true, ['!=', ['get', 'class'], 'path']]);
    else if (l.type === 'symbol' && map.getLayoutProperty(l.id, 'text-field')) map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ko'], ['get', 'name']]);
  }
  // 선: 처음엔 점선 직선, 실제 길을 받아 오면 실선으로
  map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const line = { type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' } };
  map.addLayer({ ...line, id: 'route-straight', filter: ['==', ['get', 'road'], false], paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': .5, 'line-dasharray': [1, 2] } });
  map.addLayer({ ...line, id: 'route-road', filter: ['==', ['get', 'road'], true], paint: { 'line-color': ['get', 'color'], 'line-width': 4.5, 'line-opacity': .85 } });
}

let mapView = null;
async function mountMap() {
  const slot = $app.querySelector('#map-slot');
  if (!slot) return;
  mapView ||= { el: Object.assign(document.createElement('div'), { className: 'map' }), map: null, ready: null, markers: [], key: '' };
  mapView.el.classList.toggle('route-map', slot.dataset.cls?.includes('route-map')); // 지도 엔진이 붙인 class는 그대로 둬요
  slot.replaceWith(mapView.el);
  let ml;
  try { ml = await loadMapLib(); } catch (e) { mapView.el.textContent = e.message; return; }
  if (!mapView.el.isConnected) return;
  if (!mapView.map) {
    const map = new ml.Map({ container: mapView.el, style: MAP_STYLE, center: [127, 37.5], zoom: 3, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false });
    map.touchZoomRotate.disableRotation();
    map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
    mapView.map = map;
    mapView.ready = new Promise(r => map.on('load', () => {
      styleMap(map);
      mapView.el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      r();
    }));
  }
  mapView.map.resize();
  const { pins = [], lines = [] } = state.mapSpec || {};
  const key = state.tripId + '|' + JSON.stringify([pins.map(p => [p.lat, p.lng, p.html]), lines.map(l => [l.color, l.pts])]);
  if (key === mapView.key) return;
  mapView.key = key;
  await mapView.ready;
  if (mapView.key !== key) return;
  const map = mapView.map;

  mapView.markers.forEach(m => m.remove());
  mapView.markers = pins.map(p => {
    const el = document.createElement('div');
    el.innerHTML = p.html;
    el.title = p.title;
    el.addEventListener('click', e => { e.stopPropagation(); p.click(); });
    return new ml.Marker({ element: el, anchor: p.anchor || 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
  });

  const legs = lines.flatMap(l => l.pts.slice(1).map((b, i) => ({ a: l.pts[i], b, color: l.color })));
  const features = legs.map(g => ({ type: 'Feature', properties: { color: g.color, road: false }, geometry: { type: 'LineString', coordinates: [[g.a[1], g.a[0]], [g.b[1], g.b[0]]] } }));
  const draw = () => map.getSource('route')?.setData({ type: 'FeatureCollection', features });
  draw();
  legs.forEach((g, i) => roadPath(g.a, g.b).then(path => {
    if (!path || mapView.key !== key) return;
    features[i] = { ...features[i], properties: { ...features[i].properties, road: true }, geometry: { type: 'LineString', coordinates: path.map(([lat, lng]) => [lng, lat]) } };
    draw();
  }));

  const pts = pins.map(p => [p.lng, p.lat]);
  if (pts.length === 1) map.jumpTo({ center: pts[0], zoom: 15 });
  else if (pts.length) map.fitBounds(pts.reduce((b, p) => b.extend(p), new ml.LngLatBounds(pts[0], pts[0])), { padding: 44, maxZoom: 15, duration: 0 });
}

// 두 곳 사이 실제 길(OpenStreetMap 길찾기). 3km 안은 걷는 길, 그보다 멀면 차 길로 그려요.
// 받아 온 길은 이 기기에 저장해 두고 다시 묻지 않아요. 실패하면 직선 그대로 둬요.
const roadCache = new Map(Object.entries((() => { try { return JSON.parse(localStorage.getItem('gachiga-roads') || '{}'); } catch { return {}; } })()));
function roadPath(a, b) {
  const k = [a, b].flat().map(n => (+n).toFixed(5)).join(',');
  if (roadCache.has(k)) return Promise.resolve(roadCache.get(k));
  const walk = kmBetween({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) <= 3;
  const url = `https://routing.openstreetmap.de/${walk ? 'routed-foot/route/v1/foot' : 'routed-car/route/v1/driving'}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
  const job = fetch(url).then(r => r.json()).then(d => {
    const path = d.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)]) || null;
    roadCache.set(k, path);
    try {
      const keep = Object.fromEntries([...roadCache].filter(([, v]) => v && typeof v.then !== 'function').slice(-150));
      localStorage.setItem('gachiga-roads', JSON.stringify(keep));
    } catch {}
    return path;
  }).catch(() => { roadCache.delete(k); return null; });
  roadCache.set(k, job);
  return job;
}

// 장소 이름으로 위치 찾기: Photon(이름 검색에 강함) → 없으면 Nominatim
// 무료 지도 검색은 한글 이름을 띄어 써야 잘 찾아요("도쿄타워" ✗ → "도쿄 타워" ✓).
// 못 찾으면 끝말을 띄어 한 번 더 찾아봅니다.
const PLACE_SUFFIX = /(타워|역|공원|신사|시장|거리|성|사원|절|해변|비치|공항|호텔|카페|박물관|미술관|전망대|온천|다리|섬|폭포|동물원|수족관|스카이트리|몰|백화점)$/;
async function geocode(q, near) {
  const found = await geocodeOnce(q, near);
  const spaced = !/\s/.test(q) && PLACE_SUFFIX.test(q) && q.replace(PLACE_SUFFIX, ' $1');
  if (found.length || !spaced) return found;
  await new Promise(r => setTimeout(r, 1000)); // 오픈스트리트맵 검색은 1초에 한 번까지
  return geocodeOnce(spaced, near);
}

// 여행지 한가운데: 이미 꽂힌 핀이 가장 많이 모인 곳. 핀이 없으면 도착 도시를 한 번 찾아 기억해 둬요.
let cityCenters = null;
async function tripCenter() {
  const pins = [...state.places, ...state.events].filter(hasCoords).map(p => ({ lat: +p.lat, lng: +p.lng }));
  if (pins.length) {
    const hub = pins.map(p => ({ p, n: pins.filter(q => kmBetween(p, q) < 50).length })).sort((a, b) => b.n - a.n)[0].p;
    const near = pins.filter(q => kmBetween(hub, q) < 50);
    return { lat: near.reduce((s, p) => s + p.lat, 0) / near.length, lng: near.reduce((s, p) => s + p.lng, 0) / near.length };
  }
  const city = tripRoute(state.trip || {}).toCity;
  if (!city) return null;
  try { cityCenters ||= JSON.parse(localStorage.getItem('gachiga-city-centers') || '{}'); } catch { cityCenters = {}; }
  if (!cityCenters[city]) {
    const [c] = await geocodeOnce(city).catch(() => []);
    if (!c) return null;
    cityCenters[city] = { lat: c.lat, lng: c.lng };
    try { localStorage.setItem('gachiga-city-centers', JSON.stringify(cityCenters)); } catch {}
  }
  return cityCenters[city];
}
const fmtKm = km => km < 1 ? `${Math.round(km * 1000)}m` : km < 100 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;

// Photon이 안 될 때는 잠깐 건너뛰고, 대신 쓰는 Nominatim은 규칙대로 1초에 한 번만 물어봐요.
let photonDownUntil = 0;
let nominatimNext = 0;
const nominatimSlot = () => {
  const wait = Math.max(0, nominatimNext - Date.now());
  nominatimNext = Date.now() + wait + 1100;
  return new Promise(r => setTimeout(r, wait));
};

const MAIN_PLACE = /^(aeroway:aerodrome|railway:station|public_transport:station|tourism:(attraction|museum|theme_park|zoo|aquarium|viewpoint|gallery)|amenity:university|leisure:(park|stadium)|historic:)/;
// near(여행지 가운데)를 주면 그 근처를 먼저 찾고, 가까우면서 잘 맞는 순서로 돌려줘요.
async function geocodeOnce(q, near) {
  // 순서: 검색이 맞다고 본 순서(rank)와 거리를 같이 봐요. 거리만 보면 '시애틀 공항'에서 공항보다 가까운 렌터카가 먼저 나와요.
  // 공항·역·명소처럼 대표 장소는 올리고, 도로 이름은 내려요. 같은 이름(체인점)끼리는 가까운 곳이 위로 와요.
  const byNear = list => near ? list
    .map(r => ({ ...r, km: kmBetween(near, r) }))
    .map(r => ({ ...r, score: r.rank * 0.5 + r.km / 3 + (/^highway:/.test(r.kind) ? 4 : 0) - (MAIN_PLACE.test(r.kind) ? 3 : 0) }))
    .sort((a, b) => a.score - b.score).slice(0, 8) : list;
  const pinned = state.places.filter(hasCoords);
  const center = near || pinned[0];
  const bias = center ? `&lat=${center.lat}&lon=${center.lng}` : '';
  if (Date.now() > photonDownUntil) try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=${near ? 15 : 6}&q=${encodeURIComponent(q)}${bias}`);
    if (!res.ok) throw new Error('photon');
    const data = await res.json();
    const found = data.features.map((f, rank) => {
      const a = f.properties;
      return {
        rank, kind: `${a.osm_key}:${a.osm_value}`,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        name: a.name || q,
        address: [a.street && `${a.street}${a.housenumber ? ' ' + a.housenumber : ''}`, a.district, a.city, a.state, a.country].filter(Boolean).join(', '),
      };
    });
    if (found.length) return byNear(found);
  } catch { photonDownUntil = Date.now() + 60000; }
  const nominatim = async box => {
    await nominatimSlot();
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=ko${box}&q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('위치 검색이 잠시 안 돼요. 조금 뒤에 다시 해주세요.');
    return (await res.json()).map((r, rank) => ({ rank, kind: `${r.class}:${r.type}`, lat: +r.lat, lng: +r.lon, name: r.name || q, address: r.display_name }));
  };
  // 여행지 둘레(약 50km)에서 먼저 찾고, 없으면 전체에서 찾아요.
  if (near) {
    const d = 0.5, local = await nominatim(`&bounded=1&viewbox=${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    if (local.length) return byNear(local);
  }
  return byNear(await nominatim(''));
}

// 구글맵 '긴' 링크에서 좌표를 읽습니다. (maps.app.goo.gl 같은 짧은 링크는 서버 없이 열 수 없어요)
function coordsFromUrl(u) {
  const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || u.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}

// --- 인스타 ---
// 게시물·릴스 링크에서 코드를 뽑아 공식 임베드(로그인 없이 공개 게시물만)로 보여줍니다.
const igCode = u => String(u || '').match(IG_RE)?.[1];
// 공유받은 글이나 클립보드에서 링크만 골라냅니다. 인스타 링크가 있으면 그걸 먼저.
function extractLink(text) {
  const t = String(text || '');
  return t.match(IG_RE)?.[0] || t.match(/https?:\/\/[^\s<>"']+/i)?.[0] || '';
}

// 인스타 임베드가 알려주는 실제 높이로 칸 크기를 맞춥니다.
window.addEventListener('message', e => {
  if (e.origin !== 'https://www.instagram.com') return;
  let d;
  try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
  const h = d?.type === 'MEASURE' && Number(d.details?.height);
  if (!h) return;
  document.querySelectorAll('.igpost:not(.fixed) iframe').forEach(f => { if (f.contentWindow === e.source) f.style.height = `${h}px`; });
});

function placeDetail(id) {
  const p = state.places.find(x => x.id === id);
  if (!p) return;
  const scheduled = state.events.find(e => e.placeId === p.id);
  const ig = igCode(p.url);
  openSheet(esc(p.name), `
    <div class="gmap"><iframe src="${esc(googleEmbedUrl(p))}" title="구글 지도" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
    ${p.address ? `<p class="place-addr">${icon('pin', 15)} ${esc(p.address)}</p>` : hasCoords(p) ? '' : `<p class="place-addr muted">위치가 없어서 이름으로 검색한 결과예요. 수정에서 위치를 정해주세요.</p>`}
    ${p.note ? `<p class="place-note">${esc(p.note)}</p>` : ''}
    ${ig ? `<div class="igpost"><iframe src="https://www.instagram.com/p/${esc(ig)}/embed/" title="인스타그램 게시물" loading="lazy" scrolling="no" allowtransparency="true"></iframe></div>` : ''}
    <div class="btn-row">
      <a class="btn" href="${esc(googleMapsUrl(p))}" target="_blank" rel="noopener">${icon('compass', 18)} 구글맵</a>
      ${p.url ? `<a class="btn" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">${icon(ig ? 'insta' : 'link', 18)} ${ig ? '인스타' : '원본'}</a>` : ''}
      <button type="button" class="btn" data-action="edit-place" data-id="${esc(p.id)}">${icon('pencil', 18)} 수정</button>
    </div>
    ${scheduled ? `<p class="muted small center">${scheduled.date ? fmtDate(scheduled.date) + ' ' : ''}일정에 들어 있어요</p>`
      : `<button type="button" class="btn primary block" data-action="place-to-event" data-id="${esc(p.id)}">${icon('calendar', 18)} 일정에 넣기</button>`}
  `);
}

// --- 정산 ---

function tally() {
  const paid = {}, owed = {};
  let total = 0, missing = 0, mixed = false;
  const spent = {};
  for (const x of state.expenses) {
    const amt = xAmt(x);
    if (xCur(x) !== currency()) mixed = true;
    if (amt == null) { missing++; continue; }
    const among = x.splitAmong?.length ? x.splitAmong : state.trip.members;
    // '보냈어요'로 남긴 송금은 보낸 사람이 내고 받은 사람이 진 것으로 쳐서 남은 정산에서 빠지게 해요(총 지출엔 안 넣어요).
    if (x.kind !== 'transfer') { total += amt; spent[x.paidBy] = (spent[x.paidBy] || 0) + amt; }
    paid[x.paidBy] = (paid[x.paidBy] || 0) + amt;
    for (const uid of among) owed[uid] = (owed[uid] || 0) + amt / among.length;
  }
  return { paid, owed, total, spent, missing, mixed };
}

// 받을 사람과 보낼 사람을 큰 금액부터 짝지어 송금 횟수를 줄입니다.
function settle(balances) {
  const unit = minorUnit();
  const cred = balances.filter(([, b]) => b > unit / 2).map(([uid, b]) => ({ uid, b })).sort((a, b) => b.b - a.b);
  const debt = balances.filter(([, b]) => b < -unit / 2).map(([uid, b]) => ({ uid, b: -b })).sort((a, b) => b.b - a.b);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].b, cred[j].b);
    const rounded = Math.round(amt / unit) * unit;
    if (rounded >= unit) out.push({ from: debt[i].uid, to: cred[j].uid, amount: rounded });
    debt[i].b -= amt;
    cred[j].b -= amt;
    if (debt[i].b < unit / 2) i++;
    if (cred[j].b < unit / 2) j++;
  }
  return out;
}

function viewExpenses() {
  loadRates();
  const members = state.trip.members;
  const solo = members.length < 2;
  const { paid, owed, total, spent, missing, mixed } = tally();
  const transfers = settle(members.map(uid => [uid, (paid[uid] || 0) - (owed[uid] || 0)]));
  const byNew = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);
  const list = state.expenses.filter(x => x.kind !== 'transfer').sort(byNew);
  const sent = state.expenses.filter(x => x.kind === 'transfer').sort(byNew);
  const totalKRW = currency() !== 'KRW' && total ? toKRW(total, currency()) : null;
  return `
    <section class="receipt">
      <div class="receipt-head">
        <span>TRAVEL RECEIPT</span>
        <button class="currency-btn" data-action="pick-currency" aria-label="통화 바꾸기">${esc(currency())} ${icon('chevronDown', 14)}</button>
      </div>
      <div class="receipt-total-label">총 지출</div>
      <div class="receipt-total">${money(total)}</div>
      ${totalKRW != null ? `<div class="receipt-krw">약 ${fmtKRW(totalKRW)}</div>` : ''}
      ${missing ? '<p class="receipt-note">환율을 불러오는 중이라 외화로 쓴 지출이 아직 빠져 있어요.</p>'
        : mixed && fxRates ? `<p class="receipt-note">외화로 쓴 지출은 ${fxWhen()} 환율로 계산했어요.</p>` : ''}
      ${solo ? `<p class="receipt-note">혼자 가는 여행이라 기록만 해요. 친구가 합류하면 정산이 자동으로 켜져요.</p>` : `
      <div class="receipt-rows">
        ${members.map(uid => `
          <div class="receipt-row">
            ${avatar(uid, 'sm')}
            <span class="rr-name">${esc(memberName(uid))}</span>
            <span class="rr-paid">${money(spent[uid] || 0)}</span>
          </div>`).join('')}
      </div>`}
    </section>

    ${solo ? '' : `<section class="card">
      <h2 class="section-title">정산하기</h2>
      ${transfers.length
        ? transfers.map(x => `
          <div class="transfer">
            ${avatar(x.from, 'sm')}<b>${esc(memberName(x.from))}</b>
            <span class="arrow">→</span>
            ${avatar(x.to, 'sm')}<b>${esc(memberName(x.to))}</b>
            <span class="transfer-amt">${money(x.amount)}</span>
            <button class="btn-sm subtle sent-btn" data-action="mark-sent" data-from="${esc(x.from)}" data-to="${esc(x.to)}" data-amount="${x.amount}">${icon('check', 14)} 보냈어요</button>
          </div>`).join('')
        : `<p class="muted small">${total ? '모두 깔끔하게 정산됐어요.' : '쓴 돈을 기록하면 누가 누구에게 얼마 보낼지 알려드려요.'}</p>`}
      ${total ? `<button class="btn subtle copy-settle" data-action="copy-settle">${icon('copy', 16)} 정산 내용 복사해서 보내기</button>` : ''}
      ${sent.length ? `
        <div class="sent-list">
          <p class="muted xsmall">보낸 기록</p>
          ${sent.map(x => `
            <div class="sent-row">
              ${icon('check', 14)}<span>${esc(memberName(x.paidBy))} → ${esc(memberName(x.splitAmong?.[0]))} <b>${xMoney(x)}</b>${x.date ? ` · ${fmtShort(x.date)}` : ''}</span>
              <button class="sent-undo" data-action="undo-sent" data-id="${esc(x.id)}" aria-label="보낸 기록 지우기">${icon('x', 14)}</button>
            </div>`).join('')}
        </div>` : ''}
    </section>`}

    ${fxCard()}

    ${list.length ? `<h2 class="section-title pad">지출 내역</h2>${list.map(expenseRow).join('')}` : ''}`;
}

// 환율: Coinbase 공개 환율(1분마다 바뀌는 시장 환율)을 받아요. 안 되면 하루 한 번 바뀌는 환율로 대신해요.
// 화면이 열려 있으면 1분마다 다시 그리면서 10분 지난 환율은 새로 받아요. 실패하면 2분 뒤에 다시 시도해요.
function loadRates() {
  if (!fxRates) try { fxRates = JSON.parse(localStorage.getItem('gachiga-fx') || 'null'); } catch {}
  if (fxRates && Date.now() - fxRates.time < 600e3) return;
  if (fxState.loading || Date.now() - fxState.failAt < 120e3) return;
  fxState.loading = true;
  fetch('https://api.coinbase.com/v2/exchange-rates?currency=KRW')
    .then(r => r.json())
    .then(j => {
      const rates = Object.fromEntries(CURRENCIES.map(([c]) => [c, c === 'KRW' ? 1 : +j.data.rates[c]]));
      if (!Object.values(rates).every(v => v > 0)) throw new Error('rates');
      return { time: Date.now(), updated: Date.now(), rates };
    })
    .catch(() => fetch('https://open.er-api.com/v6/latest/KRW').then(r => r.json()).then(j => {
      if (j.result !== 'success') throw new Error('rates');
      return { time: Date.now(), updated: j.time_last_update_unix * 1000, rates: j.rates };
    }))
    .then(r => {
      fxRates = r;
      try { localStorage.setItem('gachiga-fx', JSON.stringify(fxRates)); } catch {}
      render();
    })
    .catch(() => { fxState.failAt = Date.now(); })
    .finally(() => { fxState.loading = false; });
}
// 환율 받은 때: 11.13 09:01
function fxWhen() {
  const d = new Date(fxRates.updated);
  return `${fmtShort(toDateStr(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const fxStep = cur => 10 ** -formatter(cur).resolvedOptions().maximumFractionDigits;
// 지출 기록 창의 금액 아래 안내: 원이 아니면 원으로, 원이면 지금 보는 돈으로 환산해 보여줘요.
function amountHint(amount, cur) {
  if (!(+amount > 0)) return '';
  const to = cur === 'KRW' ? currency() : 'KRW';
  const v = to === cur ? null : conv(+amount, cur, to);
  return v != null ? '약 ' + formatter(to).format(roundFx(v, to)) : '';
}
function toKRW(n, cur) { return fxRates?.rates?.[cur] ? n / fxRates.rates[cur] : null; }
function fromKRW(n, cur) { return fxRates?.rates?.[cur] ? n * fxRates.rates[cur] : null; }
function conv(n, from, to) {
  if (from === to) return n;
  const r = fxRates?.rates;
  return r?.[from] && r?.[to] ? n / r[from] * r[to] : null;
}
// 기록한 통화 그대로의 금액(₩10,000)
const xMoney = x => formatter(xCur(x)).format(Number(x.amount) || 0);
function fmtKRW(n) { return formatter('KRW').format(Math.round(n)); }
const roundFx = (n, cur) => { const d = formatter(cur).resolvedOptions().maximumFractionDigits; return +n.toFixed(d); };

// 환율 계산기: 위 칸(외화)이나 아래 칸(원)에 적으면 다른 칸이 바로 바뀌어요.
function fxCard() {
  const cur = fxState.cur || (currency() !== 'KRW' ? currency() : 'USD');
  fxState.cur = cur;
  const krw = fxState.amount !== '' ? toKRW(+fxState.amount, cur) : null;
  return `
  <section class="card fx-card">
    <h2 class="section-title">환율 계산기</h2>
    <div class="fx-row">
      <input data-fx="amount" type="number" inputmode="decimal" min="0" placeholder="0" value="${esc(fxState.amount)}">
      <select data-fx="cur" aria-label="통화">${CURRENCIES.filter(([c]) => c !== 'KRW').map(([c, label]) => `<option value="${c}" ${c === cur ? 'selected' : ''}>${label}</option>`).join('')}</select>
    </div>
    <div class="fx-eq">${icon('swap', 16)}</div>
    <div class="fx-row">
      <input data-fx="krw" type="number" inputmode="numeric" min="0" placeholder="0" value="${krw != null ? Math.round(krw) : ''}">
      <span class="fx-unit">한국 원</span>
    </div>
    <p class="muted xsmall fx-rate">${fxRateText(cur)}</p>
  </section>`;
}
function onFxInput(el) {
  const card = el.closest('.fx-card');
  const cur = card.querySelector('[data-fx=cur]').value;
  const $amt = card.querySelector('[data-fx=amount]'), $krw = card.querySelector('[data-fx=krw]');
  fxState.cur = cur;
  if (el.dataset.fx === 'krw') {
    const v = fromKRW(+$krw.value, cur);
    $amt.value = $krw.value === '' || v == null ? '' : roundFx(v, cur);
  } else {
    const v = toKRW(+$amt.value, cur);
    $krw.value = $amt.value === '' || v == null ? '' : Math.round(v);
  }
  fxState.amount = $amt.value;
  if (el.dataset.fx === 'cur') card.querySelector('.fx-rate').textContent = fxRateText(cur);
}
// 엔·동처럼 1단위가 작은 돈은 100단위로 보여줘요. (100 JPY = 930원)
function fxRateText(cur) {
  const one = toKRW(1, cur);
  if (one == null) return '환율을 불러오는 중이에요…';
  const n = one < 10 ? 100 : 1;
  return `${n} ${cur} = ${Math.round(one * n).toLocaleString('ko-KR')}원 · ${fxWhen()} 기준`;
}

// 날씨: 무료 날씨 서비스(Open-Meteo)에서 여행지 날씨를 받아 DAY 옆에 보여줘요.
// 예보는 오늘부터 16일 뒤까지만 있어서, 그보다 먼 날은 가까워지면 떠요. 3시간 동안 이 기기에 저장해 둬요.
const WX = [
  [[0], 'wx_sun', '맑음'], [[1, 2], 'wx_partly', '구름 조금'], [[3], 'wx_cloud', '흐림'], [[45, 48], 'wx_fog', '안개'],
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], 'wx_rain', '비'], [[71, 73, 75, 77, 85, 86], 'wx_snow', '눈'], [[95, 96, 99], 'wx_storm', '뇌우'],
];
function wantWeather() {
  const t = state.trip;
  if (!t?.startDate || state.tab !== 'timeline') return;
  const id = [state.tripId, t.startDate, t.endDate, t.to].join('|');
  if (wx.for === id) return;
  wx.for = id;
  wx.days = null;
  loadWeather(t).catch(() => {});
}
async function loadWeather(t) {
  const today = todayStr();
  const from = t.startDate > addDays(today, -60) ? t.startDate : addDays(today, -60);
  const end = t.endDate || t.startDate, last = addDays(today, 15);
  const to = end < last ? end : last;
  if (from > to) return; // 아직 너무 먼 여행
  const c = await tripCenter();
  if (!c) return;
  const key = `${c.lat.toFixed(2)},${c.lng.toFixed(2)},${from},${to}`;
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem('gachiga-wx') || 'null'); } catch {}
  let days = cache?.key === key && Date.now() - cache.time < 3 * 3600e3 ? cache.days : null;
  if (!days) {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(4)}&longitude=${c.lng.toFixed(4)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${from}&end_date=${to}`);
    if (!res.ok) return;
    const d = (await res.json()).daily;
    days = {};
    d.time.forEach((date, i) => { if (d.weather_code[i] != null) days[date] = { code: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_probability_max?.[i] ?? null }; });
    try { localStorage.setItem('gachiga-wx', JSON.stringify({ key, time: Date.now(), days })); } catch {}
  }
  if (wx.for !== [state.tripId, t.startDate, t.endDate, t.to].join('|')) return;
  wx.days = days;
  render();
}
function wxBadge(date) {
  const w = wx.days?.[date];
  if (!w) return '';
  const [, ic, label] = WX.find(([codes]) => codes.includes(w.code)) || WX[2];
  const color = { wx_sun: '#f08c00', wx_partly: '#f08c00', wx_rain: '#3a86ff', wx_storm: '#7c5cd6', wx_snow: '#1098ad' }[ic] || '#8a94a6';
  return `<span class="day-wx" title="${label}" style="--wx:${color}">${icon(ic, 16)}<b>${w.max}°</b><span>${w.min}°</span>${w.rain >= 30 ? `<i class="wx-rain">${icon('drop', 11)}${w.rain}%</i>` : ''}</span>`;
}

function expenseRow(x) {
  const among = x.splitAmong?.length ? x.splitAmong : state.trip.members;
  const solo = state.trip.members.length < 2;
  const who = among.length >= state.trip.members.length ? `${among.length}명 모두` : among.map(memberName).map(esc).join(', ');
  const meta = solo ? (x.date ? fmtShort(x.date) : '') : `${esc(memberName(x.paidBy))} 결제 · ${who}${x.date ? ' · ' + fmtShort(x.date) : ''}`;
  return `
  <button class="card expense" data-action="edit-expense" data-id="${esc(x.id)}">
    ${solo ? `<span class="expense-ico">${icon('wallet', 18)}</span>` : avatar(x.paidBy, 'sm')}
    <span class="expense-body">
      <span class="expense-title">${esc(x.title)}</span>
      <span class="muted xsmall">${meta}</span>
    </span>
    <span class="expense-amt">${xMoney(x)}${xCur(x) !== currency() && xAmt(x) != null ? `<small>약 ${money(xAmt(x))}</small>` : ''}</span>
  </button>`;
}

// ---------- 시트(입력창) ----------

// onSubmit 반환값: 문자열 = 오류 안내(시트 유지), false = 시트 유지, 그 외 = 닫기
function openSheet(title, body, onSubmit, { danger, save = '저장' } = {}) {
  sheetSubmit = onSubmit || null;
  sheetDanger = danger || null;
  sheetLive = null;
  $sheet.innerHTML = `
    <div class="backdrop" data-action="close-sheet"></div>
    <form class="sheet" data-form="sheet" autocomplete="off" novalidate>
      <div class="grabber"></div>
      <div class="sheet-head">
        <button type="button" class="link" data-action="close-sheet">${onSubmit ? '취소' : '닫기'}</button>
        <h3>${title}</h3>
        ${onSubmit && save ? `<button class="link strong">${save}</button>` : '<span class="link"></span>'}
      </div>
      <div class="sheet-body">${body}</div>
      ${danger ? `<button type="button" class="btn danger-outline block" data-action="sheet-danger">${icon(danger.icon || 'trash', 18)} ${danger.label}</button>` : ''}
    </form>`;
  requestAnimationFrame(() => $sheet.classList.add('open'));
}

// 데이터가 바뀌면 내용을 다시 그리는 시트 (입력칸 없는 목록용)
function openLiveSheet(title, renderBody) {
  openSheet(title, renderBody());
  sheetLive = renderBody;
}
function refreshLiveSheet() {
  const body = sheetLive && $sheet.querySelector('.sheet-body');
  if (body) body.innerHTML = sheetLive();
}

// 확인 창. 브라우저 기본 confirm()은 홈 화면 앱·인앱 브라우저에서 막히는 경우가 있어 직접 그립니다.
function ask(message, { ok = '확인', danger = true } = {}) {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'dialog-root';
    root.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true">
        <p>${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="dialog-actions">
          <button type="button" class="btn" data-answer="no">취소</button>
          <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-answer="yes">${esc(ok)}</button>
        </div>
      </div>`;
    const done = yes => {
      root.classList.remove('open');
      setTimeout(() => root.remove(), 200);
      resolve(yes);
    };
    root.addEventListener('click', e => {
      e.stopPropagation();
      const b = e.target.closest('[data-answer]');
      if (b) done(b.dataset.answer === 'yes');
      else if (e.target === root) done(false);
    });
    document.body.append(root);
    requestAnimationFrame(() => root.classList.add('open'));
    root.querySelector('[data-answer=yes]').focus();
  });
}

function closeSheet() {
  $sheet.classList.remove('open');
  sheetSubmit = sheetDanger = sheetLive = null;
  setTimeout(() => { if (!$sheet.classList.contains('open')) $sheet.innerHTML = ''; }, 250);
}

// 공항 고르기: 보이는 칸에서 검색하고, 고른 코드는 숨은 칸(name=from/to)에 들어갑니다.
const airportLabel = code => {
  const a = airportByCode(code);
  return a ? `${a.code} · ${a.city} ${a.name}` : code ? `${code}${cityOfCode(code) ? ' · ' + cityOfCode(code) : ''}` : '';
};
const airportField = (name, label, code, mode = '') => `
  <div class="field ap-field" data-mode="${mode}">
    <span>${label}</span>
    <input type="hidden" name="${name}" value="${esc(code)}">
    <div class="ap-box">${icon('search', 16)}<input class="ap-q" placeholder="도시·공항 이름이나 코드" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(airportLabel(code))}"></div>
    <div class="ap-results"></div>
  </div>`;

function setAirport(box, code) {
  box.querySelector('input[type=hidden]').value = code;
  box.querySelector('.ap-q').value = airportLabel(code);
  box.querySelector('.ap-results').innerHTML = '';
}

function searchAirportField(box) {
  const q = box.querySelector('.ap-q').value;
  const found = searchAirports(q);
  box.dataset.mode = '';
  box.querySelector('input[type=hidden]').value = /^[a-z]{3}$/i.test(q.trim()) ? q.trim().toUpperCase() : found[0]?.code || '';
  box.querySelector('.ap-results').innerHTML = found.map(a => `
    <button type="button" class="ap-item" data-action="ap-pick" data-code="${a.code}">
      <b>${a.code}</b><span><b>${esc(a.city)}</b> ${esc(a.name)}<small>${esc(a.country)}</small></span>
    </button>`).join('') || (q.trim() ? '<p class="search-msg">목록에 없는 공항이면 3글자 코드를 그대로 적어주세요.</p>' : '');
}

const field = (label, input) => `<label class="field"><span>${label}</span>${input}</label>`;

// 여행 창의 "이동수단": 비행기 · 기차 · 고속버스 · 자동차. 고른 수단에 맞춰 출발·도착 칸이 바뀌어요.
// 비행기는 공항, 기차는 역, 고속버스는 터미널을 검색해서 고르고, 자동차는 직접 적어요.
const STOP_FIELD = {
  train: ['출발역', '도착역', '역 이름 (서울, 부산, 강릉)', '기차역 이름으로 찾을 수 있어요.'],
  bus: ['출발 터미널', '도착 터미널', '터미널이나 도시 이름', '터미널이나 도시 이름으로 찾을 수 있어요.'],
};
const stopField = (kind, name, label, value) => `
  <div class="field ap-field stop-field" data-kind="${kind}">
    <span>${label}</span>
    <div class="ap-box">${icon('search', 16)}<input class="stop-q" name="${name}" maxlength="20" placeholder="${STOP_FIELD[kind][2]}" autocomplete="off" spellcheck="false" value="${esc(value)}"></div>
    <div class="ap-results"></div>
  </div>`;
function searchStopField(box) {
  const kind = box.dataset.kind, q = box.querySelector('.stop-q').value;
  box.querySelector('.ap-results').innerHTML = searchStops(kind, q).map(s => `
    <button type="button" class="ap-item stop-item" data-action="stop-pick" data-name="${esc(s.name)}">${icon(kind === 'train' ? 'm_train' : 'm_bus', 18)}<span><b>${esc(s.name)}</b> ${esc(s.full)}<small>${esc(s.city)}</small></span></button>`).join('')
    || (q.trim() ? '<p class="search-msg">목록에 없는 곳이면 이름을 그대로 적어도 돼요.</p>' : '');
}
function routeBlock(mode, t) {
  const same = t && modeOf(t) === mode;
  const btn = (m, ic) => `<button type="button" class="mode-btn${mode === m ? ' on' : ''}" data-action="pick-mode" data-mode="${m}">${icon(ic, 22)}${MODES[m]}</button>`;
  const fields = mode === 'plane' ? `
    ${airportField('from', '출발 공항', same ? t.from || '' : '')}
    ${airportField('to', '도착 공항', same && t.to ? t.to : guessAirport(t?.name)?.code || '', same && t.to ? '' : 'auto')}
    <p class="muted xsmall">탑승권에 보여요. 도시나 공항 이름(시애틀, 하네다, seattle)이나 코드(SEA)로 찾을 수 있어요. 도착을 비워 두면 여행 이름에 든 도시로 채워요.</p>`
  : mode === 'car' ? `
    <div class="row">
      ${field('출발지', `<input name="from" maxlength="20" placeholder="서울" value="${esc(same ? t.from : '')}">`)}
      ${field('도착지', `<input name="to" maxlength="20" placeholder="강릉" value="${esc(same ? t.to : '')}">`)}
    </div>
    <p class="muted xsmall">표지판에 보여요. 도착지는 날씨를 찾을 때도 써요.</p>` : `
    ${stopField(mode, 'from', STOP_FIELD[mode][0], same ? t.from || '' : '')}
    ${stopField(mode, 'to', STOP_FIELD[mode][1], same ? t.to || '' : '')}
    <p class="muted xsmall">${STOP_FIELD[mode][3]} 목록에 없는 곳은 그대로 적어도 돼요.</p>`;
  return `
    <input type="hidden" name="mode" value="${mode}">
    <div class="field"><span>이동수단</span>
      <div class="mode-pick">${btn('plane', 'm_plane')}${btn('train', 'm_train')}${btn('bus', 'm_bus')}${btn('car', 'm_car')}</div>
    </div>
    ${fields}`;
}

function tripSheet(t) {
  const owner = t && isOwner(t);
  openSheet(t ? '여행 설정' : '새 여행', `
    ${field('여행 이름', `<input name="name" required maxlength="40" placeholder="예: 오사카 먹방 여행" value="${esc(t?.name)}">`)}
    <div class="row">
      ${field('가는 날', `<input type="date" name="startDate" value="${esc(t?.startDate)}">`)}
      ${field('오는 날', `<input type="date" name="endDate" value="${esc(t?.endDate)}">`)}
    </div>
    <div class="route-block" data-trip="${esc(t?.id || '')}">${routeBlock(modeOf(t), t)}</div>
    ${t ? `<p class="muted xsmall">${owner ? '캡틴은 여행을 삭제할 수 있어요. 삭제하면 모든 멤버에게서 사라져요.' : '여행에서 나가면 다시 초대받기 전까지 볼 수 없어요.'}</p>` : ''}
  `, d => {
    if (!d.name.trim()) return '여행 이름을 적어주세요.';
    if (d.startDate && d.endDate && d.endDate < d.startDate) return '오는 날이 가는 날보다 빨라요.';
    const code = v => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const mode = MODES[d.mode] ? d.mode : 'plane';
    const place = v => String(v || '').trim().slice(0, 20);
    const pick = mode === 'plane' ? code : place;
    const data = { name: d.name.trim(), startDate: d.startDate, endDate: d.endDate || d.startDate, mode, from: pick(d.from), to: pick(d.to) };
    if (t) return store.updateTrip(t.id, data);
    const { id, done } = store.createTrip(me(), data);
    location.hash = `#/trip/${id}`;
    // 만들자마자 멤버를 초대할 수 있게 멤버 화면을 띄웁니다.
    setTimeout(membersSheet, 400);
    return done;
  }, {
    danger: !t ? null : owner ? {
      label: '여행 삭제',
      confirm: `"${t.name}" 여행을 삭제할까요?\n일정·장소·정산이 모두 지워지고 되돌릴 수 없어요.`,
      run: () => { const id = t.id; closeTrip(); location.hash = '#/'; return store.deleteTrip(id); },
      ok: '여행을 삭제했어요',
    } : {
      label: '여행에서 나가기', icon: 'logout',
      confirm: `"${t.name}" 여행에서 나갈까요?`,
      run: () => { const id = t.id; closeTrip(); location.hash = '#/'; return store.removeMember(id, state.user.uid); },
      ok: '여행에서 나왔어요',
    },
  });
}

function membersSheet() {
  if (!state.trip) return;
  openLiveSheet('멤버', () => {
    const t = state.trip;
    if (!t) return '';
    const owner = isOwner(t);
    const invitedIds = t.invitedIds || [];
    const candidates = state.friends.filter(f => !t.members.includes(f.uid) && !invitedIds.includes(f.uid));
    const info = uid => ({ uid, ...t.memberInfo?.[uid] });
    return `
      <h4 class="section-title">함께하는 멤버 <span class="count">${t.members.length}</span></h4>
      <div class="card list flat">
        ${t.members.map(uid => personRow(info(uid),
          uid === t.ownerId ? `<span class="badge">${icon('crown', 13)} 캡틴</span>`
          : owner ? `<button class="btn-sm subtle-danger" data-action="remove-member" data-id="${esc(uid)}">${icon('userMinus', 16)} 내보내기</button>`
          : uid === state.user.uid ? '<span class="badge soft">나</span>' : '')).join('')}
      </div>
      ${invitedIds.length ? `
        <h4 class="section-title">수락 대기 중 <span class="count">${invitedIds.length}</span></h4>
        <div class="card list flat">
          ${invitedIds.map(uid => personRow({ uid, ...t.invitedInfo?.[uid] },
            owner ? `<button class="btn-sm subtle" data-action="cancel-invite" data-id="${esc(uid)}">초대 취소</button>` : '<span class="badge soft">대기 중</span>')).join('')}
        </div>` : ''}
      ${owner ? `
        <h4 class="section-title">친구 초대하기</h4>
        ${candidates.length ? `
          <div class="card list flat">
            ${candidates.map(f => personRow(f, `<button class="btn-sm primary" data-action="invite-friend" data-id="${esc(f.uid)}">${icon('plus', 16)} 초대</button>`)).join('')}
          </div>` : `
          <div class="empty-mini">
            ${state.friends.length ? '친구를 모두 초대했어요.' : '아직 친구가 없어요.<br>프로필에서 아이디로 친구를 먼저 추가해 주세요.'}
            <a class="btn block" href="#/me">${icon('userPlus', 18)} 친구 추가하러 가기</a>
          </div>`}
        <p class="muted xsmall">초대받은 친구가 수락해야 멤버가 돼요. 내보낸 멤버는 이 여행을 더 이상 볼 수 없어요.</p>` : `
        <p class="muted xsmall">멤버 초대와 내보내기는 캡틴만 할 수 있어요.</p>`}
    `;
  });
}

let lastFound = null;

function addFriendSheet() {
  lastFound = null;
  openSheet('친구 추가', `
    <p class="muted small">친구의 아이디를 입력하세요. 친구가 수락하면 서로 친구가 돼요.</p>
    <div class="search-box">
      <span>@</span>
      <input name="handle" placeholder="friend_id" autocapitalize="off" autocomplete="off" spellcheck="false">
      <button type="submit" class="btn-sm primary">${icon('search', 16)} 찾기</button>
    </div>
    <div class="search-result"></div>
    <div class="my-handle">
      <span class="muted small">내 아이디</span> <b>@${esc(me().handle)}</b>
      <button type="button" class="btn-sm subtle" data-action="copy-handle">${icon('copy', 14)} 복사</button>
    </div>
  `, (d, form) => {
    searchHandle(d.handle, form.querySelector('.search-result'));
    return false;
  }, { save: null });
}

function friendStatus(uid) {
  if (state.friends.some(f => f.uid === uid)) return 'friend';
  if (state.requestsOut.some(r => r.to === uid)) return 'sent';
  if (state.requestsIn.some(r => r.from === uid)) return 'received';
  return 'none';
}

function searchResultHtml(p) {
  const status = friendStatus(p.uid);
  const button = status === 'friend' ? `<span class="badge">${icon('check', 13)} 친구</span>`
    : status === 'sent' ? '<span class="badge soft">요청 보냄</span>'
    : status === 'received' ? `<button type="button" class="btn-sm primary" data-action="send-request">${icon('check', 16)} 수락</button>`
    : `<button type="button" class="btn-sm primary" data-action="send-request">${icon('userPlus', 16)} 친구 요청</button>`;
  return personRow(p, button);
}

async function searchHandle(raw, $out) {
  const handle = String(raw || '').trim().replace(/^@/, '').toLowerCase();
  if (!HANDLE_RE.test(handle)) { $out.innerHTML = `<p class="search-msg">아이디는 영문 소문자·숫자·_·. 3~20자예요.</p>`; return; }
  $out.innerHTML = `<p class="search-msg">찾는 중…</p>`;
  try {
    const p = await store.findByHandle(handle);
    lastFound = p;
    $out.innerHTML = !p ? `<p class="search-msg">@${esc(handle)} 아이디를 찾을 수 없어요.</p>`
      : p.uid === state.user.uid ? `<p class="search-msg">내 아이디예요.</p>`
      : searchResultHtml(p);
  } catch (e) {
    $out.innerHTML = `<p class="search-msg">${esc(errorText(e))}</p>`;
  }
}

// 아이디를 적는 동안 이미 누가 쓰는지 바로 알려줘요. (저장할 때도 서버가 한 번 더 막아요)
let handleCheckTimer;
function checkHandleInput(input) {
  const $st = input.closest('form')?.querySelector('.handle-status');
  if (!$st) return;
  const clean = input.value.toLowerCase().replace(/^@/, '');
  if (clean !== input.value) input.value = clean;
  const show = (cls, text) => { $st.className = `handle-status ${cls}`; $st.innerHTML = text; };
  clearTimeout(handleCheckTimer);
  if (!HANDLE_RE.test(clean)) return show('bad', clean ? '영문 소문자·숫자·_·. 3~20자로 적어주세요' : '');
  if (clean === me().handle) return show('', '지금 쓰는 아이디예요');
  show('', '확인하는 중…');
  handleCheckTimer = setTimeout(async () => {
    let taken;
    try { taken = await store.findByHandle(clean); } catch { return show('', ''); }
    if (input.value !== clean) return;
    taken && taken.uid !== state.user.uid
      ? show('bad', `${icon('x', 14)} 이미 누가 쓰고 있어요`)
      : show('ok', `${icon('check', 14)} 쓸 수 있어요`);
  }, 400);
}

function handleSheet() {
  openSheet('아이디 변경', `
    <label class="handle-input"><span>@</span>
      <input name="handle" value="${esc(me().handle)}" maxlength="20" autocapitalize="off" autocomplete="off" spellcheck="false">
    </label>
    <p class="handle-status" aria-live="polite"></p>
    <p class="muted xsmall">영문 소문자 · 숫자 · _ · . 으로 3~20자. 바꾸면 예전 아이디로는 나를 찾을 수 없어요.</p>
  `, d => {
    const handle = d.handle.trim().replace(/^@/, '').toLowerCase();
    if (!HANDLE_RE.test(handle)) return '아이디는 영문 소문자·숫자·_·. 3~20자예요.';
    return store.setHandle(state.user.uid, handle).then(() => toast('아이디를 바꿨어요'));
  });
  checkHandleInput($sheet.querySelector('input[name=handle]'));
}

// 날짜: DAY 칸의 '일정 추가'로 열면 그날로 정해져 있어요. 그 밖에는 DAY 버튼으로 골라요(여행 날짜가 없으면 달력).
function eventSheet(e = {}, { fixedDay = false } = {}) {
  const days = tripDays(state.trip);
  if (e.date && !days.includes(e.date)) days.push(e.date), days.sort();
  const dayField = fixedDay && e.date
    ? `<div class="ev-day">${icon('calendar', 16)} <b>${dayLabel(e.date)}</b> ${fmtDate(e.date)}<input type="hidden" name="date" value="${esc(e.date)}"></div>`
    : days.length
      ? field('날짜', `<div class="chips day-chips">
          ${days.map(d => `<label class="chip"><input type="radio" name="date" value="${d}" ${e.date === d ? 'checked' : ''}><span><b>${dayLabel(d)}</b><small>${fmtDate(d).replace(/\s*\(.*/, '')}</small></span></label>`).join('')}
          <label class="chip"><input type="radio" name="date" value="" ${!e.date ? 'checked' : ''}><span><b>미정</b><small>날짜 없음</small></span></label>
        </div>`)
      : field('날짜', `<input type="date" name="date" value="${esc(e.date)}">`);
  openSheet(e.id ? '일정 수정' : '일정 추가', `
    ${fixedDay && e.date ? dayField : ''}
    ${field('무엇을 할까요', `<input name="title" required maxlength="60" placeholder="예: 도톤보리에서 저녁" value="${esc(e.title)}">`)}
    ${fixedDay && e.date ? '' : dayField}
    <div class="row">
      ${field('시작', `<input type="time" name="time" value="${esc(e.time)}">`)}
      ${field('끝', `<input type="time" name="endTime" value="${esc(e.endTime)}">`)}
    </div>
    <div class="field place-field"><span>장소</span>
      <input name="place" maxlength="60" autocomplete="off" placeholder="모아둔 장소에서 고르거나 직접 입력" value="${esc(e.place)}">
      <input type="hidden" name="plat"><input type="hidden" name="plng"><input type="hidden" name="paddr">
      <div class="place-suggest"></div>
      <div class="place-found"></div>
      ${e.id && e.place && !e.placeId && !hasCoords(e)
        ? `<button type="button" class="btn-sm subtle need-loc" data-action="ev-geo-again">${icon('pin', 14)} 아직 지도에 없어요 · 위치 고르기</button>`
        : '<small class="hint">장소를 적으면 후보가 떠요. 맞는 곳을 골라야 일정 지도에 핀이 꽂혀요.</small>'}
    </div>
    ${field('메모', `<textarea name="note" rows="2" maxlength="300" placeholder="예약번호, 준비물 등">${esc(e.note)}</textarea>`)}
  `, (d, form) => {
    if (!d.title.trim()) return '무엇을 할지 적어주세요.';
    if (d.endTime && !d.time) return '끝나는 시간을 넣으려면 시작 시간도 정해주세요.';
    if (d.endTime && d.endTime <= d.time) return '끝나는 시간이 시작보다 늦어야 해요.';
    const place = d.place.trim();
    const linked = state.places.find(p => p.name === place);
    const data = { title: d.title.trim(), date: d.date || '', time: d.time, endTime: d.endTime || '', place, placeId: linked?.id || '', note: d.note.trim() };
    // 확인은 바로 하고(틀리면 시트에 남아요), 위치 찾기와 저장은 시트를 닫은 뒤에 이어서 해요.
    // 날짜나 시간을 바꾸면 끌어서 정한 순서는 풀고, 시간에 맞는 자리로 가요.
    if (e.id && (data.date !== (e.date || '') || data.time !== (e.time || ''))) data.order = null;
    // 위치는 목록이나 지도에서 직접 고른 것만 저장해요(자동으로 아무 데나 넣지 않아요).
    // 모아둔 장소면 그 장소 위치를 쓰고, 고르지 않고 저장하면 빠지지 않게 바로 지도에서 고르게 해요.
    const chosen = d.plat !== '' && form.dataset.locFor === place;
    const loc = !linked && chosen ? { lat: +d.plat, lng: +d.plng, address: d.paddr || '' } : { lat: null, lng: null, address: '' };
    return (async () => {
      const id = e.id
        ? (await store.updateItem(state.tripId, 'events', e.id, { ...data, ...loc }), e.id)
        : await store.addItem(state.tripId, 'events', { ...data, ...loc, createdBy: state.user.uid });
      if (place && !linked && !chosen && id) pickEventOnMap(id, place);
    })();
  }, { danger: e.id ? { label: '이 일정 삭제', confirm: '이 일정을 삭제할까요?', run: () => store.removeItem(state.tripId, 'events', e.id) } : null });
  if (e.place && !e.placeId && hasCoords(e)) setEventLoc($sheet.querySelector('form'), { lat: e.lat, lng: e.lng, address: e.address }, e.place);
}

// 일정 장소 후보: 적고 잠깐 멈추면 여행지에서 가까운 순서로 찾아 보여주고, 사용자가 골라야 위치가 정해져요.
const evGeo = { seq: 0, timer: 0, results: [] };
let evPickMap = null;
function queueEventGeo(input) {
  const form = input.form;
  const q = input.value.trim();
  if (form.dataset.locFor === q) return;
  clearEventLoc(form);
  clearTimeout(evGeo.timer);
  evGeo.seq++;
  const $f = form.querySelector('.place-found');
  if (q.length < 2 || state.places.some(p => p.name === q)) { $f.innerHTML = ''; return; }
  $f.innerHTML = '<p class="search-msg">위치 찾는 중…</p>';
  evGeo.timer = setTimeout(() => searchEventGeo(form), 700);
}

async function searchEventGeo(form) {
  const q = form.place.value.trim();
  const $f = form.querySelector('.place-found');
  form.querySelector('.need-loc')?.remove();
  if (!q) { $f.innerHTML = '<p class="search-msg">먼저 장소 이름을 적어주세요.</p>'; return; }
  const seq = ++evGeo.seq;
  $f.innerHTML = '<p class="search-msg">위치 찾는 중…</p>';
  let found = [];
  try {
    const near = await Promise.race([tripCenter(), new Promise(r => setTimeout(r, 4000))]).catch(() => null);
    found = await geocode(q, near);
    if (near) found = found.filter(r => r.km < 300); // 다른 나라의 같은 이름은 빼요
    found = found.slice(0, 5);
  } catch {}
  if (seq !== evGeo.seq || !$f.isConnected) return;
  evGeo.results = found;
  $f.innerHTML = `
    <p class="pf-head">${found.length ? '어디인지 골라주세요' : '검색으로는 못 찾았어요'}</p>
    ${found.map((r, i) => `
      <button type="button" class="geo-item" data-action="ev-geo-pick" data-id="${i}">
        ${icon('pin', 16)}<span><b>${esc(r.name)}</b><small>${r.km != null ? `<em class="geo-km">${fmtKm(r.km)}</em> · ` : ''}${esc(r.address)}</small></span>
      </button>`).join('')}
    <button type="button" class="geo-item map-pick" data-action="ev-map-pick">
      ${icon('search', 16)}<span><b>${found.length ? '목록에 없어요' : '지도에서 찾기'}</b><small>지도·구글맵 링크로 직접 고르기</small></span>
    </button>`;
}

function setEventLoc(form, loc, label) {
  form.plat.value = loc.lat;
  form.plng.value = loc.lng;
  form.paddr.value = loc.address || '';
  form.dataset.locFor = form.place.value.trim();
  form.querySelector('.place-found').innerHTML = `
    <div class="place-chosen">${icon('check', 16)}<span><b>${esc(label)}</b><small>${esc(loc.address || '지도에서 고른 위치')}</small></span>
      <button type="button" class="btn-sm subtle" data-action="ev-geo-again">다시 고르기</button>
    </div>`;
}
function clearEventLoc(form) {
  form.plat.value = form.plng.value = form.paddr.value = '';
  form.dataset.locFor = '';
}

// 일정의 장소 칸: 모아둔 장소를 아래 목록으로 보여줘요. (브라우저 기본 자동완성은 아이폰에서 화면이 깨져서 직접 그려요)
function showPlaceSuggest(input) {
  const $out = input.closest('.place-field')?.querySelector('.place-suggest');
  if (!$out) return;
  const q = input.value.trim().toLowerCase();
  const list = state.places
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .filter(p => p.name !== input.value.trim())
    .slice(0, 5);
  $out.innerHTML = list.map(p => {
    const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES.at(-1);
    return `<button type="button" class="ap-item" data-action="pick-event-place" data-name="${esc(p.name)}">
      ${catTile(p.category, 16)}<span>${esc(p.name)}<small>${hasCoords(p) ? '지도에 있는 장소' : '위치 없음'}</small></span>
    </button>`;
  }).join('');
}

// 지도에서 고르기: 지도를 움직여 가운데 핀을 그 장소에 맞춰요. 여행지 근처에서 시작해요.
// 위 칸에 동네·랜드마크를 치면 지도가 그쪽으로 가고, 구글맵 링크를 붙이면 그 장소로 바로 가요.
const pickMapHtml = () => `
  <div class="pick-box">
    <div class="pick-search">
      ${icon('search', 16)}<input class="pick-q" type="text" autocomplete="off" enterkeyhint="search" placeholder="동네·장소 검색 또는 구글맵 링크">
      <button type="button" class="btn-sm primary" data-action="pick-search">찾기</button>
    </div>
    <div class="pick-results"></div>
    <div class="pick-map"><div class="map"></div><div class="drop-pin pick-center" style="--c:var(--primary)"><i>${icon('pin', 16)}</i></div></div>
  </div>`;
let pickFound = [];
async function pickSearch(box) {
  const q = box.querySelector('.pick-q').value.trim();
  const $r = box.querySelector('.pick-results');
  const map = box.querySelector('.map')._map;
  if (!q) return;
  if (!map) { $r.innerHTML = '<p class="pick-msg">지도가 뜰 때까지 잠깐만 기다려주세요.</p>'; return; }
  $r.innerHTML = '<p class="pick-msg">찾는 중…</p>';
  const c = map.getCenter();
  if (GMAPS_LINK.test(q)) {
    const loc = await gmapsLinkLoc(q, { lat: c.lat, lng: c.lng });
    if (!loc) { $r.innerHTML = '<p class="pick-msg">링크에서 위치를 못 읽었어요. 구글맵에서 장소를 연 뒤 공유 → 링크 복사로 다시 붙여넣어 주세요.</p>'; return; }
    map.flyTo({ center: [loc.lng, loc.lat], zoom: 16, duration: 700 });
    $r.innerHTML = `<p class="pick-msg ok">${icon('check', 14)} ${loc.exact ? '구글맵 위치로 옮겼어요' : '구글맵 링크의 이름으로 찾았어요'}${loc.name ? ` · ${esc(loc.name)}` : ''}. ${loc.exact ? '맞으면 정해주세요.' : '핀을 정확히 맞춰주세요.'}</p>`;
    return;
  }
  pickFound = (await geocode(q, { lat: c.lat, lng: c.lng }).catch(() => [])).slice(0, 5);
  $r.innerHTML = pickFound.length
    ? pickFound.map((r, i) => `
      <button type="button" class="geo-item" data-action="pick-go" data-id="${i}">
        ${icon('pin', 16)}<span><b>${esc(r.name)}</b><small>${r.km != null ? `<em class="geo-km">${fmtKm(r.km)}</em> · ` : ''}${esc(r.address)}</small></span>
      </button>`).join('')
    : '<p class="pick-msg">못 찾았어요. 영어 이름으로 찾거나, 구글맵에서 장소 링크를 복사해 붙여넣어 주세요.</p>';
}

// 구글맵 링크 → 위치. 긴 링크는 바로 읽고, 짧은 공유 링크(maps.app.goo.gl)는 가치가 서버가 열어서 읽어 줘요.
// 링크에 좌표가 없으면 링크 속 장소 이름으로 근처를 찾아요(exact: false).
const GMAPS_LINK = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\S*/i;
async function gmapsLinkLoc(text, near) {
  const link = String(text).match(GMAPS_LINK)?.[0];
  if (!link) return null;
  const c = coordsFromUrl(link);
  if (c) return { ...c, name: decodeURIComponent(link.match(/\/maps\/place\/([^/@?]+)/)?.[1]?.replace(/\+/g, ' ') || ''), exact: true };
  const r = IG_API ? await fetch(`${IG_API}?gmaps=${encodeURIComponent(link)}`).then(res => res.json()).catch(() => null) : null;
  if (Number.isFinite(r?.lat)) return { lat: r.lat, lng: r.lng, name: r.name || '', exact: true };
  if (!r?.name) return null;
  // 이름이 정확하니 가까운 순서 대신 검색이 맞다고 본 순서대로, 여행지에서 너무 먼 곳만 빼요.
  const hit = (await geocode(r.name).catch(() => [])).find(h => !near || kmBetween(near, h) < 300);
  return hit ? { lat: hit.lat, lng: hit.lng, name: r.name, exact: false } : null;
}
async function makePickMap(el) {
  const [ml, near] = await Promise.all([
    loadMapLib(),
    Promise.race([tripCenter(), new Promise(r => setTimeout(r, 4000))]).catch(() => null),
  ]).catch(() => []);
  if (!ml || !el?.isConnected) return null;
  const map = new ml.Map({ container: el, style: MAP_STYLE, center: near ? [near.lng, near.lat] : [127, 37.5], zoom: near ? 13 : 4, attributionControl: false, dragRotate: false });
  map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
  return new Promise(r => map.on('load', () => {
    el._map = map;
    styleMap(map);
    el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    r(map);
  }));
}

// 일정을 위치 없이 저장했을 때: 빠지지 않게 바로 지도에서 고르게 해요.
let pickMap = null;
async function pickEventOnMap(id, place) {
  openSheet('지도에서 위치 고르기', `
    <p class="pick-hint"><b>'${esc(place)}'</b>이(가) 지도 어디인지 아직 안 정해졌어요.<br>지도를 움직여서 가운데 핀을 그 장소에 맞춰주세요.</p>
    ${pickMapHtml()}
  `, () => {
    if (!pickMap) return '지도가 뜰 때까지 잠깐만 기다려주세요.';
    const c = pickMap.getCenter();
    return store.updateItem(state.tripId, 'events', id, { lat: c.lat, lng: c.lng, address: '' }).then(() => toast('지도에 넣었어요'));
  }, { save: '이 위치로' });
  pickMap = null;
  pickMap = await makePickMap($sheet.querySelector('.pick-map .map'));
}

const locLabel = p => hasCoords(p)
  ? `${icon('pin', 16)} <span>${esc(p.address || `${(+p.lat).toFixed(5)}, ${(+p.lng).toFixed(5)}`)}</span>`
  : `<span class="muted">아직 위치가 없어요</span>`;

function setPlaceLocation(form, loc) {
  form.lat.value = loc ? loc.lat : '';
  form.lng.value = loc ? loc.lng : '';
  form.address.value = loc?.address || '';
  form.querySelector('.loc-current').innerHTML = locLabel(loc || {});
  form.querySelector('.geo-results').innerHTML = loc
    ? `<button type="button" class="btn-sm subtle" data-action="geo-clear">${icon('x', 14)} 위치 지우기</button>` : '';
}

let geoResults = [];

async function searchPlaceLocation(form) {
  const q = form.name.value.trim();
  const $out = form.querySelector('.geo-results');
  if (!q) { $out.innerHTML = '<p class="search-msg">먼저 장소 이름을 적어주세요.</p>'; return; }
  $out.innerHTML = '<p class="search-msg">찾는 중…</p>';
  try {
    const near = await Promise.race([tripCenter(), new Promise(r => setTimeout(r, 4000))]).catch(() => null);
    geoResults = await geocode(q, near);
    $out.innerHTML = geoResults.length
      ? geoResults.map((r, i) => `
        <button type="button" class="geo-item" data-action="geo-pick" data-id="${i}">
          ${icon('pin', 16)}<span><b>${esc(r.name)}</b><small>${r.km != null ? `<em class="geo-km">${fmtKm(r.km)}</em> · ` : ''}${esc(r.address)}</small></span>
        </button>`).join('')
      : '<p class="search-msg">못 찾았어요. 지점명을 빼거나 "도시 이름 + 장소"로 다시 적어보세요.<br>또는 구글맵에서 장소를 열고 주소창 링크를 아래 링크 칸에 붙여넣어 주세요.</p>';
  } catch (e) {
    $out.innerHTML = `<p class="search-msg">${esc(e.message)}</p>`;
  }
}

function placeSheet(p = {}) {
  openSheet(p.id ? '장소 수정' : '가고 싶은 곳', `
    <div class="ig-slot"></div>
    ${field('이름', `<input name="name" required maxlength="60" placeholder="예: 이치란 라멘 본점" value="${esc(p.name)}">`)}
    <div class="field"><span>위치</span>
      <div class="loc-box">
        <div class="loc-current">${locLabel(p)}</div>
        <button type="button" class="btn-sm primary" data-action="geo-search">${icon('search', 16)} 이름으로 찾기</button>
      </div>
      <div class="geo-results"></div>
      <input type="hidden" name="lat" value="${hasCoords(p) ? p.lat : ''}">
      <input type="hidden" name="lng" value="${hasCoords(p) ? p.lng : ''}">
      <input type="hidden" name="address" value="${esc(p.address)}">
    </div>
    <div class="field"><span>종류</span><div class="chips wrap">
      ${CATEGORIES.map(c => `<label class="chip cat-chip" style="--c:${c.color}"><input type="checkbox" name="category" value="${c.id}" ${(p.id ? placeCats(p) : ['food']).includes(c.id) ? 'checked' : ''}>${icon('cat_' + c.id, 15)} ${c.label}</label>`).join('')}
    </div></div>
    <div class="field"><span>링크</span>
      <div class="url-row">
        <input name="url" inputmode="url" autocapitalize="off" placeholder="인스타·구글맵 링크" value="${esc(p.url)}">
        <button type="button" class="btn-sm" data-action="paste-link">${icon('copy', 15)} 붙여넣기</button>
      </div>
      <small class="hint">인스타·구글맵 링크를 붙여넣으면 위치를 자동으로 찾고 저장까지 해줘요.</small>
    </div>
    ${field('메모', `<textarea name="note" rows="2" maxlength="300" placeholder="왜 가고 싶은지, 영업시간 등">${esc(p.note)}</textarea>`)}
  `, (d, form) => {
    if (!d.name.trim()) return '장소 이름을 적어주세요.';
    const lat = d.lat === '' ? null : Number(d.lat);
    const lng = d.lng === '' ? null : Number(d.lng);
    const cats = [...form.querySelectorAll('input[name=category]:checked')].map(x => x.value);
    if (!cats.length) cats.push('etc');
    const data = { name: d.name.trim(), category: cats[0], categories: cats, url: d.url.trim(), note: d.note.trim(), lat, lng, address: d.address || '' };
    return p.id
      ? store.updateItem(state.tripId, 'places', p.id, data)
      : store.addItem(state.tripId, 'places', { ...data, likes: [], createdBy: state.user.uid });
  }, { danger: p.id ? { label: '이 장소 삭제', confirm: '이 장소를 삭제할까요?', run: () => store.removeItem(state.tripId, 'places', p.id) } : null });
  const form = $sheet.querySelector('form');
  if (!hasCoords(p)) form.dataset.autoLoc = 'on'; // 위치가 비어 있으면 이름으로 자동으로 찾아 넣어요
  if (p.id) form.dataset.editing = '1';
  syncIgPreview(form);
}

// 새로 넣는 인스타 링크면 게시물(본문 포함)을 시트 위에 띄워서, 글을 보며 장소 이름을 적을 수 있게 합니다.
function syncIgPreview(form) {
  const slot = form.querySelector('.ig-slot');
  const code = (form.dataset.autoLoc && igCode(form.url.value)) || '';
  if (!slot || slot.dataset.code === code) return;
  slot.dataset.code = code;
  if (code && IG_API && !form.dataset.editing) setTimeout(() => analyzeIntoForm(form, form.url.value), 0);
  slot.innerHTML = code ? `
    <div class="igpost fixed"><iframe src="https://www.instagram.com/p/${esc(code)}/embed/captioned/" title="인스타그램 게시물" scrolling="yes" allowtransparency="true"></iframe></div>
    <p class="ig-hint">${icon('insta', 15)} <span>${IG_API ? '게시물 글을 읽고 있어요…' : '게시물 글에서 장소 이름을 찾아 아래에 적어주세요. 위치는 자동으로 찾아 넣어요.'}</span></p>` : '';
}

// 이름을 적고 잠깐 멈추면 위치를 찾아 첫 번째 결과를 넣고, 다른 후보도 보여줍니다.
// 직접 고르거나 지운 위치는 건드리지 않아요.
async function autoLocate(form) {
  const q = form.name.value.trim();
  if (q.length < 2 || form.dataset.autoLoc !== 'on') return;
  const $out = form.querySelector('.geo-results');
  $out.innerHTML = '<p class="search-msg">위치 찾는 중…</p>';
  let found;
  try { found = await geocode(q); } catch { found = []; }
  if (!form.isConnected || form.name.value.trim() !== q || form.dataset.autoLoc !== 'on') return;
  geoResults = found;
  if (!found.length) {
    setPlaceLocation(form, null);
    $out.innerHTML = '<p class="search-msg">위치를 자동으로 못 찾았어요. 지점명·도시를 붙여 보거나, 구글맵 링크를 링크 칸에 붙여넣어 주세요.</p>';
    return;
  }
  setPlaceLocation(form, found[0]);
  if (found.length > 1) $out.innerHTML = `<p class="search-msg">자동으로 넣었어요. 다른 곳이면 아래에서 골라주세요.</p>` + found.slice(1).map((r, i) => `
    <button type="button" class="geo-item" data-action="geo-pick" data-id="${i + 1}">
      ${icon('pin', 16)}<span><b>${esc(r.name)}</b><small>${esc(r.address)}</small></span>
    </button>`).join('');
}
let autoLocTimer;

// --- 인스타 자동 분석 ---
// 서버(worker/)가 본문 글에서 장소를 뽑아 오면 위치를 찾아 둡니다.
// 한 곳이면 장소 시트를 바로 채우고, 여러 곳이면 체크 목록에서 골라 저장해요.
// 서버가 없거나 실패하면 시트에 남아 게시물을 보며 이름을 적으면 돼요(반자동).
async function analyzeInstagram(url, onStep) {
  const dest = tripRoute(state.trip || {}).toCity; // AI가 도시를 짐작하도록 여행지를 알려줘요
  let data;
  try {
    const res = await fetch(`${IG_API}?url=${encodeURIComponent(url)}&trip=${encodeURIComponent(dest)}`);
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
  } catch {
    throw new Error('게시물을 읽지 못했어요. 비공개 계정이거나 인스타가 잠깐 막았을 수 있어요.');
  }
  if (!data.caption) throw new Error('게시물 글을 가져오지 못했어요. 게시물을 보고 이름을 적어주세요.');
  if (data.error === 'ai-failed') throw new Error('오늘 자동 분석 한도를 다 썼거나 잠깐 안 돼요. 게시물을 보고 이름을 적어주세요.');
  if (!data.places?.length) throw new Error('글에 가게·장소 이름이 없어요. 게시물을 보고 이름을 적어주세요.');
  // 위치는 4곳씩 동시에 찾아요(맛집 총정리처럼 수십 곳이어도 금방 끝나게).
  const found = data.places.map(c => ({ ...c, loc: null }));
  let done = 0, next = 0;
  const worker = async () => {
    while (next < found.length) {
      const c = found[next++];
      c.loc = await locateCandidate(c);
      onStep?.(`위치 찾는 중… ${++done}/${found.length}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  dropFarAway(found);
  return { data, found };
}

async function analyzeIntoForm(form, url) {
  const tripId = state.tripId;
  const $hint = () => form.querySelector('.ig-hint span');
  const say = t => { if ($hint()) $hint().textContent = t; };
  const alive = () => form.isConnected && state.tripId === tripId && form.url.value === url;
  say('게시물 글을 읽고 있어요…');
  const slow = setTimeout(() => alive() && say('장소가 많은 게시물이에요. 1~2분 걸릴 수 있으니 기다려 주세요…'), 8000);
  let result;
  try {
    result = await analyzeInstagram(url, t => { clearTimeout(slow); say(t); });
  } catch (e) {
    if (alive()) say(e.message);
    return;
  } finally {
    clearTimeout(slow);
  }
  if (!alive()) return;
  const { data, found } = result;
  if (found.length > 1) return pickPlacesSheet(url, data, found);
  const c = found[0];
  if (!form.name.value.trim()) form.name.value = c.name;
  const box = form.querySelector(`input[name=category][value="${c.category}"]`);
  if (box) { form.querySelectorAll('input[name=category]').forEach(x => { x.checked = x === box; }); }
  if (c.note && !form.note.value.trim()) form.note.value = c.note;
  if (c.loc) { form.dataset.autoLoc = ''; setPlaceLocation(form, c.loc); }
  say(c.loc
    ? `게시물에서 '${c.name}'을(를) 찾아 채웠어요. 맞는지 보고 저장하세요.`
    : `'${c.name}'을(를) 찾았는데 위치는 못 찾았어요. '이름으로 찾기'로 넣어주세요.`);
}

// 지도 검색이 잘 되는 이름 → 도시 붙여서 → 본문에 쓰인 이름 순으로 찾아봅니다.
async function locateCandidate(c) {
  const tries = [c.address, c.city && `${c.query || c.name} ${c.city}`, c.query, c.name].filter(Boolean);
  for (const q of [...new Set(tries)]) {
    try {
      const [hit] = await geocodeOnce(q);
      if (hit) return hit;
    } catch {}
  }
  return null;
}

// 무료 지도 검색은 없는 가게도 비슷한 이름의 엉뚱한 곳(다른 나라)을 돌려줄 때가 있어요.
// 한 게시물의 장소들은 보통 같은 도시라서, 나머지와 300km 넘게 떨어진 위치는 버립니다.
function kmBetween(a, b) {
  const r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2), y = Math.sin((b.lng - a.lng) * r / 2);
  return 12742 * Math.asin(Math.sqrt(x * x + Math.cos(a.lat * r) * Math.cos(b.lat * r) * y * y));
}
function dropFarAway(found) {
  const pinned = [...found.map(c => c.loc), ...state.places.filter(hasCoords)].filter(Boolean);
  if (pinned.length < 2) return;
  for (const c of found) {
    if (!c.loc) continue;
    const near = pinned.filter(p => p !== c.loc && kmBetween(p, c.loc) < 300).length;
    if (!near) c.loc = null;
  }
}

function pickPlacesSheet(url, data, found) {
  const catOf = id => CATEGORIES.find(c => c.id === id) || CATEGORIES.at(-1);
  openSheet('담을 곳 고르기', `
    <p class="muted small ig-from">${icon('insta', 15)} ${data.author ? `@${esc(data.author)}의 게시물에서` : '게시물에서'} ${found.length}곳을 찾았어요. 빼고 싶은 곳은 체크를 끄세요.</p>
    ${found.length > 5 ? `<button type="button" class="btn-sm pick-all" data-action="pick-all">${icon('check', 15)} 모두 끄기</button>` : ''}
    <div class="pick-list">${found.map((c, i) => {
      const cat = catOf(c.category);
      return `<label class="pick-item">
        <input type="checkbox" name="pick_${i}" checked>
        ${catTile(c.category)}
        <span class="pick-body">
          <b>${esc(c.name)}</b>
          <small class="${c.loc ? '' : 'warn'}">${c.loc ? `${icon('pin', 13)} ${esc(c.loc.address || c.loc.name)}` : '위치를 못 찾았어요 · 저장 후 수정에서 넣을 수 있어요'}</small>
          ${c.note ? `<small>${esc(c.note)}</small>` : ''}
        </span>
      </label>`;
    }).join('')}</div>
  `, d => {
    const picked = found.filter((_, i) => d[`pick_${i}`]);
    if (!picked.length) return '담을 곳을 하나 이상 골라주세요.';
    return Promise.all(picked.map(c => store.addItem(state.tripId, 'places', {
      name: c.name, category: c.category, categories: [c.category], url, note: c.note,
      lat: c.loc?.lat ?? null, lng: c.loc?.lng ?? null, address: c.loc?.address || '',
      likes: [], createdBy: state.user.uid, // 좋아요는 직접 눌렀을 때만
    }))).then(() => toast(`${picked.length}곳을 담았어요`));
  }, { save: '담기' });
}

function expenseSheet(x = {}) {
  const members = state.trip.members;
  const solo = members.length < 2;
  const among = x.splitAmong?.length ? x.splitAmong : members;
  const cur = x.id ? xCur(x) : currency();
  openSheet(x.id ? '지출 수정' : '지출 기록', `
    ${field('어디에 썼나요', `<input name="title" required maxlength="40" placeholder="예: 저녁 이자카야" value="${esc(x.title)}">`)}
    <div class="row">
      ${field('금액', `<input name="amount" type="number" inputmode="decimal" min="0" step="${fxStep(cur)}" placeholder="0" value="${esc(x.amount)}">`)}
      ${field('통화', `<select name="cur" class="cur-select">${CURRENCIES.map(([c, label]) => `<option value="${c}" ${c === cur ? 'selected' : ''}>${label}</option>`).join('')}</select>`)}
    </div>
    <small class="hint fx-hint">${amountHint(x.amount, cur)}</small>
    ${field('날짜', `<input type="date" name="date" value="${esc(x.date || defaultDate())}">`)}
    ${solo ? '' : `
    ${field('누가 냈나요', `<select name="paidBy">${members.map(uid => `<option value="${esc(uid)}" ${uid === (x.paidBy || state.user.uid) ? 'selected' : ''}>${esc(memberName(uid))}</option>`).join('')}</select>`)}
    <div class="field"><span>누구랑 나눌까요</span><div class="chips wrap">
      ${members.map(uid => `<label class="chip"><input type="checkbox" name="splitAmong" value="${esc(uid)}" ${among.includes(uid) ? 'checked' : ''}>${esc(memberName(uid))}</label>`).join('')}
    </div></div>`}
  `, (d, form) => {
    const split = solo ? [state.user.uid] : new FormData(form).getAll('splitAmong');
    const amount = Number(d.amount);
    if (!d.title.trim()) return '어디에 썼는지 적어주세요.';
    if (!(amount > 0)) return '금액을 입력해 주세요.';
    if (!split.length) return '나눌 사람을 한 명 이상 골라주세요.';
    const data = { title: d.title.trim(), amount, currency: d.cur || cur, date: d.date, paidBy: solo ? state.user.uid : d.paidBy, splitAmong: split };
    return x.id
      ? store.updateItem(state.tripId, 'expenses', x.id, data)
      : store.addItem(state.tripId, 'expenses', { ...data, createdBy: state.user.uid });
  }, { danger: x.id ? { label: '이 지출 삭제', confirm: '이 지출 기록을 삭제할까요?', run: () => store.removeItem(state.tripId, 'expenses', x.id) } : null });
}

// ---------- 이벤트 ----------

const findRequest = (list, id) => list.find(r => r.id === id);

function currencySheet() {
  const cur = currency();
  openLiveSheet('어떤 통화로 볼까요?', () => `
    <div class="currency-grid">
      ${CURRENCIES.map(([c, label]) => `
        <button type="button" class="currency-item ${c === currency() ? 'on' : ''}" data-action="set-currency" data-id="${c}">
          <b>${formatter(c).formatToParts(0).find(x => x.type === 'currency')?.value || c}</b>
          <span>${label}</span><small>${c}</small>
        </button>`).join('')}
    </div>
    ${state.expenses.length ? '<p class="muted xsmall">적은 지출은 원래 금액 그대로 두고, 고른 돈으로 환산해서 보여줘요. 새 지출은 이 돈으로 먼저 골라져 있어요.</p>' : ''}`);
}

function profileSheet() {
  openLiveSheet('프로필 꾸미기', () => {
    const p = me();
    return `
    <div class="style-preview" style="--me:${esc(p.color || 'var(--primary)')}">
      ${avatarOf(p, p.uid, 'xl')}
      <b>${esc(p.name)}</b>
      <span>@${esc(p.handle)}</span>
    </div>
    <div class="field"><span>내 색</span>
      <div class="swatches">
        ${PROFILE_COLORS.map(c => `
          <button type="button" class="swatch ${c === p.color ? 'on' : ''}" style="background:${c}" data-action="set-color" data-id="${c}" aria-label="색 ${c}">${c === p.color ? icon('check', 16) : ''}</button>`).join('')}
        <button type="button" class="swatch auto ${!p.color ? 'on' : ''}" data-action="set-color" data-id="" aria-label="자동">자동</button>
      </div>
    </div>
    ${p.photo ? `
    <button type="button" class="toggle-row" data-action="toggle-photo" role="switch" aria-checked="${p.showPhoto}">
      <span><b>구글 프로필 사진 쓰기</b><small>끄면 이름 첫 글자와 내 색으로 보여요</small></span>
      <span class="switch ${p.showPhoto ? 'on' : ''}"></span>
    </button>` : ''}
    <p class="muted xsmall">친구들 화면에도 이 색으로 보여요. 이름은 구글 계정 이름을 그대로 써요.</p>`;
  });
}

const actions = {
  'close-sheet': closeSheet,
  'sheet-danger': async () => {
    const d = sheetDanger;
    if (!d || !(await ask(d.confirm, { ok: d.label }))) return;
    closeSheet();
    run(d.run, d.ok);
  },
  signout: async () => {
    if (!(await ask('로그아웃할까요?', { ok: '로그아웃' }))) return;
    location.hash = '#/';
    run(() => store.signOut());
  },

  // 여행
  'new-trip': () => tripSheet(),
  'trip-settings': () => tripSheet(state.trip),
  members: membersSheet,
  add: () => ({ timeline: () => eventSheet({ date: defaultDate() }), places: () => placeSheet(), expenses: () => expenseSheet() })[state.tab](),
  'add-event': d => eventSheet({ date: d.date }, { fixedDay: true }),
  'pick-event-place': (d, el) => {
    const input = el.closest('.place-field').querySelector('input[name=place]');
    input.value = d.name;
    el.closest('.place-suggest').innerHTML = '';
    clearEventLoc(input.form);
    evGeo.seq++;
    clearTimeout(evGeo.timer);
    input.form.querySelector('.place-found').innerHTML = '';
  },
  'ev-geo-pick': (d, el) => {
    const r = evGeo.results[+d.id];
    if (r) setEventLoc(el.form, r, r.name);
  },
  'ev-geo-again': (d, el) => searchEventGeo(el.form),
  'pick-search': (d, el) => pickSearch(el.closest('.pick-box')),
  'pick-go': (d, el) => {
    const box = el.closest('.pick-box');
    const r = pickFound[+d.id];
    if (!r) return;
    box.querySelector('.map')._map?.flyTo({ center: [r.lng, r.lat], zoom: 16, duration: 700 });
    box.querySelector('.pick-results').innerHTML = `<p class="pick-msg ok">${icon('check', 14)} ${esc(r.name)} 근처로 옮겼어요. 핀을 정확히 맞춰주세요.</p>`;
  },
  'ev-map-pick': async (d, el) => {
    const $f = el.form.querySelector('.place-found');
    $f.innerHTML = `${pickMapHtml()}
      <p class="search-msg">지도를 움직여서 가운데 핀을 그 장소에 맞춰주세요.</p>
      <button type="button" class="btn-sm primary" data-action="ev-map-confirm">${icon('check', 16)} 이 위치로 정하기</button>`;
    evPickMap = null;
    evPickMap = await makePickMap($f.querySelector('.map'));
  },
  'ev-map-confirm': (d, el) => {
    if (!evPickMap) return toast('지도가 뜰 때까지 잠깐만 기다려주세요.');
    const c = evPickMap.getCenter();
    setEventLoc(el.form, { lat: c.lat, lng: c.lng, address: '' }, el.form.place.value.trim() || '고른 위치');
  },
  'map-day': d => { state.mapDay = d.day; state.mapDayOpen = false; render(); },
  'map-day-open': () => { state.mapDayOpen = !state.mapDayOpen; render(); },
  'edit-event': d => eventSheet(state.events.find(x => x.id === d.id)),
  'edit-place': d => placeSheet(state.places.find(x => x.id === d.id)),
  'edit-expense': d => expenseSheet(state.expenses.find(x => x.id === d.id)),
  'place-filter': d => { state.placeFilter = d.id; render(); },
  'place-detail': d => placeDetail(d.id),
  'geo-search': (d, el) => searchPlaceLocation(el.form),
  'ap-pick': (d, el) => setAirport(el.closest('.ap-field'), d.code),
  'stop-pick': (d, el) => {
    const box = el.closest('.stop-field');
    box.querySelector('.stop-q').value = d.name;
    box.querySelector('.ap-results').innerHTML = '';
  },
  'pick-mode': (d, el) => {
    const block = el.closest('.route-block');
    // 글자로 적는 칸끼리 바꾸면 적어 둔 출발·도착을 옮겨요. 기차역을 고속버스 터미널로 옮기는 것처럼
    // 새 목록에 없는 이름이 되면 옮기지 않아요(자동차는 아무 이름이나 괜찮아요).
    const was = block.querySelector('[name=mode]').value;
    const typed = block.querySelector('input[name=from]:not([type=hidden])') && ['from', 'to'].map(n => block.querySelector(`[name=${n}]`).value);
    block.innerHTML = routeBlock(d.mode, state.trips.find(x => x.id === block.dataset.trip));
    if (!typed || d.mode === 'plane') return;
    ['from', 'to'].forEach((n, i) => {
      if (was === 'car' || d.mode === 'car' || searchStops(d.mode, typed[i])[0]?.name === typed[i]) block.querySelector(`[name=${n}]`).value = typed[i];
    });
  },
  'geo-pick': (d, el) => {
    const r = geoResults[+d.id];
    if (r) { el.form.dataset.autoLoc = ''; setPlaceLocation(el.form, r); }
  },
  'geo-clear': (d, el) => { el.form.dataset.autoLoc = ''; setPlaceLocation(el.form, null); },
  'pick-all': (d, el) => {
    const boxes = [...el.form.querySelectorAll('.pick-item input')];
    const on = !boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = on; });
    el.lastChild.textContent = on ? ' 모두 끄기' : ' 모두 켜기';
  },
  'paste-link': async (d, el) => {
    let text;
    try { text = await navigator.clipboard.readText(); } catch { return toast('붙여넣기가 막혀 있어요. 링크 칸을 길게 눌러 붙여넣어 주세요.'); }
    const url = extractLink(text);
    if (!url) return toast('복사한 내용에 링크가 없어요');
    el.form.url.value = url;
    el.form.url.dispatchEvent(new Event('input', { bubbles: true }));
    toast(igCode(url) ? '인스타 링크를 넣었어요' : '링크를 넣었어요');
  },
  'pick-currency': currencySheet,
  'mark-sent': d => {
    const amount = Number(d.amount);
    run(() => store.addItem(state.tripId, 'expenses', {
      kind: 'transfer', title: '정산 송금', amount, currency: currency(), date: todayStr(),
      paidBy: d.from, splitAmong: [d.to], createdBy: state.user.uid,
    }), `${memberName(d.from)} → ${memberName(d.to)} 보낸 걸로 기록했어요`);
  },
  'undo-sent': d => run(() => store.removeItem(state.tripId, 'expenses', d.id), '보낸 기록을 지웠어요'),
  'copy-settle': () => {
    const { paid, owed, total, spent, mixed } = tally();
    const members = state.trip.members;
    const transfers = settle(members.map(uid => [uid, (paid[uid] || 0) - (owed[uid] || 0)]));
    // 모든 지출을 모두가 나눴을 때만 1인당 금액을 붙여요.
    const even = state.expenses.every(x => x.kind === 'transfer' || !x.splitAmong?.length || x.splitAmong.length >= members.length);
    const withKRW = n => `${money(n)}${currency() !== 'KRW' && toKRW(n, currency()) != null ? ` (약 ${fmtKRW(toKRW(n, currency()))})` : ''}`;
    // 할 일(누가 누구에게 얼마)을 맨 위에, 그 근거(총 지출·사람별 지출)를 아래에 둬요.
    const text = [
      `[${state.trip.name} 정산]`,
      '',
      ...(transfers.length
        ? transfers.map(x => `💸 ${memberName(x.from)}님은 ${memberName(x.to)}님에게 ${withKRW(x.amount)} 보내주세요.`)
        : ['✅ 모두 정산 끝! 보낼 돈이 없어요.']),
      '',
      `총 지출 ${withKRW(total)}${even ? ` · 1인당 ${money(roundFx(total / members.length, currency()))}` : ''}`,
      ...members.map(uid => `${memberName(uid)}: ${money(spent[uid] || 0)} 지출`),
      '',
      mixed && fxRates ? `${fxWhen()} 환율 기준 · 가치가` : '가치가',
    ].join('\n');
    copyText(text, '정산 내용을 복사했어요. 카톡에 붙여넣어 보내세요.');
  },
  'set-currency': d => {
    if (d.id === currency()) return closeSheet();
    const old = currency();
    run(() => Promise.all(state.expenses.filter(x => !x.currency)
      .map(x => store.updateItem(state.tripId, 'expenses', x.id, { currency: old })))
      .then(() => store.updateTrip(state.tripId, { currency: d.id })));
    closeSheet();
  },
  'profile-style': profileSheet,
  'set-color': d => run(() => store.updateProfile(state.user.uid, { color: d.id })),
  'toggle-photo': () => run(() => store.updateProfile(state.user.uid, { showPhoto: !me().showPhoto })),
  like: d => {
    const p = state.places.find(x => x.id === d.id);
    if (!p) return;
    const on = !p.likes?.includes(state.user.uid);
    run(() => store.toggleInArray(state.tripId, 'places', p.id, 'likes', state.user.uid, on));
  },
  'place-to-event': d => {
    const p = state.places.find(x => x.id === d.id);
    if (p) eventSheet({ title: p.name, place: p.name, date: defaultDate() });
  },

  // 멤버 관리 (캡틴)
  'invite-friend': d => {
    const f = state.friends.find(x => x.uid === d.id);
    if (f) run(() => store.inviteToTrip(state.tripId, f), `${f.name}님에게 초대를 보냈어요`);
  },
  'cancel-invite': d => run(() => store.cancelInvite(state.tripId, d.id)),
  'remove-member': async d => {
    const name = memberName(d.id);
    if (!(await ask(`${name}님을 여행에서 내보낼까요?\n내보내면 이 여행을 더 이상 볼 수 없어요.`, { ok: '내보내기' }))) return;
    run(() => store.removeMember(state.tripId, d.id), `${name}님을 내보냈어요`);
  },

  // 받은 여행 초대
  'accept-invite': d => run(async () => {
    await store.acceptTripInvite(me(), d.id);
    location.hash = `#/trip/${d.id}`;
  }, '여행에 합류했어요'),
  'decline-invite': async d => {
    if (await ask('이 여행 초대를 거절할까요?', { ok: '거절' })) run(() => store.declineTripInvite(d.id, state.user.uid));
  },

  // 친구
  'add-friend': addFriendSheet,
  'copy-handle': () => copyText(me().handle, `@${me().handle} 복사했어요`),
  'edit-handle': handleSheet,
  'send-request': (d, el) => {
    if (!lastFound) return;
    const target = lastFound;
    run(async () => {
      await store.sendFriendRequest(me(), target);
      const $out = el.closest('.search-result');
      if ($out) $out.innerHTML = searchResultHtml(target);
    }, friendStatus(target.uid) === 'received' ? '친구가 됐어요' : '친구 요청을 보냈어요');
  },
  'accept-request': d => {
    const r = findRequest(state.requestsIn, d.id);
    if (r) run(() => store.acceptFriendRequest(me(), r), `${r.fromInfo.name}님과 친구가 됐어요`);
  },
  'decline-request': d => {
    const r = findRequest(state.requestsIn, d.id);
    if (r) run(() => store.deleteFriendRequest(r));
  },
  'cancel-request': d => {
    const r = findRequest(state.requestsOut, d.id);
    if (r) run(() => store.deleteFriendRequest(r));
  },
  'remove-friend': async d => {
    const f = state.friends.find(x => x.uid === d.id);
    if (f && await ask(`${f.name}님과 친구를 끊을까요?\n함께하는 여행에는 영향이 없어요.`, { ok: '친구 끊기' })) run(() => store.removeFriend(state.user.uid, f.uid));
  },
};

// ===== 사용법 안내 동작 =====
Object.assign(actions, {
  'show-guide': () => { state.guide = 0; render(); },
  'guide-next': () => { state.guide = state.guide < guideCards().length - 1 ? state.guide + 1 : null; render(); },
  'guide-prev': () => { if (state.guide > 0) { state.guide--; render(); } },
  'guide-go': d => { state.guide = +d.i; render(); },
  'open-outside': () => openOutside(),
  'copy-site': async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); toast(`링크를 복사했어요. ${IN_APP?.android ? '크롬' : '사파리'} 주소창에 붙여넣어 주세요.`); }
    catch { prompt('이 링크를 복사해 주세요', url); }
  },
  'install-app': async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice.catch(() => ({}));
    installPrompt = null;
    if (outcome === 'accepted') toast('홈 화면에 추가했어요');
    render();
  },
  'guide-close': () => { state.guide = null; render(); },
  'tip-close': d => { tipsSeen[d.id] = 1; try { localStorage.setItem('gachiga-tips', JSON.stringify(tipsSeen)); } catch {} render(); },
});

document.addEventListener('click', e => {
  // 시트 안의 페이지 이동 링크를 누르면 시트를 닫습니다.
  if (e.target.closest('#sheet-root a[href^="#"]')) closeSheet();
  const el = e.target.closest('[data-action]');
  const fn = el && actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(el.dataset, el);
});

// 일정 순서 바꾸기: 일정을 꾸욱(0.4초) 누르면 들리고, 위아래로 끌어 놓으면 그 순서로 저장해요. 같은 날 안에서만 움직여요.
let drag = null;
let dragJustEnded = 0;
document.addEventListener('pointerdown', e => {
  const row = e.target.closest('.route .stop');
  if (!row || e.button || drag || row.parentElement.querySelectorAll('.stop').length < 2) return;
  const x0 = e.clientX, y0 = e.clientY;
  const quit = () => {
    clearTimeout(timer);
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', quit);
    removeEventListener('pointercancel', quit);
  };
  const move = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) quit(); }; // 그냥 스크롤이면 취소
  const timer = setTimeout(() => { quit(); startDrag(row, y0); }, 400);
  addEventListener('pointermove', move);
  addEventListener('pointerup', quit);
  addEventListener('pointercancel', quit);
});

function startDrag(row, y) {
  navigator.vibrate?.(15);
  const list = row.parentElement;
  drag = { row, list, y, before: [...list.querySelectorAll('.stop')].map(el => el.dataset.id) };
  row.classList.add('dragging');
  list.classList.add('sorting');
  addEventListener('pointermove', dragMove);
  addEventListener('pointerup', dragEnd);
  addEventListener('pointercancel', dragEnd);
}

function dragMove(e) {
  const { row, list } = drag;
  const others = [...list.querySelectorAll('.stop:not(.dragging)')];
  const next = others.find(s => { const r = s.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; })
    || list.querySelector('.add-inline');
  if (next !== row.nextElementSibling) {
    // 자리를 옮긴 만큼 기준점을 옮겨서, 카드가 손가락 아래에 그대로 있게 해요.
    const top = row.offsetTop;
    list.insertBefore(row, next);
    drag.y += row.offsetTop - top;
  }
  row.style.transform = `translateY(${e.clientY - drag.y}px)`;
}

function dragEnd() {
  const { row, list, before } = drag;
  drag = null;
  dragJustEnded = Date.now();
  removeEventListener('pointermove', dragMove);
  removeEventListener('pointerup', dragEnd);
  removeEventListener('pointercancel', dragEnd);
  row.classList.remove('dragging');
  row.style.transform = '';
  list.classList.remove('sorting');
  const ids = [...list.querySelectorAll('.stop')].map(el => el.dataset.id);
  if (!row.isConnected || ids.join() === before.join()) return;
  run(() => Promise.all(ids.map((id, i) => store.updateItem(state.tripId, 'events', id, { order: i }))));
}

// 끌다가 놓을 때 일정 수정 창이 열리지 않게, 스크롤도 막아요.
document.addEventListener('click', e => { if (Date.now() - dragJustEnded < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (e.target.closest('.route .stop')) e.preventDefault(); });

// 공항 칸에 적으면 바로 찾아 보여주고, 새 여행은 이름에 든 도시로 도착 공항을 채워 둡니다.
document.addEventListener('input', e => {
  if (e.target.name === 'handle') checkHandleInput(e.target);
  if (e.target.dataset.fx) onFxInput(e.target);
  onAmountInput(e.target);
});
document.addEventListener('change', e => { if (e.target.dataset.fx) onFxInput(e.target); onAmountInput(e.target); });
// 지출 기록 창: 금액이나 돈 종류를 바꾸면 소수점 단위와 환산 안내를 맞춰요.
function onAmountInput(el) {
  const form = el.form;
  if ((el.name !== 'amount' && el.name !== 'cur') || !form?.querySelector('.fx-hint')) return;
  form.amount.step = fxStep(form.cur.value);
  form.querySelector('.fx-hint').textContent = amountHint(form.amount.value, form.cur.value);
}
// 지도 검색 칸: 엔터는 시트 저장 대신 검색, 구글맵 링크를 붙이면 바로 찾아요.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList?.contains('pick-q')) return;
  e.preventDefault();
  pickSearch(e.target.closest('.pick-box'));
});
document.addEventListener('input', e => {
  if (e.target.classList?.contains('pick-q') && GMAPS_LINK.test(e.target.value)) pickSearch(e.target.closest('.pick-box'));
});
document.addEventListener('input', e => {
  if (e.target.name === 'place' && e.target.closest('.place-field')) { showPlaceSuggest(e.target); queueEventGeo(e.target); }
});
document.addEventListener('focusin', e => {
  if (e.target.name === 'place' && e.target.closest('.place-field')) showPlaceSuggest(e.target);
});
document.addEventListener('input', e => {
  const box = e.target.closest('#sheet-root .ap-field');
  if (box && e.target.classList.contains('ap-q')) return searchAirportField(box);
  if (box && e.target.classList.contains('stop-q')) return searchStopField(box);
  const form = e.target.form;
  if (e.target.name !== 'name' || !form?.querySelector('.ap-field[data-mode=auto]')) return;
  const toBox = form.to.closest('.ap-field');
  const a = guessAirport(e.target.value);
  form.to.value = a?.code || '';
  toBox.querySelector('.ap-q').value = airportLabel(a?.code);
});
// 공항 칸을 누르면 글자를 전부 골라 둬서 바로 새로 적을 수 있게 합니다.
document.addEventListener('focusin', e => {
  if (e.target.classList?.contains('ap-q')) setTimeout(() => e.target.select(), 0);
});

// 장소 시트의 링크 칸에 구글맵 긴 링크를 붙이면 좌표를 바로 채웁니다.
document.addEventListener('input', e => {
  const input = e.target.closest('#sheet-root input[name=url]');
  const form = input?.form;
  if (!form?.lat) return;
  syncIgPreview(form);
  const c = coordsFromUrl(input.value);
  if (c) { form.dataset.autoLoc = ''; setPlaceLocation(form, c); toast('링크에서 위치를 찾았어요'); return; }
  // 짧은 공유 링크(maps.app.goo.gl)는 서버가 열어서 읽어 와요.
  if (GMAPS_LINK.test(input.value) && !/[?&/]@?-?\d+\.\d+/.test(input.value)) {
    const link = input.value;
    tripCenter().catch(() => null).then(near => gmapsLinkLoc(link, near)).then(loc => {
      if (!loc || input.value !== link || !input.isConnected) return;
      form.dataset.autoLoc = '';
      setPlaceLocation(form, { lat: loc.lat, lng: loc.lng, address: loc.name });
      if (!form.name.value.trim() && loc.name) form.name.value = loc.name;
      toast(loc.exact ? '구글맵 링크에서 위치를 찾았어요' : '링크 속 이름으로 위치를 찾았어요. 맞는지 확인해 주세요.');
    });
  }
});
document.addEventListener('input', e => {
  const form = e.target.name === 'name' && e.target.closest('#sheet-root form');
  if (!form?.lat || form.dataset.autoLoc !== 'on') return;
  clearTimeout(autoLocTimer);
  autoLocTimer = setTimeout(() => autoLocate(form), 900);
});

// 화면을 켜 둔 채 날짜가 바뀌거나, 여행 가서 휴대폰 시간대가 바뀌면 디데이·다음 일정을 다시 계산합니다.
let clockKey = '';
function tick() {
  if (document.hidden || !state.user) return;
  const now = new Date();
  const key = `${toDateStr(now)} ${now.getHours()}:${now.getMinutes()} ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  if (key !== clockKey) { clockKey = key; render(); }
}
setInterval(tick, 20000);
document.addEventListener('visibilitychange', tick);

// 홈 화면 앱은 내려뒀다 다시 열어도 옛 화면을 그대로 이어 보여줘요.
// 돌아올 때마다 index.html의 ?v= 도장을 확인해서, 새로 배포됐으면 위에 '새 버전' 알약을 띄워요.
const myVersion = document.querySelector('script[src*="app.js"]')?.src.match(/[?&]v=(\w+)/)?.[1];
let versionCheckedAt = 0;
async function checkVersion() {
  if (document.hidden || !myVersion || document.querySelector('.update-pill') || Date.now() - versionCheckedAt < 60000) return;
  versionCheckedAt = Date.now();
  try {
    const html = await fetch('./', { cache: 'no-store' }).then(r => r.text());
    const latest = html.match(/app\.js\?v=(\w+)/)?.[1];
    if (latest && latest !== myVersion) {
      const pill = Object.assign(document.createElement('button'), { className: 'update-pill', type: 'button' });
      pill.innerHTML = `${icon('refresh', 15)} 새 버전 · 눌러서 바꾸기`;
      pill.onclick = () => location.reload();
      document.body.appendChild(pill);
    }
  } catch {}
}
document.addEventListener('visibilitychange', checkVersion);

// 카톡·안드로이드 앱 안에서 열렸으면 처음 한 번 바로 바깥 브라우저로 넘겨요.
if (IN_APP && (IN_APP.kakao || IN_APP.android)) {
  let tried = false;
  try { tried = !!sessionStorage.getItem('gachiga-outside'); sessionStorage.setItem('gachiga-outside', '1'); } catch {}
  if (!tried) openOutside();
}

// 안드로이드에서 설치할 수 있으면 브라우저가 알려줘요. 사용법 카드의 '홈 화면에 추가' 버튼으로 띄워요.
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (state.guide != null) render(); });
window.addEventListener('appinstalled', () => { installPrompt = null; });
setInterval(checkVersion, 10 * 60000);

document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  if (form.dataset.form === 'signin') return run(() => store.signIn(data.name?.trim()));
  if (form.dataset.form === 'handle') {
    const handle = String(data.handle || '').trim().replace(/^@/, '').toLowerCase();
    if (!HANDLE_RE.test(handle)) return toast('아이디는 영문 소문자·숫자·_·. 3~20자예요.');
    state.guide = 0; // 아이디를 만들고 나면 사용법 슬라이드를 한 번 보여줘요
    return run(() => store.setHandle(state.user.uid, handle));
  }
  if (form.dataset.form !== 'sheet' || !sheetSubmit) return;
  // 화면은 저장 결과를 기다리지 않고 바로 닫습니다. 실시간 구독이 곧바로 반영해 줍니다.
  const result = sheetSubmit(data, form);
  if (result === false) return;
  if (typeof result === 'string') return toast(result);
  closeSheet();
  Promise.resolve(result).catch(err => { console.error(err); toast(errorText(err)); });
});

render();
