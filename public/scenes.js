// 여행 화면 위쪽 배경: 이동수단마다 다른 풍경, 여행 시작 달에 맞춘 계절
// 봄 3–5월 · 여름 6–8월 · 가을 9–11월 · 겨울 12–2월. 날짜가 없으면 오늘 기준이에요.
const PALETTE = {
  spring: { sky: ['#bfe0f7', '#fbe6ee'], dusk: ['#f7a8c0', '#ffe0e8'], sun: '#fff1c9', far: '#b7d9a8', near: '#8cc47e', tree: '#f4a7bf', treeEdge: '#e27f9f', sea: '#7fc0e8', cliff: '#c9a77a', fall: '#f4a7bf' },
  summer: { sky: ['#8fcdf5', '#e6f5fd'], dusk: ['#ff8a5c', '#ffd0a0'], sun: '#ffe08a', far: '#6fb37a', near: '#3f8a55', tree: '#2f7445', treeEdge: '#225a35', sea: '#2fa3d6', cliff: '#c9a77a', fall: null },
  autumn: { sky: ['#f4dcb0', '#fbf1e0'], dusk: ['#e9a066', '#fbe1bf'], sun: '#fff1c9', far: '#e6a35a', near: '#9c5a2e', tree: '#d8452f', treeEdge: '#a8321f', sea: '#4f8fc0', cliff: '#b98c5a', fall: '#d8452f' },
  winter: { sky: ['#9aa6cf', '#e6ebf6'], dusk: ['#7d82bb', '#d9cfe6'], sun: '#fff3c4', far: '#dde4ef', near: '#f6f8fc', tree: '#4f7468', treeEdge: '#ffffff', sea: '#6f8fb0', cliff: '#eef2f8', fall: '#ffffff' },
};

export function seasonOf(date) {
  const m = date ? Number(date.slice(5, 7)) : new Date().getMonth() + 1;
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}

// 하늘 그라데이션: 그림 위쪽 바깥까지 첫 색으로 이어져요
const sky = ([a, b], y1, y2) => `<defs><linearGradient id="scene-sky" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect y="-600" width="200" height="900" fill="url(#scene-sky)"/>`;
// 떨어지는 꽃잎·낙엽·눈. avoid: [x, y, r] 해·나무 자리라 그 근처 점은 빼요.
const fall = (s, [x0, y0, x1, y1], n, avoid = []) => !s.fall ? '' : Array.from({ length: n }, (_, i) => {
  const x = x0 + ((i * 53 + 17) % (x1 - x0)), y = y0 + ((i * 37 + 11) % (y1 - y0));
  if (avoid.some(([ax, ay, r]) => Math.hypot(x - ax, y - ay) < r + 5)) return '';
  return `<circle cx="${x}" cy="${y}" r="2.2" fill="${s.fall}"${s.fall === '#ffffff' ? ' stroke="#9fb0c8" stroke-width=".6"' : ''}/>`;
}).join('');
const tree = (s, x, y, r) => `<rect x="${x - 1.5}" y="${y}" width="3" height="${r + 4}" fill="#6b4a2f"/><circle cx="${x}" cy="${y}" r="${r}" fill="${s.tree}" stroke="${s.treeEdge}"/>`;

