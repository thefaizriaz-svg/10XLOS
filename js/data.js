// data.js — LOS data layer (Firestore-backed)
// STORE.state / STORE.save() / STORE.reset() keep the exact same shape
// app.js has always used — only this file changed when we moved off localStorage.
// Reads/writes are synchronous from the UI's point of view via a local cache
// (_cache below) that Firestore's onSnapshot listener keeps fresh in the
// background, with offline persistence so it still works with no signal.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  EmailAuthProvider, linkWithCredential, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  doc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdR0Qvf2SXDAnFWNEOOI-Rwex3O_YgGFY",
  authDomain: "xlos-9fb36.firebaseapp.com",
  projectId: "xlos-9fb36",
  storageBucket: "xlos-9fb36.firebasestorage.app",
  messagingSenderId: "245604615440",
  appId: "1:245604615440:web:c669198eab72341b705195"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});

const SEED = {
  identity: {
    statement: "I am becoming a systems builder. I create practical technology that improves lives. I solve real problems instead of chasing trends. I value simplicity over complexity. I build for decades, not for quick wins.",
    mission: "To build practical software, AI systems and businesses that simplify people's lives while creating sustainable recurring value.",
    vision: "Within the next decade I want to become known as someone who consistently builds useful technology, thinks in systems, develops people, and creates businesses that continue generating value long after they are launched.",
    values: [
      "Simplicity",
      "Integrity",
      "Continuous Learning",
      "Execution",
      "Consistency",
      "Long-Term Thinking",
      "Curiosity",
      "Service",
      "Ownership"
    ],
    principles: [
      "Build systems instead of depending on motivation.",
      "Execution creates clarity.",
      "Learn by building.",
      "Finish before starting something new.",
      "Simple solutions are usually better.",
      "Technology should remove work, not create it.",
      "Consistency beats intensity.",
      "Never stop improving."
    ],
    decisionRules: [
      "Will this move me closer to my mission?",
      "Is this solving a real problem?",
      "Will this matter in five years?",
      "Can this become a repeatable system?",
      "Can AI make this easier?",
      "Am I building or just staying busy?"
    ],
    nonNegotiables: [
      "Protect my health.",
      "Protect my integrity.",
      "Protect my learning.",
      "Protect my family.",
      "Protect deep thinking.",
      "Never sacrifice long-term goals for short-term comfort."
    ],
    philosophy: "I am not trying to become more productive. I am becoming more intentional. Every decision should move me closer to becoming a systems builder. Every project should solve a real problem. Every lesson should become a reusable system. Every year I should become simpler, wiser and more valuable than the year before. This application is not here to manage my life. It is here to remind me who I am becoming.",
    success: "Success means becoming someone whose systems, software and ideas continue creating value for people while allowing me to live a meaningful and balanced life.",
    failure: "Failure is spending years staying busy without building anything meaningful."
  },
  blueprint: {
    season: "Foundation Season — Building myself before building businesses.",
    direction: "Build LOS first. Use it daily. Improve it through real usage. Then transform successful modules into SaaS products.",
    longTermVision: "Every small improvement I make today compounds into the person I will become over the next decade.",
    priorities: [
      "Build LOS",
      "Learn modern software architecture",
      "Launch Sales Scholar",
      "Build recurring revenue products",
      "Continue improving AI skills"
    ],
    ignore: [
      "Shiny tools",
      "Complicated productivity systems",
      "Building features before validating them",
      "Working without purpose"
    ],
    guidingQuestion: "Am I building the person I want to become?"
  },
  goals: [
    { id: 'g1', title: 'Health', why: 'Build strength, energy and long-term health that supports everything else.', progress: 20, deadline: '', category: 'growth', completedAt: null },
    { id: 'g2', title: 'Business', why: 'Create practical software businesses with recurring revenue.', progress: 35, deadline: '', category: 'career', completedAt: null },
    { id: 'g3', title: 'Learning', why: 'Master software development, AI, systems thinking and product design.', progress: 30, deadline: '', category: 'growth', completedAt: null },
    { id: 'g4', title: 'Career', why: 'Become a trusted builder who can solve complex problems through technology.', progress: 45, deadline: '', category: 'career', completedAt: null },
    { id: 'g5', title: 'Finance', why: 'Create multiple recurring income streams through valuable products.', progress: 15, deadline: '', category: 'career', completedAt: null },
    { id: 'g6', title: 'Relationships', why: 'Intentionally schedule quality time with family, close friends, and the people who matter most because relationships deserve planning, not leftovers.', progress: 25, deadline: '', category: 'growth', completedAt: null },
    { id: 'g7', title: 'Legacy', why: 'Leave behind systems, products and knowledge that continue helping people after I am gone.', progress: 10, deadline: '', category: 'career', completedAt: null },
    { id: 'g8', title: 'Content System', why: 'Build and prove a repeatable raw-footage-to-published pipeline in Premiere Pro (locked template, preset, checklist), publishing on a fixed schedule for 90 days straight. The win is the system existing, not any single video.', progress: 5, deadline: '2026-11-01', category: 'growth', completedAt: null },
    { id: 'g9', title: 'Health System', why: 'One non-negotiable daily time block that runs automatically for 90 days \u2014 tracked as a streak, not a vague intention.', progress: 5, deadline: '2026-11-01', category: 'growth', completedAt: null }
  ],
  actions: [
    { id: 'a1', title: 'Build LOS', why: 'The compass itself has to exist before anything else works.', goalId: 'g2', status: 'Active' },
    { id: 'a2', title: 'Launch Sales Scholar', why: 'First real test of turning a system into a product.', goalId: 'g2', status: 'Not Started' },
    { id: 'a3', title: 'Learn Firebase', why: 'Needed to make LOS real, not a mockup.', goalId: 'g3', status: 'Active' }
  ],
  brain: [
    { id: 'b1', category: 'Frameworks', title: 'What Deserves a Note', content: 'Store only knowledge worth remembering. Every note should answer one of these: what did I learn, what problem does this solve, will Future Me benefit, can this become a reusable system, can I teach this. If not, don\u2019t save it.' },
    { id: 'b2', category: 'Frameworks', title: 'LOS Decision Filter', content: 'Before starting anything: does it solve a real problem, can it become a system, does it create recurring value, does it align with my vision, will I be proud of it in ten years.' },
    { id: 'b3', category: '10x Thinking', title: 'Unique Ability', content: 'Editing, admin, and busywork are skills, not your unique ability. Your time should go to the 20% only you can do \u2014 the idea, the hook, the judgment call. If you\u2019re still doing 100% of the low-value work in 90 days, that\u2019s a 2x outcome, not a 10x one.' },
    { id: 'b4', category: '10x Thinking', title: 'Who Not How', content: 'Stop asking "how do I find the discipline." Ask "who or what system makes this automatic." Willpower is not a plan \u2014 a fixed time block, a default action, or someone else\u2019s help is.' },
    { id: 'b5', category: '10x Thinking', title: 'The Gap and the Gain', content: 'Measure progress against where you started, not against the ideal \u2014 or you will always feel behind. A visible progress marker (like a goal\u2019s % in LOS) exists to show the Gain, not to invite comparison to some perfect version.' }
  ],
  system: {
    dailyUse: ['Read Mission', 'Review Vision', 'Check Roadmap', 'Take the next meaningful action', 'Capture important lessons', 'Close LOS', 'Go build'],
    weekly: ['Review progress', 'Remove unnecessary work', 'Update goals', 'Record lessons', 'Simplify systems'],
    monthly: ['Review direction', 'Celebrate progress', 'Remove distractions', 'Update roadmap', 'Plan the next month intentionally'],
    rule: 'LOS should never become another full-time job. If I spend more time managing LOS than building my life, the system has failed.'
  },
  home: {
    mission: "I build practical systems that simplify work, solve real problems, and create lasting value.",
    visionReminder: "Every small improvement I make today compounds into the person I will become over the next decade.",
    reflection: "Progress is created through consistent action, not perfect planning.",
    quickReminder: "When confused, return to the mission."
  },
  meta: { lastOpened: null, recentChanges: [] }
};

