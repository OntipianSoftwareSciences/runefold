// Runefold autosave — session learning that happens by itself.
//
// What this is, in plain words:
//   While Scarlet is using Runefold, this file quietly remembers what happened
//   in THIS session only (in memory). Every 5 minutes or every 10 user
//   messages, it saves the existing Runefold store to disk so a crash cannot
//   lose the session. When the session ends — /exit, Ctrl+C, or the terminal
//   closing — it does a short "sleep" close-out: memory is consolidated with
//   the SAME consolidate() that /consolidate uses, brains are rested with the
//   SAME restBrain()/sleep() that /kind rest uses, and repeated lessons become
//   skills in the SAME skills.json. Nothing new is invented here: no second
//   memory store, no second learning system, no second kindness gate.
//
// Honest limits:
//   This saves to the local computer only (~/.runefold). It does NOT upload
//   anything to a cloud, and it does NOT train the Ollama/Qwen model weights.
//   It makes Runefold better at remembering and reusing what Scarlet taught
//   it — not generally intelligent.

import {
  dataLocation, readJson, writeJson,
  readMemories, writeMemories, readSkills, writeSkills,
} from "./store.js";
import {
  teach, forgetMemory, listSkills, recordSkill, consolidate,
} from "./learning.js";
import { restBrain, listSavedBrains, saveBrain } from "./fly.js";
import { checkKindness } from "./kindness.js";

const FIVE_MINUTES = 5 * 60 * 1000;
const MESSAGES_PER_SAVE = 10;
const now = () => new Date().toISOString();
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
const norm = (s) => clean(s).toLowerCase();

function emptySummary() {
  return {
    learned: [],
    skillsPromoted: [],
    forgotten: [],
    brainsRested: [],
    questionsUnanswered: [],
    // Extra plain-word notes (kept beside the five required fields).
    refusedKindly: [],
  };
}

function lastSessionFile() {
  return dataLocation() + "/last-session.json";
}

// Live, exported session summary object. Importers see updates when
// startSession() replaces it (ES module live bindings).
export let sessionSummary = emptySummary();

const session = {
  events: [],
  taughtIds: new Set(),
  acceptedIds: new Set(),
  rejectedIds: new Set(),
  usedIds: new Set(),
  brains: new Map(),     // name -> { name, template, brain }
  messagesSinceSave: 0,
  timer: null,
  closed: false,
  lastSaveAt: null,
  lastLineAt: 0,
  loadedAtStart: null,
};

// A memory is never dropped kindly if Scarlet explicitly taught it, if it is
// a verified correction, or if it is a core value (kindness / respect).
function isNeverForget(m) {
  const source = String(m.source || "");
  const content = String(m.content || "");
  const explicit = /explicit|verified|correction|taught/i.test(source) &&
    !/auto-learned/i.test(source);
  const coreValue = /transphobi|racis|pronoun|deadname|slur|respect everyone|core value|kindness/i.test(content);
  return !!m.confirmed || explicit || coreValue;
}

function shortList(items, max = 3) {
  if (!items.length) return "";
  const shown = items.slice(0, max);
  let text = shown.length === 1 ? shown[0] : shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1];
  if (items.length > max) text += ` (+${items.length - max} more)`;
  return text;
}

// "This session I learned X, I got better at Y, I rested Z brains, I still
// don't know Q." — the exact plain-words shape used on exit.
export function sessionSummaryText(s = sessionSummary) {
  const learned = s.learned.length ? shortList(s.learned) : "nothing new";
  const skills = s.skillsPromoted.length ? shortList(s.skillsPromoted) : "no new skills";
  const brains = s.brainsRested.length
    ? `${s.brainsRested.length} ${s.brainsRested.length === 1 ? "brain" : "brains"}`
    : "no brains";
  let line = `This session I learned ${learned}, I got better at ${skills}, I rested ${brains}`;
  line += s.questionsUnanswered.length
    ? `, I still don't know ${shortList(s.questionsUnanswered)}.`
    : ", and I had no questions I couldn't answer.";
  if (s.forgotten?.length) line += ` I let go of ${s.forgotten.length} unused ${s.forgotten.length === 1 ? "memory" : "memories"} kindly.`;
  if (s.refusedKindly?.length) line += ` I refused ${s.refusedKindly.length} unkind ${s.refusedKindly.length === 1 ? "request" : "requests"}, kindly.`;
  return line;
}

export function welcomeBackText(s) {
  if (!s || (!s.learned.length && !s.skillsPromoted.length && !s.brainsRested.length && !s.questionsUnanswered.length)) return "";
  const learned = s.learned.length ? shortList(s.learned) : null;
  const skills = s.skillsPromoted.length ? shortList(s.skillsPromoted) : null;
  const fallback = s.brainsRested.length
    ? `what we worked on (I rested ${s.brainsRested.length} ${s.brainsRested.length === 1 ? "brain" : "brains"})`
    : "what we worked on";
  const what = learned && skills ? `${learned} and got better at ${skills}` : learned || (skills ? `got better at ${skills}` : fallback);
  return `Welcome back — last time I learned ${what}.`;
}