// 각 풍경: [viewBox 위쪽 y, 높이, 그림]. 아래쪽이 화면에 맞춰 붙어요.
const SCENES = {
  // 비행기: 원래 하늘·구름바다는 그대로 두고, 계절 빛과 꽃잎·눈만 얹어요
  plane: s => [0, 120, `<defs><linearGradient id="scene-tint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}" stop-opacity=".75"/><stop offset="1" stop-color="${s.sky[0]}" stop-opacity="0"/></linearGradient></defs>
    <rect y="-600" width="200" height="720" fill="url(#scene-tint)"/>${fall(s, [8, 4, 192, 34], 9, [[20, 16, 12], [180, 16, 12], [100, 16, 22]])}`],
  // 기차: 노을 진 다리 위를 지나는 기차
  train: s => [60, 135, `${sky(s.dusk, 60, 150)}
    <circle cx="86" cy="112" r="15" fill="${s.sun}"/>
    ${fall(s, [10, 82, 190, 104], 9, [[86, 112, 15], [34, 108, 7], [142, 109, 7], [180, 112, 6]])}
    <path d="M0 140L40 112 80 132 120 106 160 128 200 110V240H0Z" fill="${s.far}"/>
    ${tree(s, 34, 108, 7)}${tree(s, 142, 109, 7)}${tree(s, 180, 112, 6)}
    <path d="M0 150Q100 138 200 150V240H0Z" fill="${s.near}"/>
    <path d="M0 166H200" stroke="#4a332b" stroke-width="3"/>
    <g fill="#4a332b"><rect x="22" y="151" width="44" height="13" rx="3"/><rect x="68" y="151" width="44" height="13" rx="3"/><rect x="114" y="151" width="44" height="13" rx="3"/></g>
    <g fill="#ffe7a8"><rect x="27" y="154" width="6" height="5"/><rect x="37" y="154" width="6" height="5"/><rect x="73" y="154" width="6" height="5"/><rect x="83" y="154" width="6" height="5"/><rect x="119" y="154" width="6" height="5"/><rect x="129" y="154" width="6" height="5"/></g>
    <path d="M10 166V205M60 166V205M110 166V205M160 166V205" stroke="#4a332b" stroke-width="2.5"/>`],
  // 고속버스: 창가 좌석에서 본 바깥 풍경
  bus: (s, k) => [96, 110, `<defs><clipPath id="scene-win"><rect x="20" y="150" width="170" height="52" rx="12"/></clipPath></defs>
    <rect y="-600" width="200" height="900" fill="#ece5da"/>
    <g clip-path="url(#scene-win)">${sky(s.dusk, 150, 196)}
      <circle cx="100" cy="166" r="9" fill="${s.sun}"/>
      ${fall(s, [30, 154, 180, 166], 8, [[100, 166, 9], [46, 172, 4], [156, 166, 4]])}
      <path d="M0 182L50 170 100 178 150 168 200 175V210H0Z" fill="${s.far}"/>
      ${tree(s, 46, 172, 4)}${tree(s, 156, 166, 4)}
      <path d="M0 188Q100 182 200 188V210H0Z" fill="${s.near}"/>
      <path d="M0 196H200" stroke="#3b3a40" stroke-width="6"/><path d="M0 196H200" stroke="#f5c542" stroke-width=".8" stroke-dasharray="5 4"/>
      ${k === 'winter' ? '<path d="M20 150h20q-20 3-20 16zM190 150h-20q20 3 20 16z" fill="#fff" opacity=".8"/>' : ''}
    </g>
    <rect x="20" y="150" width="170" height="52" rx="12" fill="none" stroke="#b3a792" stroke-width="4"/>
    <path d="M0 -600H6Q14 110 12 230H0Z" fill="#c4622d"/><path d="M6 120Q15 170 8 225" stroke="#a34f22" stroke-width="2" fill="none"/>
    <rect x="152" y="188" width="42" height="40" rx="11" fill="#3d4f7a"/><rect x="158" y="193" width="30" height="8" rx="3" fill="#f1f5fa" opacity=".9"/>`],
  // 자동차: 바다를 따라 구불구불 이어지는 해안도로
  car: (s, k) => [70, 150, `${sky(s.sky, 40, 128)}
    ${k === 'summer' ? '<circle cx="48" cy="108" r="13" fill="#fff3c4"/>' : ''}
    ${fall(s, [10, 80, 110, 122], 7)}
    <path d="M0 128H200V240H0Z" fill="${s.sea}"/><path d="M0 128H200" stroke="#fff" stroke-width="1.5" opacity=".7"/>
    <path d="M15 150H55M70 172H105M20 196H60" stroke="#fff" stroke-width="1.2" opacity=".5"/>
    <path d="M112 240C124 188 158 156 200 134V240Z" fill="${s.cliff}"${k === 'winter' ? ' stroke="#c5d0e0"' : ''}/>
    <path d="M132 240C142 196 166 170 200 154" fill="none" stroke="#55514a" stroke-width="10"/>
    <path d="M132 240C142 196 166 170 200 154" fill="none" stroke="#f5c542" stroke-width="1.2" stroke-dasharray="6 5"/>
    ${tree(s, 188, 172, 6)}`],
};

export function tripScene(mode, startDate) {
  const k = seasonOf(startDate), [top, h, art] = (SCENES[mode] || SCENES.plane)(PALETTE[k], k);
  return `<div class="trip-scene ${mode}" aria-hidden="true"><svg viewBox="0 ${top} 200 ${h}" preserveAspectRatio="xMidYMax meet">${art}</svg></div>`;
}
