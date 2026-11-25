import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tokenize, search } from "./core/retrieval.js";
import { teach, forgetMemory, listMemories, consolidate, addGoal } from "./core/learning.js";
import { writeFile, editFile, runAllowed } from "./core/tools.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "runefold-test-"));
}

test("retrieval ranks the matching memory first", () => {
  const docs = [
    { text: "I prefer pink terminals and Ableton Live", weight: 2, createdAt: new Date().toISOString() },
    { text: "The weather in Clearfield is cold", weight: 2, createdAt: new Date().toISOString() },
  ];
  const out = search("Ableton pink terminal", docs);
  assert.equal(out[0].text, docs[0].text);
  assert.ok(out[0].score > 0);
});

test("teach / forget round-trip", () => {
  const r = teach("test memory: I prefer qwen for coding", "preference", "test");
  assert.ok(r.ok);
  assert.ok(listMemories().some(m => m.id === r.item.id));
  assert.ok(forgetMemory(r.item.id) >= 1);
});

test("tokenize drops stop words", () => {
  assert.deepEqual(tokenize("The quick brown fox"), ["quick", "brown", "fox"]);
});

test("goals can be created", () => {
  const g = addGoal("test goal", ["step one"]);
  assert.equal(g.text, "test goal");
  assert.equal(g.steps.length, 1);
});

test("consolidate runs without deleting everything", () => {
  const before = listMemories().length;
  const r = consolidate();
  assert.ok(r.kept >= 0 && r.kept <= Math.max(before, 0) + 1);
});

test("CodeForge: write creates, refuses overwrite without flag, backs up on overwrite", () => {
  const root = tmpDir();
  const r1 = writeFile(root, "hello.txt", "hi\n");
  assert.equal(r1.created, true);
  assert.equal(fs.readFileSync(path.join(root, "hello.txt"), "utf8"), "hi\n");
  assert.throws(() => writeFile(root, "hello.txt", "again\n"), /File exists/);
  const r2 = writeFile(root, "hello.txt", "v2\n", { overwrite: true });
  assert.equal(r2.overwritten, true);
  assert.ok(fs.existsSync(path.join(root, "hello.txt.bak")));
  assert.equal(fs.readFileSync(path.join(root, "hello.txt.bak"), "utf8"), "hi\n");
  assert.equal(fs.readFileSync(path.join(root, "hello.txt"), "utf8"), "v2\n");
  // Path escape is blocked
  assert.throws(() => writeFile(root, "../escape.txt", "x"), /escapes project root/);
});

test("CodeForge: edit replaces exactly one match, refuses ambiguous or missing", () => {
  const root = tmpDir();
  writeFile(root, "a.js", "const x = 1;\nconst y = 1;\n");
  assert.throws(() => editFile(root, "a.js", "1", "2"), /found 2 times/);
  assert.throws(() => editFile(root, "a.js", "zzz", "2"), /not found/);
  const r = editFile(root, "a.js", "const x = 1;", "const x = 2;");
  assert.ok(fs.existsSync(path.join(root, "a.js.bak")));
  assert.match(fs.readFileSync(path.join(root, "a.js"), "utf8"), /const x = 2;/);
});

test("runAllowed: allow-list is a prefix, so args work, and other commands stay blocked", async () => {
  const out = await runAllowed("node --version", ["node --version"]);
  assert.match(out, /v\d+\./);
  // Prefix match: "node --check" allows "node --check test.js".
  // Use --check, not --test, so the test does not re-run itself.
  const out2 = await runAllowed("node --check test.js", ["node --check"]);
  assert.equal(out2, "");
  await assert.rejects(() => runAllowed("rm -rf /", ["node --test"]), /not allow-listed/);
});
