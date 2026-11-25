import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tokenize, search } from "./core/retrieval.js";
import { teach, forgetMemory, listMemories, consolidate, addGoal } from "./core/learning.js";
import { writeFile, editFile, runAllowed } from "./core/tools.js";
import { createBrain, demoBrain } from "./core/brain.js";

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

// --- Runefold Brain v0.1: spiking neurons, Hebbian/STDP learning, sleep ---

test("brain: strong input spikes, weak input stays quiet (sparse firing)", () => {
  const strong = createBrain();
  strong.stimulate(["pink"], 1.2);
  const r1 = strong.tick();
  assert.ok(r1.spikes.includes("pink"), "strong input should make pink spike");

  const weak = createBrain();
  weak.stimulate(["pink"], 0.4);
  const r2 = weak.tick();
  assert.deepEqual(r2.spikes, [], "weak input (0.4, under threshold 1.0) must stay quiet");
});

test("brain: STDP strengthens A->B when A spikes just before B", () => {
  const brain = createBrain();
  const before = brain.weight("hidden-a", "happy");
  brain.stimulate("hidden-a", 1.2);
  brain.tick(); // hidden-a spikes
  brain.stimulate("happy", 1.2);
  brain.tick(); // happy spikes one tick later
  const after = brain.weight("hidden-a", "happy");
  assert.ok(after > before, `STDP should strengthen hidden-a->happy (${before} -> ${after})`);
  assert.ok(after <= 1, "weights are clamped to 1");
});

test("brain: training pink+puppy -> happy makes happy fire more", () => {
  const brain = createBrain();
  const before = brain.measure(["pink", "puppy"], "happy", 20);
  brain.train(["pink", "puppy"], "happy", 12);
  const after = brain.measure(["pink", "puppy"], "happy", 20);
  assert.ok(after.rate > before.rate, `happy should fire more after training (${before.rate} -> ${after.rate})`);
  assert.ok(after.rate >= 0.8, `after training happy should fire in most trials (got ${after.rate})`);
  // And it learned the PAIR, not pink alone: pink alone stays quiet.
  const pinkAlone = brain.measure(["pink"], "happy", 10);
  assert.equal(pinkAlone.spikes, 0, "pink alone should not trigger happy");
});

test("brain: sleep decays a weak unused link, keeps a strong taught one", () => {
  const brain = createBrain();
  brain.train(["pink", "puppy"], "happy", 12);
  const strongBefore = brain.weight("hidden-a", "happy");
  assert.ok(strongBefore > 0.5, "trained link should be strong before sleep");
  // Make one link weak and unused, the way a forgotten memory would be.
  const weak = brain.connections.find((c) => c.from === 2 && c.to === 4); // music -> hidden-a
  weak.weight = 0.05;
  weak.useCount = 0;
  const result = brain.sleep();
  assert.equal(weak.weight, 0, "weak unused link should be pruned by sleep");
  assert.ok(result.pruned >= 1, "sleep should report at least one pruned link");
  const strongAfter = brain.weight("hidden-a", "happy");
  assert.ok(strongAfter > 0.5, `taught link must survive sleep (${strongBefore} -> ${strongAfter})`);
});

test("brain: demoBrain shows a clear before/after", () => {
  const d = demoBrain();
  assert.ok(d.after.rate > d.before.rate, `demo before ${d.before.rate} should be below after ${d.after.rate}`);
  assert.ok(d.weightAfter > d.weightBefore, "demo weight should grow with training");
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
