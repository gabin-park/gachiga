# 가치가 ✈️

친구랑 같이 짜는 여행 계획 웹앱. 일정 · 가고 싶은 장소 · 경비 정산을 실시간으로 함께 편집합니다.

## 지금 바로 보기 (데모 모드)

`public/firebase-config.js`가 비어 있으면 데모 모드로 동작합니다. 데이터는 이 브라우저에만 저장되고,
새 탭에서 다른 이름으로 들어가면 친구 역할을 해볼 수 있어요.

```bash
python3 -m http.server 5188 --directory public
```

브라우저에서 http://localhost:5188 접속.

## 친구와 진짜로 쓰기 (Firebase 연결, 무료)

1. https://console.firebase.google.com 에서 **프로젝트 추가** (Google 애널리틱스는 꺼도 됨)
2. **빌드 → Authentication → 시작하기 → Google** 사용 설정
3. **빌드 → Firestore Database → 데이터베이스 만들기**
   - 위치: `asia-northeast3 (서울)`, **프로덕션 모드**
4. **프로젝트 설정(⚙️) → 내 앱 → 웹(</>)** 앱 등록 → 나오는 `firebaseConfig` 값을
   `public/firebase-config.js`에 붙여넣기
5. 배포 (Node.js 필요)

   ```bash
   npm install -g firebase-tools
   ```
   ```bash
   firebase login
   ```
   ```bash
   firebase use --add
   ```
   ```bash
   firebase deploy
   ```

6. 출력된 `https://<프로젝트ID>.web.app` 주소를 사파리에서 열고, 여행을 만든 뒤 **＋ (친구 초대)** 로 링크를 보내면 끝.

> 사파리 공유 버튼 → **홈 화면에 추가** 하면 앱처럼 아이콘으로 열 수 있어요.

## 구조

| 파일 | 역할 |
|---|---|
| `public/app.js` | 화면 · 라우팅 · 정산 계산 |
| `public/store-firebase.js` | Firestore 실시간 구독, Google 로그인 |
| `public/store-local.js` | 데모 모드 저장소 (localStorage + 탭 간 동기화) |
| `public/styles.css` | 디자인 (탑승권 · 엽서 · 영수증 테마) |
| `firestore.rules` | 보안 규칙: 여행 멤버만 읽고 쓰기, 초대 링크로는 자기 자신만 합류 |

Firestore 구조: `trips/{id}` 아래에 `events`, `places`, `expenses` 하위 컬렉션.
