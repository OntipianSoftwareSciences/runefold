// Safe, read-only-by-default tools. This is the boundary that
// makes an agent trustworthy: it can LOOK, it cannot silently
// change things, and anything that writes or runs code needs
// an explicit allow-list entry in config.json.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

function safeJoin(root, rel) {
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root))) throw new Error("Path escapes project root.");
  return full;
}
// CodeForge v0.1 — safe writes only.
// Every write that replaces an existing file first copies it to
// <file>.bak, so a bad edit is undoable by hand. No delete,
// no write outside the project root, no file over 200k chars.
function backupFile(full) {
  if (!fs.existsSync(full)) return null;
  const bak = full + ".bak";
  fs.copyFileSync(full, bak);
  return bak;
}
export function writeFile(root, rel, content, { overwrite = false } = {}) {
  if (typeof content !== "string") throw new Error("Content must be text.");
  if (content.length > 200000) throw new Error("Content too large to write safely (200k char limit).");
  const full = safeJoin(root, rel);
  const existed = fs.existsSync(full);
  if (existed && !overwrite) throw new Error(`File exists: ${rel} — use overwrite, or /edit to change part of it.`);
  const backup = existed ? backupFile(full) : null;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return { path: rel, created: !existed, overwritten: existed, backup, bytes: Buffer.byteLength(content, "utf8") };
}
export function editFile(root, rel, oldText, newText) {
  if (!oldText) throw new Error("Old text must not be empty.");
  const full = safeJoin(root, rel);
  const current = fs.readFileSync(full, "utf8");
  const occurrences = current.split(oldText).length - 1;
  if (occurrences === 0) throw new Error(`Old text not found in ${rel}.`);
  if (occurrences > 1) throw new Error(`Old text found ${occurrences} times in ${rel} — be more specific so only one match remains.`);
  const backup = backupFile(full);
  fs.writeFileSync(full, current.replace(oldText, newText ?? ""), "utf8");
  return { path: rel, backup, replaced: oldText.slice(0, 80), with: (newText ?? "").slice(0, 80) };
}
export function listFiles(root, rel = ".") {
  const dir = safeJoin(root, rel);
  return fs.readdirSync(dir, { withFileTypes: true }).map(e => (e.isDirectory() ? e.name + "/" : e.name)).slice(0, 200);
}
export function readFile(root, rel, maxChars = 8000) {
  const full = safeJoin(root, rel);
  if (fs.statSync(full).size > 200000) throw new Error("File too large to read safely.");
  return fs.readFileSync(full, "utf8").slice(0, maxChars);
}
export function searchFiles(root, needle, max = 20) {
  const hits = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (hits.length >= max) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!["node_modules", ".git", "Binaries", "Intermediate"].includes(e.name)) walk(p); }
      else if (/\.(js|json|md|txt|h|cpp)$/.test(e.name)) {
        try { const t = fs.readFileSync(p, "utf8"); if (t.includes(needle)) hits.push(path.relative(root, p)); } catch {}
      }
    }
  };
  walk(path.resolve(root));
  return hits;
}
// Only commands explicitly allow-listed in config, run with
// execFile (no shell), with a timeout. Never `rm`, never shell.
// Fix (0.6.1): allow-list entries are prefixes, not exact strings.
// "node --test" in the list now allows "node --test test.js" —
// before, that exact string was required, so any real check
// with a filename was blocked. The binary is still the first
// word only, and arguments are passed to execFile, never a shell.
function splitArgs(cmd) {
  const out = [];
  let cur = "", quote = null;
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ""; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
export function runAllowed(cmd, allowed) {
  return new Promise((resolve, reject) => {
    const ok = allowed.some(a => cmd === a || cmd.startsWith(a + " "));
    if (!ok) return reject(new Error("Command not allow-listed: " + cmd));
    const [bin, ...args] = splitArgs(cmd);
    if (!bin) return reject(new Error("Empty command."));
    execFile(bin, args, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.slice(0, 4000));
    });
  });
}
