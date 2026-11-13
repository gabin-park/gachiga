// 데모 모드: localStorage에 저장하고, 같은 브라우저의 다른 탭과 실시간으로 맞춥니다.
// 로그인한 사람은 탭마다 따로(sessionStorage) 기억하므로, 새 탭에서 다른 이름으로
// 들어가면 친구 역할을 해볼 수 있습니다. Firebase 저장소와 같은 인터페이스입니다.
const DATA_KEY = 'gatchiga-demo-v2';
const USER_KEY = 'gatchiga-demo-user';

export function createLocalStore() {
  const read = (storage, key, fallback) => {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (storage, key, value) => {
    try { value == null ? storage.removeItem(key) : storage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const load = () => ({ trips: {}, users: {}, handles: {}, requests: {}, friends: {}, ...read(localStorage, DATA_KEY, {}) });

  let data = load();
  let user = read(sessionStorage, USER_KEY, null);
  const listeners = new Set();
  const authListeners = new Set();
  const channel = 'BroadcastChannel' in self ? new BroadcastChannel('gatchiga-demo') : null;

  const emit = () => listeners.forEach(fn => fn());
  const save = () => {
    write(localStorage, DATA_KEY, data);
    channel?.postMessage('changed');
    queueMicrotask(emit);
  };
  if (channel) channel.onmessage = () => { data = load(); emit(); };

  const subscribe = fn => { listeners.add(fn); fn(); return () => listeners.delete(fn); };
  const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const clone = o => JSON.parse(JSON.stringify(o));
  const tripOnly = ({ items, ...trip }) => clone(trip);
  const fail = code => Object.assign(new Error(code), { code });
  const getTrip = id => { const t = data.trips[id]; if (!t) throw fail('not-found'); return t; };
  const card = p => ({ uid: p.uid, name: p.name || '', photo: p.photo || '', handle: p.handle || '' });
  const setUser = u => { user = u; write(sessionStorage, USER_KEY, u); authListeners.forEach(fn => fn(u)); };
  const tripsWhere = (field, uid) => Object.values(data.trips).filter(t => (t[field] || []).includes(uid)).map(tripOnly);

  return {
    onAuth(cb) { authListeners.add(cb); cb(user); return () => authListeners.delete(cb); },
    async signIn(name) { setUser({ uid: 'u_' + newId(), name: name || '나', photo: '' }); },
    async signOut() { setUser(null); },

    async ensureProfile(u) {
      data.users[u.uid] ||= { name: u.name, photo: u.photo, handle: '', createdAt: Date.now() };
      save();
      return { uid: u.uid, ...clone(data.users[u.uid]) };
    },
    watchProfile(uid, cb) {
      return subscribe(() => cb(data.users[uid] ? { uid, ...clone(data.users[uid]) } : null));
    },
    async setHandle(uid, handle) {
      if (data.handles[handle] && data.handles[handle] !== uid) throw fail('handle-taken');
      const old = data.users[uid].handle;
      if (old && old !== handle) delete data.handles[old];
      data.handles[handle] = uid;
      data.users[uid].handle = handle;
      save();
    },
    async updateProfile(uid, patch) { Object.assign(data.users[uid], patch); save(); },
    async findByHandle(handle) {
      const uid = data.handles[handle];
      return uid ? { uid, ...clone(data.users[uid]) } : null;
    },

    watchFriends(uid, cb) {
      return subscribe(() => cb(Object.values(data.friends[uid] || {}).map(clone)));
    },
    watchFriendRequests(uid, dir, cb) {
      const key = dir === 'in' ? 'to' : 'from';
      return subscribe(() => cb(Object.entries(data.requests).filter(([, r]) => r[key] === uid).map(([id, r]) => ({ id, ...clone(r) }))));
    },
    async sendFriendRequest(me, them) {
      const reverse = `${them.uid}_${me.uid}`;
      if (data.requests[reverse]) return this.acceptFriendRequest(me, { id: reverse, ...data.requests[reverse] });
      data.requests[`${me.uid}_${them.uid}`] = { from: me.uid, to: them.uid, fromInfo: card(me), toInfo: card(them), createdAt: Date.now() };
      save();
    },
    async acceptFriendRequest(me, req) {
      (data.friends[me.uid] ||= {})[req.from] = { ...card(req.fromInfo), since: Date.now() };
      (data.friends[req.from] ||= {})[me.uid] = { ...card(me), since: Date.now() };
      delete data.requests[req.id];
      save();
    },
    async deleteFriendRequest(req) { delete data.requests[req.id]; save(); },
    async removeFriend(a, b) { delete data.friends[a]?.[b]; delete data.friends[b]?.[a]; save(); },

    watchTrips(uid, cb) { return subscribe(() => cb(tripsWhere('members', uid))); },
    watchTripInvites(uid, cb) { return subscribe(() => cb(tripsWhere('invitedIds', uid))); },
    watchTrip(tripId, cb) {
      return subscribe(() => cb(data.trips[tripId] ? tripOnly(data.trips[tripId]) : null));
    },
    createTrip(me, trip) {
      const id = newId();
      data.trips[id] = {
        ...trip, id,
        ownerId: me.uid,
        members: [me.uid],
        memberInfo: { [me.uid]: card(me) },
        invitedIds: [],
        invitedInfo: {},
        createdAt: Date.now(),
        items: { events: {}, places: {}, expenses: {} },
      };
      save();
      return { id, done: Promise.resolve() };
    },
    async updateTrip(tripId, patch) { Object.assign(getTrip(tripId), patch); save(); },
    async deleteTrip(tripId) { delete data.trips[tripId]; save(); },
    async inviteToTrip(tripId, friend) {
      const t = getTrip(tripId);
      t.invitedIds = [...new Set([...(t.invitedIds || []), friend.uid])];
      (t.invitedInfo ||= {})[friend.uid] = card(friend);
      save();
    },
    async cancelInvite(tripId, uid) {
      const t = getTrip(tripId);
      t.invitedIds = (t.invitedIds || []).filter(x => x !== uid);
      delete t.invitedInfo?.[uid];
      save();
    },
    declineTripInvite(tripId, uid) { return this.cancelInvite(tripId, uid); },
    async acceptTripInvite(me, tripId) {
      const t = getTrip(tripId);
      if (!(t.invitedIds || []).includes(me.uid)) throw fail('permission-denied');
      t.invitedIds = t.invitedIds.filter(x => x !== me.uid);
      delete t.invitedInfo?.[me.uid];
      if (!t.members.includes(me.uid)) t.members.push(me.uid);
      t.memberInfo[me.uid] = card(me);
      save();
    },
    async removeMember(tripId, uid) {
      const t = getTrip(tripId);
      t.members = t.members.filter(x => x !== uid);
      save();
    },

    watchItems(tripId, kind, cb) {
      return subscribe(() => cb(Object.values(data.trips[tripId]?.items[kind] || {}).map(clone)));
    },
    async addItem(tripId, kind, item) {
      const id = newId();
      getTrip(tripId).items[kind][id] = { ...item, id, createdAt: Date.now() };
      save();
      return id;
    },
    async updateItem(tripId, kind, id, patch) {
      Object.assign(getTrip(tripId).items[kind][id], patch);
      save();
    },
    async removeItem(tripId, kind, id) {
      delete getTrip(tripId).items[kind][id];
      save();
    },
    async toggleInArray(tripId, kind, id, field, value, on) {
      const item = getTrip(tripId).items[kind][id];
      const list = (item[field] || []).filter(v => v !== value);
      item[field] = on ? [...list, value] : list;
      save();
    },
  };
}