export function getSessionSummary() {
  return sessionSummary;
}

export function loadLastSessionSummary() {
  const raw = readJson(lastSessionFile(), null);
  if (!raw || typeof raw !== "object") return emptySummary();
  const base = emptySummary();
  for (const key of Object.keys(base)) {
    if (Array.isArray(raw[key])) base[key] = raw[key].filter((x) => x !== undefined && x !== null).map(String);
  }
  base.savedAt = raw.savedAt || null;
  return base;
}

// Start a fresh, in-memory-only session. The timer is unref'd so a piped
// terminal session can still exit when stdin closes.
export function startSession({ startTimer = true } = {}) {
  if (session.timer) { clearInterval(session.timer); session.timer = null; }
  session.events = [];
  session.taughtIds = new Set();
  session.acceptedIds = new Set();
  session.rejectedIds = new Set();
  session.usedIds = new Set();
  session.brains = new Map();
  session.messagesSinceSave = 0;
  session.closed = false;
  session.lastSaveAt = null;
  session.lastLineAt = 0;
  // Saved state is loaded from the EXISTING store; there is no second store.
  session.loadedAtStart = {
    memories: readMemories().length,
    skills: readSkills().length,
    brains: listSavedBrains().length,
  };
  sessionSummary = emptySummary();
  if (startTimer) {
    session.timer = setInterval(() => {
      try { autosave(); } catch { /* a failed timer save must never kill the chat */ }
    }, FIVE_MINUTES);
    session.timer.unref?.();
  }
  const last = loadLastSessionSummary();
  return { last, welcomeLine: welcomeBackText(last) };
}

// Track one thing that happened this session. Everything stays in memory
// until autosave()/closeSession() writes it to the existing store.
export function trackSessionEvent(event) {
  if (!event || typeof event !== "object") return false;
  if (session.closed) return false;

  const type = String(event.type || "");
  const text = clean(event.text || event.name || "");
  const savedTypes = new Set(["teach", "accept", "reject", "success", "failure", "question", "brain", "command"]);

  // Kindness gate: a harmful / transphobic / racist job is never saved as a
  // skill or memory. Note the kind refusal instead.
  if (savedTypes.has(type) && text) {
    const check = checkKindness(text);
    if (!check.ok) {
      sessionSummary.refusedKindly.push(`${check.reason} [refused job: ${text}]`);
      // /teach already wrote the memory; undo it so autosave keeps no copy.
      if (event.id) { try { forgetMemory(event.id); } catch { /* best effort */ } }
      return false;
    }
  }

  session.events.push({ ...event, text, at: now() });

  if (type === "userMessage") {
    session.messagesSinceSave++;
    if (session.messagesSinceSave >= MESSAGES_PER_SAVE) autosave();
    return true;
  }
  if (type === "teach") {
    if (event.id) session.taughtIds.add(event.id);
    sessionSummary.learned.push(text || "(something Scarlet taught)");
  } else if (type === "accept") {
    if (event.id) session.acceptedIds.add(event.id);
    session.usedIds.add(event.id);
    if (text && !sessionSummary.learned.includes(text)) sessionSummary.learned.push(text);
  } else if (type === "reject") {
    if (event.id) session.rejectedIds.add(event.id);
  } else if (type === "success") {
    session.usedIds.add(event.id);
    if (text && !sessionSummary.learned.includes(`worked: ${text}`)) sessionSummary.learned.push(`worked: ${text}`);
  } else if (type === "question") {
    if (text && !sessionSummary.questionsUnanswered.includes(text)) sessionSummary.questionsUnanswered.push(text);
  } else if (type === "brain") {
    if (event.name) {
      const entry = session.brains.get(event.name) || { name: event.name, template: event.template };
      if (event.template) entry.template = event.template;
      if (event.brain) entry.brain = event.brain;
      session.brains.set(event.name, entry);
    }
  }
  return true;
}

// Atomic re-save of the EXISTING store, plus any live trained brain weights.
function maybePrintAutosaveLine() {
  const t = Date.now();
  if (t - session.lastLineAt < 30000) return false; // quiet: no terminal spam
  session.lastLineAt = t;
  return true;
}

