#!/usr/bin/env node
// Tidy — a mini-agent that keeps a folder neat and writes
// descriptions for each folder. Safe by design:
//  - Dry-run by default: it only REPORTS what it would do.
//  - It never deletes anything. Duplicates / strays go to
//    _tidy-backup/<date>/, so you can undo it by moving them back.
//  - It only WRITES one thing per folder: a README.md with a
//    plain-English description of what's in there.
// Usage (PowerShell, on your PC):
//   node tidy-agent.js "C:\Users\Scarletta\Desktop\mother\newearth"
//   node tidy-agent.js "C:\path\to\folder" --write
//   node tidy-agent.js "C:\path\to\folder" --write --move
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.argv[2];
const WRITE = process.argv.includes("--write");
const MOVE = process.argv.includes("--move");
if (!root) { console.error('Usage: node tidy-agent.js "<folder>" [--write] [--move]'); process.exit(1); }
if (!fs.existsSync(root)) { console.error("Folder not found:", root); process.exit(1); }

const SKIP = new Set(["node_modules", ".git", "__pycache__", "Binaries", "Intermediate", "Saved", ".vs", "_tidy-backup"]);
const hash = f => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 12);

function describeFolder(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => !SKIP.has(e.name));
  const files = entries.filter(e => e.isFile());
  const folders = entries.filter(e => e.isDirectory());
  const byExt = {};
  for (const f of files) { const ext = path.extname(f.name).toLowerCase() || "(no extension)"; byExt[ext] = (byExt[ext] ?? 0) + 1; }
  const top = Object.entries(byExt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([e,n])=>`${n} ${e} file${n>1?"s":""}`).join(", ");
  const lines = [`# ${path.basename(dir) || dir}`, ""];
  if (!files.length && !folders.length) lines.push("This folder is empty.");
  else {
    lines.push(`This folder holds ${files.length} file${files.length===1?"":"s"}${folders.length ? ` and ${folders.length} subfolder${folders.length===1?"":"s"}` : ""}.`);
    if (top) lines.push(`Mostly: ${top}.`);
    if (folders.length) { lines.push("", "## Subfolders", ...folders.map(f => `- **${f.name}/** — ${describeOneLine(path.join(dir, f.name))}`)); }
    if (files.length) { lines.push("", "## Files", ...files.slice(0, 20).map(f => `- \`${f.name}\``)); if (files.length > 20) lines.push(`- …and ${files.length-20} more`); }
  }
  lines.push("", "_Description written by Tidy — edit me if I'm wrong!_");
  return lines.join("\n") + "\n";
}
function describeOneLine(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => !SKIP.has(e.name));
    const files = entries.filter(e => e.isFile());
    if (!files.length && !entries.length) return "empty folder";
    const exts = [...new Set(files.map(f => path.extname(f.name).toLowerCase()).filter(Boolean))].slice(0,3).join(", ");
    return exts ? `${files.length} file(s), mostly ${exts}` : `${files.length} file(s)`;
  } catch { return "could not read"; }
}

const report = { duplicates: [], emptyFolders: [], strayDuplicates: [], readmes: [] };
function walk(dir, depth = 0) {
  if (depth > 6) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const seen = new Map();
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const inner = fs.readdirSync(full).filter(x => !SKIP.has(x));
      if (!inner.length) report.emptyFolders.push(full);
      walk(full, depth + 1);
    } else if (e.isFile()) {
      // __1 / __2 / (1) copies, like the PuppyGirl folder had
      if (/(__\d+| \(\d+\)| - Copy)/.test(e.name)) report.strayDuplicates.push(full);
      try {
        const h = hash(full);
        if (seen.has(h)) report.duplicates.push([seen.get(h), full]);
        else seen.set(h, full);
      } catch {}
    }
  }
  // Write a README for this folder (only with --write)
  const readme = path.join(dir, "README.md");
  if (WRITE && !fs.existsSync(readme)) {
    fs.writeFileSync(readme, describeFolder(dir));
    report.readmes.push(readme);
  } else if (WRITE && fs.existsSync(readme)) {
    // Don't overwrite a README you wrote by hand — leave a note instead
    report.readmes.push(readme + " (already exists, left alone)");
  }
}
walk(path.resolve(root));

console.log(`\n🧹 Tidy report for: ${root}`);
console.log(`Mode: ${WRITE ? "WRITE (writes READMEs)" : "DRY-RUN (nothing changed)"}${MOVE ? " + MOVE duplicates to _tidy-backup" : ""}\n`);
console.log(`Duplicate files (same content): ${report.duplicates.length}`);
for (const [a,b] of report.duplicates) console.log(`  - ${a}\n    = ${b}`);
console.log(`\nFiles that look like copies (__1, __2, (1), - Copy): ${report.strayDuplicates.length}`);
for (const f of report.strayDuplicates) console.log(`  - ${f}`);
console.log(`\nEmpty folders: ${report.emptyFolders.length}`);
for (const f of report.emptyFolders) console.log(`  - ${f}`);
console.log(`\nREADMEs: ${report.readmes.length}`);
for (const f of report.readmes) console.log(`  - ${f}`);

if (MOVE && (report.duplicates.length || report.strayDuplicates.length)) {
  const backup = path.join(root, "_tidy-backup", new Date().toISOString().slice(0,10));
  fs.mkdirSync(backup, { recursive: true });
  const moveOne = f => { const dest = path.join(backup, path.basename(f)); fs.renameSync(f, dest); console.log(`  moved → ${dest}`); };
  console.log(`\nMoving duplicates to ${backup}:`);
  for (const [,b] of report.duplicates) moveOne(b);
  for (const f of report.strayDuplicates) { try { moveOne(f); } catch {} }
  console.log("Undo: move them back from _tidy-backup if you need them.");
}
if (!WRITE) console.log("\nNothing was changed. Run again with --write to write the folder READMEs, and --write --move to also move duplicates to _tidy-backup.");
console.log("\nDone! 🐶");
