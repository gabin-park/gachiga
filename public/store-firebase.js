// Firestore 구조
//   users/{uid}                      이름, 사진, 고유 아이디(handle)
//   users/{uid}/friends/{friendUid}  친구 목록 (양쪽에 하나씩)
//   handles/{handle}                 아이디 → uid (중복 방지)
//   friendRequests/{from}_{to}       친구 요청
//   trips/{tripId}                   이름, 날짜, 통화, ownerId, members[], memberInfo{}, invitedIds[], invitedInfo{}
//   trips/{tripId}/events|places|expenses/{id}
const SDK = 'https://www.gstatic.com/firebasejs/11.0.2';
const KINDS = ['events', 'places', 'expenses'];

export async function createFirebaseStore(config) {
  const [{ initializeApp }, authM, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const {
    doc, collection, query, where, onSnapshot, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    arrayUnion, arrayRemove, deleteField, writeBatch, runTransaction,
  } = fs;

  const app = initializeApp(config);
  const auth = authM.getAuth(app);
  let db;
  try {
    // 오프라인에서도 보이고, 다시 연결되면 자동으로 맞춰집니다.
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }
  authM.getRedirectResult(auth).catch(() => {});

  const toUser = u => u && {
    uid: u.uid,
    name: u.displayName || '여행자',
    photo: u.photoURL || '',
  };
  const card = p => ({ uid: p.uid, name: p.name || '', photo: p.photo || '', handle: p.handle || '' });
  const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const listen = (ref, cb, onError) => onSnapshot(ref, s => cb(docs(s)), onError);
  const userRef = uid => doc(db, 'users', uid);
  const tripRef = id => doc(db, 'trips', id);
  const itemsRef = (tripId, kind) => collection(db, 'trips', tripId, kind);
  const requestRef = (from, to) => doc(db, 'friendRequests', `${from}_${to}`);

  return {
    // ---- 로그인 ----
    onAuth(cb) {
      return authM.onAuthStateChanged(auth, u => cb(toUser(u)));
    },
    async signIn() {
      const provider = new authM.GoogleAuthProvider();
      try {
        await authM.signInWithPopup(auth, provider);
      } catch (e) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
          return authM.signInWithRedirect(auth, provider);
        }
        if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) throw e;
      }
    },
    signOut() {
      return authM.signOut(auth);
    },

    // ---- 프로필 & 아이디 ----
    async ensureProfile(u) {
      const snap = await getDoc(userRef(u.uid));
      if (snap.exists()) return { uid: u.uid, ...snap.data() };
      const profile = { name: u.name, photo: u.photo, handle: '', createdAt: Date.now() };
      await setDoc(userRef(u.uid), profile);
      return { uid: u.uid, ...profile };
    },
    watchProfile(uid, cb, onError) {
      return onSnapshot(userRef(uid), d => cb(d.exists() ? { uid, ...d.data() } : null), onError);
    },
    async setHandle(uid, handle) {
      await runTransaction(db, async tx => {
        const handleRef = doc(db, 'handles', handle);
        const [h, u] = await Promise.all([tx.get(handleRef), tx.get(userRef(uid))]);
        if (h.exists() && h.data().uid !== uid) throw Object.assign(new Error('handle-taken'), { code: 'handle-taken' });
        const old = u.data()?.handle;
        if (old === handle) return;
        if (old) tx.delete(doc(db, 'handles', old));
        tx.set(handleRef, { uid });
        tx.update(userRef(uid), { handle });
      });
    },
    // 색·사진 표시 같은 꾸미기 설정만 바꿉니다. 아이디는 setHandle로.
    updateProfile(uid, patch) {
      return updateDoc(userRef(uid), patch);
    },
    async findByHandle(handle) {
      const h = await getDoc(doc(db, 'handles', handle));
      if (!h.exists()) return null;
      const u = await getDoc(userRef(h.data().uid));
      return u.exists() ? { uid: u.id, ...u.data() } : null;
    },

    // ---- 친구 ----
    watchFriends(uid, cb, onError) {
      return listen(collection(db, 'users', uid, 'friends'), cb, onError);
    },
    watchFriendRequests(uid, dir, cb, onError) {
      return listen(query(collection(db, 'friendRequests'), where(dir === 'in' ? 'to' : 'from', '==', uid)), cb, onError);
    },
    async sendFriendRequest(me, them) {
      // 상대가 이미 나에게 요청했다면 바로 친구가 됩니다.
      const reverse = await getDoc(requestRef(them.uid, me.uid));
      if (reverse.exists()) return this.acceptFriendRequest(me, { id: reverse.id, ...reverse.data() });
      // 이미 보낸 요청이면 다시 쓰지 않아요(규칙상 덮어쓰기가 막혀 있어 오류가 나요).
      if ((await getDoc(requestRef(me.uid, them.uid))).exists()) return;
      await setDoc(requestRef(me.uid, them.uid), {
        from: me.uid, to: them.uid, fromInfo: card(me), toInfo: card(them), createdAt: Date.now(),
      });
    },
    async acceptFriendRequest(me, req) {
      // 다른 기기에서 먼저 수락해 요청이 사라졌다면, 이미 친구가 된 거라 할 일이 없어요.
      if (!(await getDoc(doc(db, 'friendRequests', req.id))).exists()) return;
      const b = writeBatch(db);
      b.set(doc(db, 'users', me.uid, 'friends', req.from), { ...card(req.fromInfo), since: Date.now() });
      b.set(doc(db, 'users', req.from, 'friends', me.uid), { ...card(me), since: Date.now() });
      b.delete(doc(db, 'friendRequests', req.id));
      await b.commit();
    },
    deleteFriendRequest(req) {
      return deleteDoc(doc(db, 'friendRequests', req.id));
    },
    async removeFriend(myUid, friendUid) {
      const b = writeBatch(db);
      b.delete(doc(db, 'users', myUid, 'friends', friendUid));
      b.delete(doc(db, 'users', friendUid, 'friends', myUid));
      await b.commit();
    },

    // ---- 여행 & 멤버 ----
    watchTrips(uid, cb, onError) {
      return listen(query(collection(db, 'trips'), where('members', 'array-contains', uid)), cb, onError);
    },
    watchTripInvites(uid, cb, onError) {
      return listen(query(collection(db, 'trips'), where('invitedIds', 'array-contains', uid)), cb, onError);
    },
    watchTrip(tripId, cb, onError) {
      return onSnapshot(tripRef(tripId), d => cb(d.exists() ? { id: d.id, ...d.data() } : null), onError);
    },
    createTrip(me, data) {
      const ref = doc(collection(db, 'trips'));
      const done = setDoc(ref, {
        ...data,
        ownerId: me.uid,
        members: [me.uid],
        memberInfo: { [me.uid]: card(me) },
        invitedIds: [],
        invitedInfo: {},
        createdAt: Date.now(),
      });
      return { id: ref.id, done };
    },
    updateTrip(tripId, patch) {
      return updateDoc(tripRef(tripId), patch);
    },
    async deleteTrip(tripId) {
      for (const kind of KINDS) {
        const snap = await getDocs(itemsRef(tripId, kind));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      await deleteDoc(tripRef(tripId));
    },
    inviteToTrip(tripId, friend) {
      return updateDoc(tripRef(tripId), {
        invitedIds: arrayUnion(friend.uid),
        [`invitedInfo.${friend.uid}`]: card(friend),
      });
    },
    cancelInvite(tripId, uid) {
      return updateDoc(tripRef(tripId), { invitedIds: arrayRemove(uid), [`invitedInfo.${uid}`]: deleteField() });
    },
    declineTripInvite(tripId, uid) {
      return this.cancelInvite(tripId, uid);
    },
    acceptTripInvite(me, tripId) {
      return updateDoc(tripRef(tripId), {
        members: arrayUnion(me.uid),
        [`memberInfo.${me.uid}`]: card(me),
        invitedIds: arrayRemove(me.uid),
        [`invitedInfo.${me.uid}`]: deleteField(),
      });
    },
    // 내보내기와 나가기 모두 이것을 씁니다. 지출 기록의 이름이 남도록 memberInfo는 지우지 않습니다.
    removeMember(tripId, uid) {
      return updateDoc(tripRef(tripId), { members: arrayRemove(uid) });
    },

    // ---- 일정 · 장소 · 지출 ----
    watchItems(tripId, kind, cb, onError) {
      return listen(itemsRef(tripId, kind), cb, onError);
    },
    addItem(tripId, kind, data) {
      return addDoc(itemsRef(tripId, kind), { ...data, createdAt: Date.now() }).then(r => r.id);
    },
    updateItem(tripId, kind, id, patch) {
      return updateDoc(doc(db, 'trips', tripId, kind, id), patch);
    },
    removeItem(tripId, kind, id) {
      return deleteDoc(doc(db, 'trips', tripId, kind, id));
    },
    toggleInArray(tripId, kind, id, field, value, on) {
      return updateDoc(doc(db, 'trips', tripId, kind, id), { [field]: on ? arrayUnion(value) : arrayRemove(value) });
    },
  };
}
