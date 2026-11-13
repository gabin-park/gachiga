# 가치가 ✈️

**친구와 함께 짜는 여행 계획 웹앱**: 일정, 가고 싶은 곳, 경비 정산을 한곳에서 실시간으로 같이 채워요.

👉 **바로 써보기: https://gachiga-trip.web.app**
(구글 계정으로 로그인 · 아이폰은 사파리 ⋯ → 공유 → 홈 화면에 추가하면 앱처럼 쓸 수 있어요)

---

## 왜 만들었나

친구들과 여행을 준비하면 일정은 메모장에, 맛집은 인스타 저장 목록에, 돈 계산은 단톡방에 흩어져요.
가치가는 이걸 **여행 하나에 한 장의 탑승권**으로 묶어서, 함께 가는 사람 모두가 같은 화면을 보며 계획하도록 만들었어요.

## 주요 기능

| | 기능 | 설명 |
|---|---|---|
| 🎫 | **여행마다 탑승권** | 날짜·공항을 적으면 탑승권 모양의 카드가 생기고, 출발 전엔 D-day, 여행 중엔 오늘이 DAY 몇인지 보여줘요. |
| 👥 | **친구와 함께 편집** | 아이디로 친구를 맺고 여행에 초대하면, 모든 변경이 서로의 화면에 실시간으로 반영돼요. |
| 📍 | **가고 싶은 곳 지도** | 장소 이름을 검색하면 지도에 핀이 꽂히고, 하트를 많이 받은 곳이 위로 올라와요. |
| 📸 | **인스타 링크로 장소 담기** | 릴스·게시물 링크를 붙여넣으면 AI가 본문 속 가게·장소를 찾아 위치까지 채워줘요. 구글맵 공유 링크도 위치를 읽어요. |
| 🗺️ | **DAY별 일정과 동선** | 일정을 DAY별로 정리하고, 지도에 하루 동선을 그려요. 구글맵 길찾기로 바로 열고 날씨도 함께 봐요. |
| 💸 | **자동 정산 · 외화 환율** | 지출마다 통화를 고르면 실시간 환율로 바꿔서, 누가 누구에게 얼마 보내면 되는지 계산해요. 정산 내용은 복사해서 단톡방에 붙여넣으면 돼요. |
| 📱 | **앱처럼 쓰기** | 홈 화면에 추가하면 주소창 없이 열리고, 새 버전이 나오면 위에 알림이 떠요. |

## 기술 스택

**유료 API나 서버 비용 없이** 무료 서비스만으로 만들었어요.

- **프론트엔드**: 빌드 도구 없는 바닐라 JavaScript (ES 모듈) SPA, 해시 라우팅
- **백엔드**: Firebase Authentication (Google 로그인) · Cloud Firestore (실시간 동기화) · Firebase Hosting
- **보안**: Firestore 보안 규칙으로 여행 멤버만 읽고 쓰기
- **AI 장소 분석**: Cloudflare Workers + Workers AI (Llama 3.3 70B)로 인스타 본문에서 장소를 추출
- **지도**: MapLibre GL + OpenFreeMap 타일 (한국어 지명 우선 표시)
- **검색·경로**: Photon / Nominatim (장소 검색), OSRM (routing.openstreetmap.de, 동선)
- **데이터**: Open-Meteo (날씨), Coinbase / open.er-api (환율, 실시간 · 캐시)

## 구조

```
public/
  index.html          진입점 (배포마다 ?v= 로 캐시 무효화)
  app.js              화면 · 라우팅 · 지도 · 정산 계산
  store.js            저장소 선택 (Firebase 설정이 없으면 데모 모드)
  store-firebase.js   Firestore 실시간 구독, Google 로그인
  store-local.js      데모 모드 저장소 (localStorage, 탭 간 동기화)
  styles.css          디자인 (종이 질감 탑승권 · 엽서 · 영수증 테마)
  airports.js         공항 코드 · 도시 목록
worker/
  src/index.js        인스타·구글맵 링크 분석 서버 (Cloudflare Workers)
firestore.rules       보안 규칙
```

Firestore 구조: `trips/{id}` 아래에 `events`(일정), `places`(장소), `expenses`(지출) 하위 컬렉션.

## 로컬에서 실행하기

`public/firebase-config.js`의 `apiKey`를 비우면 **데모 모드**로 동작해요. 데이터는 그 브라우저에만 저장되고,
새 탭에서 다른 이름으로 들어가면 친구 역할을 해볼 수 있어요.

```bash
python3 -m http.server 5188 --directory public
```

브라우저에서 http://localhost:5188 접속.

## 직접 배포하기 (무료)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고
   **Authentication → Google** 로그인과 **Firestore Database**를 켜요.
2. 웹 앱을 등록하고 나오는 `firebaseConfig` 값을 `public/firebase-config.js`에 붙여넣어요.
3. 배포해요 (Node.js 필요).

   ```bash
   npx firebase-tools login
   ```
   ```bash
   npx firebase-tools use --add
   ```
   ```bash
   npx firebase-tools deploy
   ```

4. 인스타 분석 서버(선택)는 `worker/`에서 Cloudflare Workers로 배포하고,
   `public/app.js`의 `IG_API` 주소를 바꿔요. 없어도 나머지 기능은 모두 동작해요.