function migrate(parsed) {
  if (!parsed.home) parsed.home = structuredClone(SEED.home);
  if (parsed.home.visionReminder === undefined) parsed.home.visionReminder = SEED.home.visionReminder;
  if (parsed.home.reflection === undefined) parsed.home.reflection = SEED.home.reflection;
  if (parsed.home.quickReminder === undefined) parsed.home.quickReminder = SEED.home.quickReminder;
  if (!parsed.meta) parsed.meta = { lastOpened: null, recentChanges: [] };
  if (!parsed.meta.recentChanges) parsed.meta.recentChanges = [];
  if (Array.isArray(parsed.goals)) {
    parsed.goals.forEach(g => {
      if (g.deadline === undefined) g.deadline = '';
      if (!g.category) g.category = 'growth';
      if (g.completedAt === undefined) g.completedAt = null;
    });
  }
  if (Array.isArray(parsed.actions)) {
    parsed.actions.forEach(a => {
      if (!a.kind) a.kind = 'once';
    });
  }
  return parsed;
}

function load() {
  return _cache;
}

function save(state) {
  _cache = state;
  if (_docRef) {
    setDoc(_docRef, state).catch(e => console.error('LOS Firestore save failed', e));
  }
  return true;
}

/* ---------------- Firestore live sync ---------------- */
// Local cache the UI reads/writes synchronously. Starts as SEED so the app
// renders instantly; gets replaced the moment Firestore responds (near-
// instant on repeat visits thanks to persistentLocalCache above).
let _cache = structuredClone(SEED);
let _docRef = null;
let _status = 'connecting';
let _authReady = false;
let _authReadyCallbacks = [];

