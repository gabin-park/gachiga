// 설정이 있으면 Firebase(친구와 실시간 공유), 없으면 로컬 데모 저장소를 씁니다.
// 두 저장소는 같은 인터페이스를 가집니다.
import { firebaseConfig } from './firebase-config.js';

export const isDemo = !firebaseConfig.apiKey;

export const store = isDemo
  ? (await import('./store-local.js')).createLocalStore()
  : await (await import('./store-firebase.js')).createFirebaseStore(firebaseConfig);
