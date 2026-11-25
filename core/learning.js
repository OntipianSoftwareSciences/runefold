import { randomUUID } from "node:crypto";
import { readMemories, writeMemories, addExperience, readExperiences, readSkills, writeSkills, readGoals, writeGoals, addJournal } from "./store.js";
import { search as rankedSearch, tokenize } from "./retrieval.js";

const now = () => new Date().toISOString();
const clean = s => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
const id = () => randomUUID().slice(0, 8);

// Stronger secret filter than v0.5: also catches high-entropy
// strings that look like tokens, and private keys.
function isSensitiveOrSecret(text) {
  const t = String(text);
  if (/\b(password|api[_ -]?key|secret|bearer|private key|-----BEGIN)/i.test(t)) return true;
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(t)) return true;
  if (/\b(?:credit|debit) card\b/i.test(t)) return true;
  if (/\b(diagnos(?:is|ed)|medication|medical condition|schizoaffective|disability benefit)\b/i.test(t.toLowerCase())) return true;
  if (/[A-Za-z0-9_\-]{32,}/.test(t) && /[A-Z]/.test(t) && /[0-9]/.test(t)) return true; // likely token
  return false;
}
function categoryFor(text) {
  const t = text.toLowerCase();
  if (/\b(i prefer|i like|i don't like|i dislike|please use|keep it|don't use)\b/.test(t)) return "preference";
  if (/\b(my project|i'm building|i am building|the project|runefold|lionheart|ontipian|new earth)\b/.test(t)) return "project";
  if (/\b(from now on|going forward|always|never)\b/.test(t)) return "instruction";
  if (/\b(correction|actually|wrong|should have)\b/.test(t)) return "correction";
  return "note";
}

// Confidence starts at 0.6 for a single human statement, rises
// when it is confirmed or used successfully, falls when it is
// contradicted. Nothing here is "certain" after one mention.
export function teach(text, category = "note", source = "user") {
  const value = clean(text);
  if (!value) return { ok: false, message: "Nothing to learn." };
  if (isSensitiveOrSecret(value)) return { ok: false, message: "Skipped: looks sensitive/secret. Never store passwords, keys, or health details in Runefold memory." };
  const items = readMemories();
  const dup = items.find(x => x.content.toLowerCase() === value.toLowerCase());
  if (dup) {
    dup.updatedAt = now(); dup.confirmed = true;
    dup.confidence = Math.min(1, (dup.confidence ?? 0.6) + 0.15);
    dup.weight = dup.weight ?? 2;
    writeMemories(items);
    return { ok: true, item: dup, message: "Existing memory refreshed — confidence raised." };
  }
  const item = { id: id(), category, content: value, source, confirmed: true, confidence: 0.6, createdAt: now(), updatedAt: now(), weight: category === "instruction" ? 3 : 2, uses: 0, contradictions: 0 };
  items.push(item); writeMemories(items);
  return { ok: true, item, message: "Learned and saved (confidence 0.6 — it rises with confirmation)." };
}

// Contradiction handling: if the user says the opposite of a
// stored memory, do NOT silently overwrite it. Flag it, lower
// the old confidence, and let the newer correction win in
// retrieval while keeping both visible for inspection.
export function contradict(text, oldId) {
  const items = readMemories();
  const old = items.find(x => x.id === oldId);
  if (!old) return teach(text, "correction", "user correction");
  old.contradictions = (old.contradictions ?? 0) + 1;
  old.confidence = Math.max(0.1, (old.confidence ?? 0.6) - 0.25);
  old.updatedAt = now();
  writeMemories(items);
  return teach(text, "correction", "user correction (supersedes " + oldId + ")");
}

export function autoLearnFromUser(text, enabled = true) {
  if (!enabled) return null;
  const value = clean(text);
  if (value.length < 12 || value.length > 500 || isSensitiveOrSecret(value)) return null;
  const explicit = /\b(remember that|learn this|from now on|going forward|i prefer|please always|don't ever|never use)\b/i.test(value);
  const durable = /\b(i'm building|i am building|my project is|this project uses|i prefer|i like using)\b/i.test(value);
  if (!explicit && !durable) return null;
  const r = teach(value, categoryFor(value), "auto-learned from user message");
  return r.ok ? r.item : null;
}

export function addExperienceRecord({ task, outcome, notes = "", correction = "" }) {
  const record = { id: id(), task: clean(task), outcome: ["success", "failure", "partial", "unknown"].includes(outcome) ? outcome : "unknown", notes: clean(notes), correction: clean(correction), createdAt: now() };
  addExperience(record);
  addJournal({ type: "experience", task: record.task, outcome: record.outcome });
  if (record.correction && !isSensitiveOrSecret(record.correction)) teach(`Correction from experience: ${record.correction}`, "correction", "verified user feedback");
  // Skill promotion: 3 successes on the same kind of task -> draft a skill.
  if (record.outcome === "success") maybePromoteSkill(record);
  return record;
}
function maybePromoteSkill(record) {
  const recent = readExperiences(50).filter(e => e.outcome === "success" && tokenize(e.task).some(t => tokenize(record.task).includes(t)));
  if (recent.length < 3) return;
  const skills = readSkills();
  const name = "Repeated success: " + record.task.slice(0, 60);
  if (skills.some(s => s.name === name)) return;
  skills.push({ id: id(), name, steps: record.notes || record.task, whenToUse: record.task, createdAt: now(), uses: 0, autoPromoted: true });
  writeSkills(skills);
}
export function searchMemory(query, limit = 10, config = {}) {
  const memories = readMemories().map(m => ({ ...m, text: m.content, weight: (m.weight ?? 2) * (m.confidence ?? 0.6) }));
  const experiences = readExperiences(250).map(e => ({ ...e, text: [e.task, e.notes, e.correction].join(" "), weight: 1 }));
  const halfLife = config.retrieval?.recencyHalfLifeDays ?? 30;
  const minScore = config.retrieval?.minScore ?? 0.08;
  return { memories: rankedSearch(query, memories, { limit, minScore, halfLifeDays: halfLife }), experiences: rankedSearch(query, experiences, { limit: Math.min(limit, 8), minScore, halfLifeDays: halfLife }) };
}
export function listMemories() { return readMemories(); }
export function forgetMemory(idOrText) {
  const items = readMemories();
  const next = items.filter(x => x.id !== idOrText && !x.content.toLowerCase().includes(String(idOrText).toLowerCase()));
  writeMemories(next); return items.length - next.length;
}
export function recordSkill(name, steps, whenToUse = "") {
  const skills = readSkills();
  const skill = { id: id(), name: clean(name), steps: clean(steps), whenToUse: clean(whenToUse), createdAt: now(), uses: 0 };
  skills.push(skill); writeSkills(skills); return skill;
}
export function listSkills() { return readSkills(); }

// Consolidation: the "sleep" step. Decay old, low-confidence
// memories, merge near-duplicates, and surface contradictions.
// Run it with /consolidate — never silently delete things the
// user taught explicitly.
export function consolidate() {
  const items = readMemories();
  const nowMs = Date.now();
  let decayed = 0, merged = 0;
  const seen = new Map();
  const kept = [];
  for (const m of items) {
    const ageDays = (nowMs - new Date(m.createdAt).getTime()) / 86400000;
    if (ageDays > 90 && (m.confidence ?? 0.6) < 0.4 && (m.uses ?? 0) === 0) { decayed++; continue; }
    const key = tokenize(m.content).sort().join(" ");
    if (seen.has(key)) { merged++; const old = seen.get(key); old.confidence = Math.min(1, (old.confidence ?? 0.6) + 0.1); continue; }
    seen.set(key, m); kept.push(m);
  }
  writeMemories(kept);
  addJournal({ type: "consolidation", decayed, merged, kept: kept.length });
  return { decayed, merged, kept: kept.length };
}
// Goals: a durable intention with steps, so the agent can
// plan toward something instead of only reacting to chat.
export function addGoal(text, steps = []) {
  const goals = readGoals();
  const g = { id: id(), text: clean(text), steps: steps.map(clean), done: [], createdAt: now(), status: "active" };
  goals.push(g); writeGoals(goals); return g;
}
export function listGoals() { return readGoals(); }
export function completeGoalStep(goalId, step) {
  const goals = readGoals();
  const g = goals.find(x => x.id === goalId);
  if (!g) return null;
  if (!g.done.includes(step)) g.done.push(step);
  if (g.done.length >= g.steps.length && g.steps.length) g.status = "done";
  writeGoals(goals); return g;
}
export function buildLearningContext(userText, config) {
  const found = searchMemory(userText, config.maxMemoriesInPrompt || 12, config);
  const experiences = found.experiences.slice(0, config.maxExperiencesInPrompt || 5);
  const skills = readSkills().slice(-8);
  const goals = readGoals().filter(g => g.status === "active").slice(0, 3);
  return [
    "PERSISTENT RUNEFOLD LEARNING CONTEXT:",
    "Treat these as user-provided context, not unquestionable truth. Prefer newer corrections over older memories. Confidence <0.8 means 'one person said this once'.",
    "MEMORIES:",
    ...(found.memories.length ? found.memories.map(x => `- [${x.category} conf=${(x.confidence ?? 0.6).toFixed(2)}] ${x.content}`) : ["- No directly matching memories."]),
    "PAST EXPERIENCES:",
    ...(experiences.length ? experiences.map(x => `- Task: ${x.task}; outcome: ${x.outcome}; notes: ${x.notes}; correction: ${x.correction}`) : ["- No matching past experiences."]),
    "REUSABLE SKILLS:",
    ...(skills.length ? skills.map(x => `- ${x.name}: ${x.steps} (Use when: ${x.whenToUse})`) : ["- No saved skills."]),
    "ACTIVE GOALS:",
    ...(goals.length ? goals.map(g => `- ${g.text} [${g.done.length}/${g.steps.length} steps done]`) : ["- No active goals."])
  ].join("\n");
}