function afterSync() {
  // app.js defines this; by the time Firestore actually responds
  // (a network/cache tick later), app.js has already run and defined it.
  if (typeof renderAll === 'function') renderAll();
}

function markAuthReady() {
  if (_authReady) return;
  _authReady = true;
  _authReadyCallbacks.forEach(cb => cb());
  _authReadyCallbacks = [];
}

function onAuthReady(callback) {
  if (_authReady) callback();
  else _authReadyCallbacks.push(callback);
}

signInAnonymously(auth).catch(e => {
  _status = 'error';
  console.error('LOS auth failed', e);
  afterSync();
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    _status = 'connecting';
    signInAnonymously(auth).catch(e => {
      _status = 'error';
      console.error('LOS re-auth failed', e);
      afterSync();
    });
    return;
  }
  markAuthReady();
  _docRef = doc(db, 'users', user.uid, 'los', 'state');
  onSnapshot(_docRef, (snap) => {
    if (snap.exists()) {
      _cache = migrate(snap.data());
    } else {
      _cache = structuredClone(SEED);
      setDoc(_docRef, _cache).catch(e => console.error('LOS Firestore seed failed', e));
    }
    _status = 'synced';
    afterSync();
  }, (e) => {
    _status = 'error';
    console.error('LOS Firestore sync failed', e);
    afterSync();
  });
});

function getStatus() {
  return _status;
}

function isSecured() {
  return !!(auth.currentUser && auth.currentUser.providerData.some(p => p.providerId === 'password'));
}

function getUserEmail() {
  return auth.currentUser ? auth.currentUser.email : null;
}

async function secureAccount(email, password) {
  const cred = EmailAuthProvider.credential(email, password);
  await linkWithCredential(auth.currentUser, cred);
  afterSync();
}

async function signInToRestore(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
  // onAuthStateChanged fires automatically and re-syncs everything
  // to whichever account this email/password belongs to.
}

async function signOutAccount() {
  await signOut(auth);
  // onAuthStateChanged fires with user=null, which auto-starts a fresh
  // anonymous session — this device gets an empty LOS until someone
  // signs back in with the secured email + password.
}

const STORE = {
  get state() {
    return load();
  },
  save,
  reset() {
    _cache = structuredClone(SEED);
    if (_docRef) setDoc(_docRef, _cache).catch(e => console.error('LOS Firestore reset failed', e));
  }
};

export { STORE, migrate, getStatus, isSecured, getUserEmail, secureAccount, signInToRestore, signOutAccount, onAuthReady };