export function autosave({ quiet = false } = {}) {
  if (session.closed) return { ok: false, reason: "session already closed" };
  const memories = readMemories();
  writeMemories(memories); // atomic write + .bak, from core/store.js
  const skills = readSkills();
  writeSkills(skills);

  let brainsSaved = 0;
  for (const entry of session.brains.values()) {
    if (entry.brain && entry.name) {
      try {
        saveBrain(entry.name, entry.template || "mushroom-body", entry.brain);
        brainsSaved++;
      } catch { /* a bad name must not stop autosave */ }
    }
  }

  session.messagesSinceSave = 0;
  session.lastSaveAt = now();
  if (!quiet && maybePrintAutosaveLine()) console.log("autosaved ✓");
  return { ok: true, savedAt: session.lastSaveAt, memories: memories.length, skills: skills.length, brainsSaved };
}

// Memory "sleep": accepted/used get stronger, rejected/unused get weaker,
// then the EXISTING consolidate() does the real consolidation. Explicitly
// taught memories and core values are restored if consolidate() dropped them.
function consolidateMemoryKindly() {
  const before = readMemories();
  const protectedItems = before.filter(isNeverForget);
  const items = before.map((m) => ({ ...m }));
  for (const m of items) {
    if (session.acceptedIds.has(m.id) || session.usedIds.has(m.id)) {
      m.confidence = Math.min(1, (m.confidence ?? 0.6) + 0.15); // same step as teach()
      m.uses = (m.uses ?? 0) + 1;
      m.updatedAt = now();
    } else if (session.rejectedIds.has(m.id)) {
      m.confidence = Math.max(0.1, (m.confidence ?? 0.6) - 0.25); // same step as contradict()
      m.contradictions = (m.contradictions ?? 0) + 1;
      m.updatedAt = now();
    } else if (session.taughtIds.has(m.id)) {
      // Taught but never used this session: a small, sleep-like fade.
      m.confidence = Math.max(0.1, (m.confidence ?? 0.6) - 0.02);
    }
  }
  writeMemories(items);

  const consolidated = consolidate(); // the one sleep step, reused as-is
  const after = readMemories();
  const afterIds = new Set(after.map((m) => m.id));
  const rescued = protectedItems.filter((m) => !afterIds.has(m.id));
  if (rescued.length) writeMemories([...after, ...rescued]);

  const finalIds = new Set(readMemories().map((m) => m.id));
  const forgotten = before
    .filter((m) => !finalIds.has(m.id))
    .map((m) => m.content);
  return { consolidated, forgotten };
}

// Promote a pattern seen 3+ times into the EXISTING skills.json, but only
// after the EXISTING kindness gate says the job is kind.
function promoteSessionSkills() {
  const counts = new Map();
  const add = (kind, text) => {
    const keyText = norm(text);
    if (!keyText) return;
    const key = `${kind}:${keyText}`;
    const found = counts.get(key);
    if (found) found.count++;
    else counts.set(key, { kind, text: clean(text), count: 1 });
  };
  for (const e of session.events) {
    if (e.type === "teach") add("teach", e.text);
    else if (e.type === "command" && e.outcome === "success" && e.name) add("command", e.name);
    else if (e.type === "success") add("worked", e.text);
  }

  for (const { kind, text, count } of counts.values()) {
    if (count < 3) continue;
    const check = checkKindness(text);
    if (!check.ok) {
      sessionSummary.refusedKindly.push(`${check.reason} [refused job: ${text}]`);
      continue; // never save a harmful / transphobic / racist job as a skill
    }
    const label = kind === "command" ? `Repeated command: ${text}` :
      kind === "worked" ? `Repeated success: ${text}` : `Session lesson: ${text}`;
    const name = label.slice(0, 120);
    if (listSkills().some((s) => s.name === name)) continue;
    recordSkill(name, text, `This ${kind} worked ${count} times this session — reuse it.`);
    sessionSummary.skillsPromoted.push(name);
  }
}

function restSessionBrains() {
  const saved = new Set(listSavedBrains().map((b) => b.name));
  for (const name of session.brains.keys()) {
    if (!saved.has(name)) continue;
    try {
      const r = restBrain(name); // existing sleep() + thank-you + rested marker
      if (r && r.name) sessionSummary.brainsRested.push(name);
    } catch { /* a brain that vanished is simply skipped */ }
  }
}

// Session close-out: consolidate memory, promote skills, forget kindly, rest
// brains, then make one final save and remember the summary for next time.
export async function closeSession({ quiet = true } = {}) {
  if (session.closed) return sessionSummary;
  session.closed = true;
  if (session.timer) { clearInterval(session.timer); session.timer = null; }

  const { forgotten } = consolidateMemoryKindly();
  sessionSummary.forgotten = forgotten;
  promoteSessionSkills();
  restSessionBrains();
  autosave({ quiet: true });
  writeJson(lastSessionFile(), { ...sessionSummary, savedAt: now() });

  if (!quiet) console.log(sessionSummaryText(sessionSummary));
  return sessionSummary;
}
