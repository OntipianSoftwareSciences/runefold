import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// One home for all persistent state. Everything is plain JSON/JSONL
// so Dylan can read, back up, or delete it by hand at any time.
const DATA_DIR = path.join(os.homedir(), ".runefold");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");
const EXPERIENCE_FILE = path.join(DATA_DIR, "experiences.jsonl");
const SKILLS_FILE = path.join(DATA_DIR, "skills.json");
const GOALS_FILE = path.join(DATA_DIR, "goals.json");
const JOURNAL_FILE = path.join(DATA_DIR, "journal.jsonl");

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, JSON.stringify({ items: [] }, null, 2));
  if (!fs.existsSync(EXPERIENCE_FILE)) fs.writeFileSync(EXPERIENCE_FILE, "");
  if (!fs.existsSync(SKILLS_FILE)) fs.writeFileSync(SKILLS_FILE, JSON.stringify({ items: [] }, null, 2));
  if (!fs.existsSync(GOALS_FILE)) fs.writeFileSync(GOALS_FILE, JSON.stringify({ items: [] }, null, 2));
  if (!fs.existsSync(JOURNAL_FILE)) fs.writeFileSync(JOURNAL_FILE, "");
}
export function dataLocation() { ensure(); return DATA_DIR; }
export function readJson(file, fallback) {
  ensure();
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
// Atomic write + one backup copy, so a crash mid-save cannot
// wipe a whole memory file. This is the single most important
// reliability upgrade over v0.5.
export function writeJson(file, value) {
  ensure();
  const tmp = file + ".tmp";
  if (fs.existsSync(file)) fs.copyFileSync(file, file + ".bak");
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}
export function readMemories() { return readJson(MEMORY_FILE, { items: [] }).items; }
export function writeMemories(items) { writeJson(MEMORY_FILE, { items }); }
export function readSkills() { return readJson(SKILLS_FILE, { items: [] }).items; }
export function writeSkills(items) { writeJson(SKILLS_FILE, { items }); }
export function readGoals() { return readJson(GOALS_FILE, { items: [] }).items; }
export function writeGoals(items) { writeJson(GOALS_FILE, { items }); }
export function addExperience(record) {
  ensure();
  fs.appendFileSync(EXPERIENCE_FILE, JSON.stringify(record) + "\n", "utf8");
}
export function readExperiences(limit = 100) {
  ensure();
  const lines = fs.readFileSync(EXPERIENCE_FILE, "utf8").split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}
export function addJournal(entry) {
  ensure();
  fs.appendFileSync(JOURNAL_FILE, JSON.stringify({ ...entry, at: new Date().toISOString() }) + "\n", "utf8");
}
export function readJournal(limit = 50) {
  ensure();
  const lines = fs.readFileSync(JOURNAL_FILE, "utf8").split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}
export function paths() { ensure(); return { DATA_DIR, MEMORY_FILE, EXPERIENCE_FILE, SKILLS_FILE, GOALS_FILE, JOURNAL_FILE }; }
