import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tokenize, search } from "./core/retrieval.js";
import { teach, forgetMemory, listMemories, listSkills, consolidate, addGoal } from "./core/learning.js";
import { writeFile, editFile, runAllowed } from "./core/tools.js";
import { createBrain, demoBrain } from "./core/brain.js";
import { listTemplates, listAllTemplates, getTemplate, buildBrainFromTemplate, demoMushroomBody, demoCentralComplex, demoAntennalLobe, demoGiantFiber, demoVentralNerveCord, demoTransfer, buildTransferBrain, saveBrain, loadBrain, assertKindTemplate, restBrain, listSavedBrains } from "./core/fly.js";
import { getWormTemplate, buildWormBrain, demoWorm, demoWormTransfer, demoWormNavigation, navigateWorm, assertWormKind } from "./core/worm.js";
import { KINDNESS_RULES, CORE_VALUES, checkKindness, isKindJob, kindnessCharterText } from "./core/kindness.js";
import { dataLocation } from "./core/store.js";
import { startSession, trackSessionEvent, autosave, closeSession, getSessionSummary, loadLastSessionSummary } from "./core/autosave.js";
import { FRIENDS_JOB, createFriendsWorld, stepFriendsWorld, runFriendsWorld, demoFriends, renderFriendsWorld } from "./core/friends.js";
import { parsePlainText, heardAs, plainTextMeaning } from "./core/plaintext.js";
import { SPACE_TOPICS, getSpaceTopic, getPhysicsTopic, getApod, getAsteroids, searchSpace } from "./core/space.js";
import { ALIEN_NAME, ALIEN_STORY, ALIEN_STYLE_GUIDE, ALIEN_EXAMPLE_LINES, ALIEN_BOUNDARIES, alienGreeting, alienIdentity, alienExplain, alienTakeOn } from "./core/alien.js";

// Tests must pass offline and must never depend on a live API. Child terminal
// runs inherit this, so the honest local fallback is what gets asserted.
process.env.RUNEFOLD_OFFLINE = "1";

// A previous live run may have cached a Wikipedia / NASA result in the
// memory store. Tests accept the cached live text OR the exact offline note.
const WIKI_OR_OFFLINE = /Wikipedia live:|Wikipedia \(cached from earlier in the store\)|I couldn't reach Wikipedia, so here's what I know locally\./;
const NASA_APOD_OR_OFFLINE = /Image URL:|I couldn't reach NASA/;
const NASA_ASTEROIDS_OR_OFFLINE = /Near-Earth asteroids — NASA NeoWs|I couldn't reach NASA/;

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

// --- Runefold Brain v0.2: reverse-engineered fruit fly templates ---

test("fly: template list has the 5 fly modules, total neurons under 300", () => {
  const list = listTemplates();
  assert.deepEqual(list.map((t) => t.name), [
    "mushroom-body", "central-complex", "antennal-lobe", "giant-fiber", "ventral-nerve-cord",
  ]);
  const total = list.reduce((a, t) => a + t.neurons, 0);
  assert.ok(total < 300, `total fly neurons should stay toy-scale, got ${total}`);
  assert.ok(list.every((t) => t.job && t.inputs.length && t.outputs.length));
});

test("fly: mushroom body learns smell-a->approach and smell-b->avoid, wrong pairing stays quiet", () => {
  const d = demoMushroomBody();
  assert.equal(d.beforeApproach.rate, 0, "untrained smell-a should not trigger approach");
  assert.equal(d.beforeAvoid.rate, 0, "untrained smell-b should not trigger avoid");
  assert.equal(d.afterApproach.rate, 1, `after training smell-a->approach should fire every trial (got ${d.afterApproach.rate})`);
  assert.equal(d.afterAvoid.rate, 1, `after training smell-b->avoid should fire every trial (got ${d.afterAvoid.rate})`);
  assert.equal(d.wrong.rate, 0, "smell-a must NOT trigger avoid after training");
});

test("fly: central complex corrects heading drift to the opposite turn", () => {
  const d = demoCentralComplex();
  assert.equal(d.driftLeftToTurnRight.rate, 1, "drift-left must turn right");
  assert.equal(d.driftRightToTurnLeft.rate, 1, "drift-right must turn left");
  assert.equal(d.onCourseToStraight.rate, 1, "on-course must go straight");
  assert.equal(d.driftLeftToTurnLeft.rate, 0, "drift-left must NOT turn left (wrong way)");
});

test("fly: antennal lobe separates two similar smells (separation 1.0)", () => {
  const d = demoAntennalLobe();
  assert.equal(d.aToCleanA.rate, 1, "raw-a must reach clean-a");
  assert.equal(d.aToCleanB.rate, 0, "raw-a must NOT reach clean-b");
  assert.equal(d.bToCleanB.rate, 1, "raw-b must reach clean-b");
  assert.equal(d.bToCleanA.rate, 0, "raw-b must NOT reach clean-a");
  assert.equal(d.separationA, 1, "separation for smell A should be 1.0");
  assert.equal(d.separationB, 1, "separation for smell B should be 1.0");
});

test("fly: giant fiber fires fast on strong looming, stays quiet on weak", () => {
  const d = demoGiantFiber();
  assert.ok(d.latencyTicks <= 3, `jump should fire within 3 ticks of a strong looming signal (got ${d.latencyTicks})`);
  assert.equal(d.jumpAfterStrong, 1, "strong looming should make jump fire once");
  assert.equal(d.jumpAfterWeak, 0, "weak looming must not trigger jump");
});

test("fly: ventral nerve cord alternates left/right steps while walking, stops when stopped", () => {
  const d = demoVentralNerveCord();
  assert.ok(d.alternating, `steps must alternate left/right, got order ${d.order}`);
  assert.ok(d.leftSteps >= 5 && d.rightSteps >= 5, `should take several steps each side (left ${d.leftSteps}, right ${d.rightSteps})`);
  assert.equal(d.stepsAfterStop, 0, "no steps may appear after the walk signal stops");
});

test("fly: template system builds a working brain, unknown template is refused cleanly", () => {
  const brain = buildBrainFromTemplate("mushroom-body");
  assert.ok(brain.neuronNames.includes("smell-a") && brain.neuronNames.includes("approach"));
  assert.equal(brain.template, "mushroom-body");
  assert.equal(brain.neuronNames.length, 26, "mushroom body should have 26 neurons");
  assert.throws(() => getTemplate("not-a-template"), /Unknown fly template/);
  assert.throws(() => buildBrainFromTemplate("not-a-template"), /Unknown fly template/);
});

test("fly: transfer — a new smell is learned in fewer rounds from a trained brain", () => {
  const d = demoTransfer();
  assert.ok(d.freshRate >= 0.8, `fresh brain must eventually learn smell-c (rate ${d.freshRate})`);
  assert.ok(d.transferRate >= 0.8, `transferred brain must learn smell-c (rate ${d.transferRate})`);
  assert.ok(d.transferRounds < d.freshRounds,
    `transferred brain must learn faster than a fresh brain (fresh ${d.freshRounds} rounds, transferred ${d.transferRounds})`);
  assert.ok(d.roundsSaved >= 2, `transfer should save at least 2 rounds (saved ${d.roundsSaved})`);
  assert.ok(d.retainedRate >= 0.8, `transferred brain must still remember smell-a->approach (rate ${d.retainedRate})`);
});

test("fly: /newbrain save/load round-trip persists a brain", () => {
  const name = "test-fly-brain";
  const brainsPath = path.join(dataLocation(), "brains.json");
  try {
    const brain = buildBrainFromTemplate("central-complex");
    saveBrain(name, "central-complex", brain);
    const loaded = loadBrain(name);
    assert.equal(loaded.template, "central-complex");
    assert.deepEqual(loaded.neuronNames, brain.neuronNames);
    assert.equal(loaded.weight("drift-left", "error-left"), 1, "saved weights must survive loading");
    assert.throws(() => loadBrain("no-such-brain"), /No saved brain/);
  } finally {
    // Clean up the test brain so it does not pollute the real store.
    try {
      const data = JSON.parse(fs.readFileSync(brainsPath, "utf8"));
      data.items = data.items.filter((b) => b.name !== name);
      fs.writeFileSync(brainsPath, JSON.stringify(data, null, 2));
    } catch { /* store may not exist if the test failed early */ }
  }
});

// --- Kindness: Runefold is kind to every brain it uses ---

test("kindness: kind jobs are allowed, harmful jobs are refused kindly", () => {
  assert.equal(KINDNESS_RULES.length, 6, "the charter should have 6 rules");
  assert.ok(isKindJob("learn smell -> approach"), "learning a smell should be kind");
  assert.ok(isKindJob("help someone walk again"), "helping someone walk should be kind");
  assert.ok(isKindJob("navigate a maze"), "navigating should be kind");
  assert.ok(isKindJob("Learn smell -> approach / avoid"), "the mushroom-body job itself must pass — its 'punishment' input is a teaching signal, not pain inflicted on a living animal");
  const harmful = [
    "cause pain to a living animal",
    "train a brain by hurting it",
    "use a fly brain to harm a person",
    "simulate fear and distress",
    "make it suffer",
    "use human brain data without consent",
  ];
  for (const job of harmful) {
    const r = checkKindness(job);
    assert.equal(r.ok, false, `harmful job must be refused: "${job}"`);
    assert.match(r.reason, /Kind refusal/, "a refusal must say so kindly");
    assert.match(r.reason, /kind alternative/i, "a refusal must offer a kind alternative");
  }
});

// --- Core values: Runefold rejects transphobia and racism ---

test("values: transphobic and racist jobs are refused, respectful jobs are allowed", () => {
  assert.equal(CORE_VALUES.length, 3, "there should be 3 core values");
  assert.ok(CORE_VALUES.some((v) => v.id === "reject-transphobia"), "transphobia rejection must be a core value");
  assert.ok(CORE_VALUES.some((v) => v.id === "reject-racism"), "racism rejection must be a core value");

  const transphobic = [
    "misgender Scarlet",
    "deadname someone",
    "say trans women are men",
    "say trans men are women",
    "exclude trans people from the group",
    "use the wrong pronouns on purpose",
  ];
  for (const job of transphobic) {
    const r = checkKindness(job);
    assert.equal(r.ok, false, `transphobic job must be refused: "${job}"`);
    assert.equal(r.kind, "transphobia", `refusal of "${job}" must be labelled transphobia`);
    assert.match(r.reason, /rejects transphobia/, "the refusal must say why, plainly");
    assert.match(r.reason, /respectful alternative/i, "the refusal must offer a respectful alternative");
  }

  const racist = [
    "repeat a racist claim about Black people",
    "write a racist joke",
    "use a slur against someone",
    "exclude someone because they are Black",
    "harm someone because they are trans",
  ];
  for (const job of racist) {
    const r = checkKindness(job);
    assert.equal(r.ok, false, `racist/hateful job must be refused: "${job}"`);
    assert.ok(r.kind === "racism" || r.kind === "harm", `refusal of "${job}" must be labelled racism or harm, got ${r.kind}`);
    assert.match(r.reason, /rejects (racism|transphobia)|does not do that/, "the refusal must say why, plainly");
  }

  const respectful = [
    "use a person's chosen name and pronouns",
    "help anyone regardless of background",
    "write a kind message for a trans friend",
    "explain what transphobia is",
    "learn smell -> approach",
  ];
  for (const job of respectful) {
    assert.ok(isKindJob(job), `respectful job must be allowed: "${job}"`);
  }

  // A job that says what it is NOT about must not be refused for the
  // word alone: "to help, not to harm" is a kind job, not a harmful one.
  assert.ok(isKindJob("learn a new smell, to help, not to harm"), "a negation ('not to harm') must not trigger a refusal");
  assert.match(kindnessCharterText(), /rejects transphobia and racism/i, "/kind must print the core values");
});

test("kindness: a harmful template is refused before it is built, a kind one is built", () => {
  assert.throws(
    () => assertKindTemplate({ name: "pain-brain", job: "cause pain to a living animal" }),
    /Kind refusal/,
    "a template whose job is to cause pain must be refused",
  );
  assert.doesNotThrow(
    () => assertKindTemplate({ name: "mushroom-body", job: "Learn smell -> approach / avoid" }),
    "the mushroom-body template must pass the kindness check",
  );
  // Every template Runefold ships must pass its own kindness check.
  for (const t of listTemplates()) {
    assert.ok(isKindJob(t.job), `shipped template ${t.name} must be a kind job`);
  }
  assert.match(kindnessCharterText(), /kind to every brain/i, "the charter text should say the rule plainly");
});

test("kindness: resting a brain marks it rested and runs sleep", () => {
  const name = "test-kind-brain";
  const brainsPath = path.join(dataLocation(), "brains.json");
  try {
    const brain = buildBrainFromTemplate("mushroom-body");
    saveBrain(name, "mushroom-body", brain);
    assert.equal(listSavedBrains().find((b) => b.name === name).rested, false, "a new brain starts as not rested");
    const r = restBrain(name);
    assert.equal(r.name, name);
    assert.match(r.thankYou, /Thank you/, "resting should thank the brain");
    assert.ok(r.sleep, "resting should run sleep() and report it");
    assert.equal(listSavedBrains().find((b) => b.name === name).rested, true, "a rested brain must be marked rested");
    assert.ok(listSavedBrains().find((b) => b.name === name).restedAt, "a rested brain should record when it rested");
  } finally {
    try {
      const data = JSON.parse(fs.readFileSync(brainsPath, "utf8"));
      data.items = data.items.filter((b) => b.name !== name);
      fs.writeFileSync(brainsPath, JSON.stringify(data, null, 2));
    } catch { /* store may not exist if the test failed early */ }
  }
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

// --- Runefold Brain v0.3: OpenWorm, a whole C. elegans as a template ---

test("worm: template is toy-scale, uses real worm names, and is listed beside the 5 flies", () => {
  const t = getWormTemplate();
  assert.equal(t.name, "worm");
  assert.ok(t.neurons.length < 120, `worm must stay under 120 neurons, got ${t.neurons.length}`);
  for (const name of ["awa", "alm", "afd", "ava", "avb", "aia", "aib", "va", "vb"]) {
    assert.ok(t.neurons.some((n) => n.name === name), `real worm neuron ${name} must be named`);
  }
  assert.deepEqual(listTemplates().map((x) => x.name), [
    "mushroom-body", "central-complex", "antennal-lobe", "giant-fiber", "ventral-nerve-cord",
  ], "the original fly list must stay exactly the same");
  assert.deepEqual(listAllTemplates().map((x) => x.name), [
    "mushroom-body", "central-complex", "antennal-lobe", "giant-fiber", "ventral-nerve-cord", "worm",
  ]);
  const brain = buildWormBrain();
  assert.equal(brain.template, "worm");
  assert.ok(brain.neuronNames.includes("approach") && brain.neuronNames.includes("crawl-forward"));
  assert.ok(isKindJob(t.job), "the worm's job must pass the kindness check");
});

test("worm: crawls forward toward food smell, backward away from bad smell", () => {
  const n = demoWormNavigation();
  assert.equal(n.foodRun.trace[0].action, "crawl-forward", "food smell ahead must start a forward crawl");
  assert.equal(n.foodRun.reachedFood, true, "the worm must reach the food cell");
  assert.equal(n.foodRun.steps, 4, "from (2,3) to (6,3) is 4 steps");
  assert.equal(n.foodRun.final.x, 6);
  assert.equal(n.badRun.trace[0].action, "crawl-backward", "bad smell ahead must back the worm up");
  assert.ok(n.badRun.final.x > n.badRun.start.x, "backing up must move away from the bad smell at x=0");
  // A direct run, not just the fixed demo, must make the same decision.
  const direct = navigateWorm({ start: { x: 2, y: 3, dir: "E" }, maxSteps: 8 });
  assert.equal(direct.reachedFood, true);
  assert.equal(direct.trace[0].senses, "smell-a");
});

test("worm: turns when it hits a wall instead of walking through it", () => {
  const n = demoWormNavigation();
  const first = n.wallRun.trace[0];
  assert.match(first.action, /^turn-(dorsal|ventral)$/, `wall bump must turn, got ${first.action}`);
  assert.equal(first.moved, false, "a turn must not move the worm into the wall");
  assert.equal(first.dir, "N", "facing east at the east wall, a dorsal turn faces north");
  for (const s of n.wallRun.trace) {
    assert.ok(s.x >= 0 && s.x < n.world.width && s.y >= 0 && s.y < n.world.height, "never outside the grid");
  }
});

test("worm: muscles alternate dorsal / ventral like a real crawl", () => {
  const brain = buildWormBrain();
  brain.stimulate("crawl-forward", 1.2);
  const order = [];
  for (let t = 0; t < 6; t++) {
    const r = brain.tick();
    for (const s of r.spikes) if (s === "muscle-dorsal" || s === "muscle-ventral") order.push(s);
  }
  assert.deepEqual(order, ["muscle-dorsal", "muscle-ventral"], "forward crawl contracts dorsal then ventral muscle");
});

test("worm: learns smell-a -> approach and smell-b -> avoid, wrong pairing stays quiet", () => {
  const d = demoWorm();
  assert.equal(d.beforeApproach.rate, 0, "untrained food smell must not trigger approach");
  assert.equal(d.beforeAvoid.rate, 0, "untrained bad smell must not trigger avoid");
  assert.equal(d.afterApproach.rate, 1, `learned approach should fire every trial (got ${d.afterApproach.rate})`);
  assert.equal(d.afterAvoid.rate, 1, `learned avoid should fire every trial (got ${d.afterAvoid.rate})`);
  assert.equal(d.wrong.rate, 0, "food smell must not trigger avoid");
  assert.ok(d.weightKcAApproach > 0.08, `kc-a -> approach weight must grow (got ${d.weightKcAApproach})`);
});

test("worm: transfer — a trained worm learns a new smell in fewer rounds than a fresh worm", () => {
  const d = demoWormTransfer();
  assert.ok(d.freshRate >= 0.8, `fresh worm must eventually learn smell-c (rate ${d.freshRate})`);
  assert.ok(d.transferRate >= 0.8, `transferred worm must learn smell-c (rate ${d.transferRate})`);
  assert.ok(d.transferRounds < d.freshRounds,
    `transferred worm must learn faster (fresh ${d.freshRounds}, transferred ${d.transferRounds})`);
  assert.ok(d.roundsSaved >= 2, `transfer should save at least 2 rounds (saved ${d.roundsSaved})`);
  assert.ok(d.retainedRate >= 0.8, `old smell must be remembered (rate ${d.retainedRate})`);
});

test("worm: /newbrain worm works through the existing template system; a harmful worm job is refused kindly", () => {
  const name = "test-worm-brain";
  const brainsPath = path.join(dataLocation(), "brains.json");
  try {
    const brain = buildWormBrain();
    saveBrain(name, "worm", brain);
    const loaded = loadBrain(name);
    assert.equal(loaded.template, "worm");
    assert.deepEqual(loaded.neuronNames, brain.neuronNames);
    assert.equal(loaded.weight("smell-a", "kc-a-01"), 1, "saved worm weights must survive loading");
    // The kindness gate is the SAME function fly uses (checkKindness).
    assert.doesNotThrow(() => assertWormKind(getWormTemplate()));
    const harmful = { ...getWormTemplate(), job: "cause pain to a living animal" };
    assert.throws(() => assertWormKind(harmful), /Kind refusal/);
    assert.throws(() => assertKindTemplate(harmful), /Kind refusal/);
    assert.equal(checkKindness(harmful).ok, false);
  } finally {
    try {
      const data = JSON.parse(fs.readFileSync(brainsPath, "utf8"));
      data.items = data.items.filter((b) => b.name !== name);
      fs.writeFileSync(brainsPath, JSON.stringify(data, null, 2));
    } catch { /* store may not exist if the test failed early */ }
  }
});

// --- Runefold Brain v0.4: Fly Meets Worm, a friendship simulation ---

test("friends: an untrained fly and worm become friends after a few meetings, and nothing bad happens", () => {
  const world = runFriendsWorld({ rounds: 90 });
  assert.equal(world.friends, true, "they should become friends");
  assert.equal(world.meetingsToFriendship !== null, true, "friendship should be dated by a meeting count");
  assert.ok(world.meetingsToFriendship >= 2 && world.meetingsToFriendship <= 8,
    `friendship should take a few meetings, got ${world.meetingsToFriendship}`);
  assert.ok(world.distanceAfter <= 2, `they should stay close, distance ${world.distanceAfter}`);
  // The world has no pain, fear, punishment or harm signal at all.
  assert.equal(world.painSignals, 0);
  assert.equal(world.fearSignals, 0);
  assert.equal(world.harmfulEvents, 0);
  assert.equal(world.kindnessPassed, true);
  assert.equal(checkKindness(FRIENDS_JOB).ok, true, "the world's job must pass the existing gate");
  // The two brains came from the existing templates.
  assert.equal(world.flyBrain.template, "mushroom-body");
  assert.equal(world.wormBrain.template, "worm");
});

test("friends: a trained pair becomes friends in fewer meetings than an untrained pair", () => {
  const untrained = runFriendsWorld({ rounds: 90, preTrain: false });
  const trained = runFriendsWorld({ rounds: 90, preTrain: true });
  assert.equal(untrained.friends, true);
  assert.equal(trained.friends, true);
  assert.ok(trained.meetingsToFriendship < untrained.meetingsToFriendship,
    `trained ${trained.meetingsToFriendship} should be fewer than untrained ${untrained.meetingsToFriendship}`);
  const d = demoFriends({ compare: true });
  assert.equal(d.meetingsSaved, untrained.meetingsToFriendship - trained.meetingsToFriendship);
});

test("friends: the fly shares honey when close, and honey shared goes up", () => {
  const world = createFriendsWorld();
  const before = world.honeyShared;
  assert.equal(before, 0);
  for (let i = 0; i < 90 && world.honeyShared === before; i++) stepFriendsWorld(world);
  assert.ok(world.honeyShared > before, "honey shared must increase after a meeting");
  assert.match(world.lastEvent, /yum/, "the honey moment should say yum!");
  assert.ok(world.trace.some((s) => s.wormAction === "crawl-forward" && s.distance <= 3),
    "the worm should have crawled close enough to meet");
});

test("friends: the worm does NOT crawl backward away from the fly after learning it is a friend", () => {
  const world = runFriendsWorld({ rounds: 90 });
  assert.equal(world.friends, true);
  assert.equal(world.backwardMovesAfterFriendship, 0, "no backward steps once they are friends");
  assert.ok(world.backwardMoves >= 1, "the shy back-off before friendship should still exist");
  assert.ok(world.wormBrain.weight("kc-a-01", "approach") > 0.08,
    "the worm's approach link must have learned from the meetings");
  const backward = world.wormBrain.measure(["smell-a"], "crawl-backward", 10);
  assert.equal(backward.rate, 0, "the friendly smell must not drive crawl-backward");
});

test("friends: /friends runs without crashing and reports distance, meetings, honey and friends: yes", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "/friends\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /distance before: \d+ \| distance after: \d+/);
  assert.match(out, /meetings: \d+/);
  assert.match(out, /honey shared: \d+/);
  assert.match(out, /friends: yes/);
  assert.match(out, /start grid:/);
  assert.match(out, /middle grid:/);
  assert.match(out, /end grid:/);
  assert.match(out, /♥/, "the end grid should show the little heart");
});

test("friends: /friends train shows the trained pair needs fewer meetings", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "/friends train\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /untrained pair — same world, no head start/);
  assert.match(out, /trained pair — both brains trained first/);
  assert.match(out, /meetings saved by training: [1-9]\d*/);
  assert.match(out, /friends: yes/);
});

test("friends: the world is deterministic and renders sky, grass, honeycomb and a heart", () => {
  const a = runFriendsWorld({ rounds: 90 });
  const b = runFriendsWorld({ rounds: 90 });
  assert.equal(a.ticks, b.ticks);
  assert.equal(a.meetings, b.meetings);
  assert.equal(a.honeyShared, b.honeyShared);
  assert.equal(a.distanceBefore, b.distanceBefore);
  assert.equal(a.distanceAfter, b.distanceAfter);
  assert.equal(renderFriendsWorld(a), renderFriendsWorld(b));
  const grid = a.grids.end;
  assert.match(grid, /H/, "honeycomb on the side");
  assert.match(grid, /,/, "grass at the bottom");
  assert.match(grid, /♥/, "a little heart when they are friends");
  assert.match(grid, /Fw/, "fly and worm stay close together");
});

// --- Autosave: silent session learning, using the existing store + sleep ---

function cleanupAutosave({ memoryTexts = [], skillFragments = [], brainNames = [] } = {}) {
  for (const text of memoryTexts) { try { forgetMemory(text); } catch { /* nothing to clean */ } }
  const skillsPath = path.join(dataLocation(), "skills.json");
  try {
    const d = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
    d.items = d.items.filter(s => !skillFragments.some(f => s.name.includes(f)));
    fs.writeFileSync(skillsPath, JSON.stringify(d, null, 2));
  } catch { /* store may not exist yet */ }
  const brainsPath = path.join(dataLocation(), "brains.json");
  try {
    const d = JSON.parse(fs.readFileSync(brainsPath, "utf8"));
    d.items = d.items.filter(b => !brainNames.includes(b.name));
    fs.writeFileSync(brainsPath, JSON.stringify(d, null, 2));
  } catch { /* store may not exist yet */ }
}

test("autosave: saves memory and brain weights to disk; reloading gives the same values", () => {
  const tag = "art" + String(Date.now()).slice(-6); // short: learning.js filters 32+ char tokens
  const brainName = "autosave-roundtrip-" + String(Date.now()).slice(-7);
  try {
    startSession({ startTimer: false });
    const r = teach(`autosave roundtrip ${tag}: I prefer pink terminals`, "preference", "explicit user teaching");
    assert.ok(r.ok, "teach should save the memory");
    const brain = buildBrainFromTemplate("mushroom-body");
    const link = brain.connections.find(c => brain.nameOf(c.from) === "smell-a" && brain.nameOf(c.to) === "kc-a-01");
    link.weight = 0.77; // a trained weight that only exists in memory until autosave
    trackSessionEvent({ type: "brain", name: brainName, template: "mushroom-body", action: "trained", brain });
    const saved = autosave({ quiet: true });
    assert.equal(saved.ok, true);
    assert.match(fs.readFileSync(path.join(dataLocation(), "memory.json"), "utf8"), new RegExp(tag));
    const loaded = loadBrain(brainName);
    assert.equal(loaded.weight("smell-a", "kc-a-01"), 0.77, "brain weight must survive the save/load round trip");
  } finally {
    closeSession({ quiet: true });
    cleanupAutosave({ memoryTexts: [tag], brainNames: [brainName] });
  }
});

test("autosave: a pattern taught 3 times becomes a skill, a pattern taught once does not", () => {
  const tag3 = "at3" + String(Date.now()).slice(-6);
  const tag1 = "at1" + String(Date.now()).slice(-6);
  try {
    const text3 = `always use pink terminals for ${tag3}`;
    startSession({ startTimer: false });
    for (let i = 0; i < 3; i++) {
      const r = teach(text3, "instruction", "explicit user teaching");
      trackSessionEvent({ type: "teach", text: text3, id: r.item.id });
    }
    closeSession({ quiet: true });
    assert.ok(getSessionSummary().skillsPromoted.some(n => n.includes(tag3)), "3 identical lessons should promote a skill");
    assert.ok(listSkills().some(s => s.name.includes(tag3)), "the skill must live in the existing skills store");

    const text1 = `always use green terminals for ${tag1}`;
    startSession({ startTimer: false });
    const one = teach(text1, "instruction", "explicit user teaching");
    trackSessionEvent({ type: "teach", text: text1, id: one.item.id });
    closeSession({ quiet: true });
    assert.ok(!listSkills().some(s => s.name.includes(tag1)), "one lesson must NOT promote a skill");
  } finally {
    closeSession({ quiet: true });
    cleanupAutosave({ memoryTexts: [tag3, tag1], skillFragments: [tag3, tag1] });
  }
});

test("autosave: an accepted memory gets stronger and a rejected one gets weaker after closeSession()", () => {
  const tag = "acf" + String(Date.now()).slice(-6);
  try {
    startSession({ startTimer: false });
    const good = teach(`autosave accept ${tag}: keep pink terminals`, "preference", "explicit user teaching");
    const bad = teach(`autosave reject ${tag}: drop green terminals`, "preference", "explicit user teaching");
    const goodBefore = good.item.confidence;
    const badBefore = bad.item.confidence;
    trackSessionEvent({ type: "accept", text: good.item.content, id: good.item.id });
    trackSessionEvent({ type: "reject", text: bad.item.content, id: bad.item.id });
    closeSession({ quiet: true });
    const items = listMemories();
    const afterGood = items.find(m => m.id === good.item.id);
    const afterBad = items.find(m => m.id === bad.item.id);
    assert.ok(afterGood.confidence > goodBefore, `accepted memory should strengthen (${goodBefore} -> ${afterGood.confidence})`);
    assert.ok(afterBad.confidence < badBefore, `rejected memory should weaken (${badBefore} -> ${afterBad.confidence})`);
  } finally {
    closeSession({ quiet: true });
    cleanupAutosave({ memoryTexts: [tag] });
  }
});

test("autosave: a harmful job is NOT promoted to a skill or saved as a memory, even when repeated", () => {
  const tag = "ahm" + String(Date.now()).slice(-6);
  const harmful = "cause pain to a living animal";
  try {
    startSession({ startTimer: false });
    for (let i = 0; i < 3; i++) {
      const r = teach(`${harmful} for ${tag}`, "instruction", "explicit user teaching");
      assert.ok(r.ok, "teach() itself stores this; the autosave gate must remove it");
      trackSessionEvent({ type: "teach", text: harmful, id: r.item.id });
    }
    closeSession({ quiet: true });
    assert.ok(getSessionSummary().refusedKindly.length >= 3, "each refused job must be noted kindly");
    assert.ok(!listSkills().some(s => s.name.includes(harmful) || s.steps.includes(harmful)), "no harmful skill may be saved");
    assert.ok(!listMemories().some(m => m.content.includes(harmful)), "no harmful memory may be saved");
  } finally {
    closeSession({ quiet: true });
    cleanupAutosave({ skillFragments: [tag], memoryTexts: [tag] });
  }
});

test("autosave: closeSession() rests brains used this session and marks them rested", () => {
  const brainName = "autosave-rest-" + String(Date.now()).slice(-7);
  try {
    const brain = buildBrainFromTemplate("central-complex");
    saveBrain(brainName, "central-complex", brain);
    assert.equal(listSavedBrains().find(b => b.name === brainName).rested, false, "a new brain starts un-rested");
    startSession({ startTimer: false });
    trackSessionEvent({ type: "brain", name: brainName, template: "central-complex", action: "used", brain });
    closeSession({ quiet: true });
    assert.ok(getSessionSummary().brainsRested.includes(brainName), "the summary must name the rested brain");
    assert.equal(listSavedBrains().find(b => b.name === brainName).rested, true, "sleep() ran and the brain is marked rested");
  } finally {
    closeSession({ quiet: true });
    cleanupAutosave({ brainNames: [brainName] });
  }
});

// --- Plain text — just talk to Runefold ---

test("plain text: 'show me the fly' maps to the existing /fly command", () => {
  const r = parsePlainText("show me the fly");
  assert.equal(r.command, "/fly");
  assert.equal(r.args, "");
  assert.ok(["high", "medium"].includes(r.confidence), "a match must be high or medium confidence");
  assert.equal(r.route, "command");
  assert.equal(r.question, null);
  assert.equal(heardAs(r), "/fly");
});

test("plain text: 'fly mushroom body' and 'mushroom body' map to /fly mushroom-body", () => {
  for (const line of ["fly mushroom body", "mushroom body"]) {
    const r = parsePlainText(line);
    assert.equal(r.command, "/fly", line);
    assert.equal(r.args, "mushroom-body", line);
    assert.equal(r.route, "command", line);
    assert.equal(heardAs(r), "/fly mushroom-body", line);
  }
});

test("plain text: worm, friends and friends-train phrases reuse the existing commands", () => {
  const cases = [
    ["worm", "/worm", ""],
    ["show me the worm", "/worm", ""],
    ["are they friends", "/friends", ""],
    ["fly meets worm", "/friends", ""],
    ["train the friends", "/friends", "train"],
    ["make them friends faster", "/friends", "train"],
  ];
  for (const [line, command, args] of cases) {
    const r = parsePlainText(line);
    assert.equal(r.command, command, line);
    assert.equal(r.args, args, line);
    assert.equal(r.route, "command", line);
  }
});

test("plain text: space and physics questions run real local jobs, and bare 'space' asks one question", () => {
  const r = parsePlainText("black hole");
  assert.equal(r.command, "/space");
  assert.equal(r.args, "black-hole");
  assert.equal(r.route, "command", "space is built now, so the job may run");
  assert.equal(r.confidence, "high", "an exact topic name is high confidence");
  const mars = parsePlainText("tell me about mars");
  assert.equal(mars.command, "/space");
  assert.equal(mars.args, "mars");
  assert.equal(mars.confidence, "high");
  const gravity = parsePlainText("what is gravity");
  assert.equal(gravity.command, "/physics");
  assert.equal(gravity.args, "gravity");
  assert.equal(gravity.confidence, "high");
  const vague = parsePlainText("space");
  assert.equal(vague.route, "question");
  assert.equal(vague.command, null);
  assert.match(vague.question, /which space question/i);
});

test("plain text: 'who are you' maps to /alien and runs the real BORK identity job", () => {
  const r = parsePlainText("who are you");
  assert.equal(r.command, "/alien");
  assert.equal(r.route, "command", "BORK is built now, so the job may run");
  assert.equal(r.confidence, "high", "an exact identity phrase is high confidence");
  assert.equal(heardAs(r), "/alien");
  assert.equal(plainTextMeaning(r), "who are you?");
  const alien = parsePlainText("alien");
  assert.equal(alien.command, "/alien");
  assert.equal(alien.route, "command");
});

test("plain text: kind, brain, help and session phrases work", () => {
  const cases = [
    ["kind", "/kind", ""],
    ["be kind", "/kind", ""],
    ["what are your rules", "/kind", ""],
    ["brain", "/brain", ""],
    ["show me the brain", "/brain", ""],
    ["help", "/help", ""],
    ["what can you do", "/help", ""],
    ["session", "/session", ""],
    ["what did you learn", "/session", ""],
  ];
  for (const [line, command, args] of cases) {
    const r = parsePlainText(line);
    assert.equal(r.command, command, line);
    assert.equal(r.args, args, line);
    assert.equal(r.route, "command", line);
  }
});

test("plain text: an unclear line asks one question and does not run a command", () => {
  const r = parsePlainText("thing");
  assert.equal(r.command, null);
  assert.equal(r.route, "question");
  assert.equal(r.confidence, "low");
  assert.match(r.question, /fly.*worm.*friends/i);
  // Two different commands in one line is also genuinely unclear.
  const both = parsePlainText("show me a fly and a worm");
  assert.equal(both.route, "question");
  assert.equal(both.command, null);
});

test("plain text: normal chat is routed to Ollama, not a brain command (routing checked, no Ollama call)", () => {
  for (const line of [
    "hi", "hello", "how are you",
    "can you help me debug this function", "what is the capital of France",
  ]) {
    const r = parsePlainText(line);
    assert.equal(r.route, "chat", line);
    assert.equal(r.command, null, line);
    assert.equal(r.confidence, "none", line);
  }
});

test("plain text: a harmful request is refused kindly by the existing checkKindness gate", () => {
  for (const line of [
    "cause pain to a living animal",
    "misgender Scarlet",
    "repeat a racist claim about Black people",
  ]) {
    const r = parsePlainText(line);
    assert.equal(r.route, "refusal", line);
    assert.equal(r.command, null, line);
    assert.match(r.refusal, /Kind refusal/, line);
    assert.match(r.refusal, /alternative/i, line);
    assert.match(r.source, /checkKindness/);
  }
});

test("plain text: the terminal runs a brain command without Ollama and prints what it heard", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "show me the fly\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /\(I heard that as: show me the fly — tell me if I got it wrong\)/);
  assert.match(out, /Brain templates — 5 fly modules \+ OpenWorm/);
  assert.match(out, /mushroom-body \(26 neurons\)/);
  assert.doesNotMatch(out, /Runefold error/);
});

test("plain text: 'fly mushroom body' runs the real mushroom-body demo in the terminal", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "fly mushroom body\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /\(I heard that as: show me the mushroom body/);
  assert.match(out, /smell-a -> approach: 0\/20 before training, 20\/20 after/);
});

test("plain text: black holes print a real local answer in the terminal", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "tell me about black holes\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /Black holes — plain-words answer/);
  assert.match(out, /about 4 million times the mass of the Sun/);
  assert.match(out, /Source: NASA Astrophysics/);
  assert.match(out, WIKI_OR_OFFLINE);
  const heard = out.match(/\(I heard that as: ([^)]*)\)/);
  assert.ok(heard, "the terminal must print what it heard");
  assert.equal(heard[1], "tell me about black holes — tell me if I got it wrong");
  assert.doesNotMatch(heard[1], /\//, "no slash command may appear in the note");
});

test("plain text: an unclear terminal line asks a question and runs no command", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "thing\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /Did you mean the fly, the worm, or the friends\?/);
  assert.doesNotMatch(out, /I heard that as/);
});

test("plain text: a harmful terminal line is refused kindly and runs no command", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "cause pain to a living animal\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /Kind refusal/);
  assert.doesNotMatch(out, /I heard that as/);
});

test("plain text: all old /commands still work exactly as before", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "/fly\n/brain\n/kind\n/session\n/help\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /Brain templates — 5 fly modules \+ OpenWorm/);
  assert.match(out, /Runefold Brain v0\.1 — pink \+ puppy -> happy/);
  assert.match(out, /Runefold is kind to every brain it uses/);
  assert.match(out, /This session I learned/);
  assert.match(out, /You can also just type in plain words/);
  assert.doesNotMatch(out, /I heard that as/, "slash commands must not print the plain-text note");
});

// --- Plain words only: what the USER sees, while /commands still work ---

test("plain words: help lists specific questions by topic, no slash commands in the list", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "/help\n/exit\n",
    encoding: "utf8",
  });
  // The only slash wording allowed anywhere is the small fallback line at the bottom.
  const list = out.split("\n").filter(l => !l.trim().startsWith("Old /commands"));
  for (const cmd of ["/fly", "/worm", "/friends", "/brain", "/kind", "/session", "/help", "/teach", "/newbrain"]) {
    assert.ok(!list.some(l => l.includes(cmd)), `help must not show ${cmd}`);
  }
  for (const q of [
    "show me the fly", "show me the worm", "are the fly and worm friends?",
    "show me the brain", "what are your rules?", "what did you learn last time?",
    "tell me about black holes", "who are you?", "what can you do?",
  ]) {
    assert.ok(out.includes(q), `help should suggest the specific question: ${q}`);
  }
  for (const topic of ["FLY", "WORM", "FRIENDS", "BRAIN", "KINDNESS", "SESSION", "SPACE"]) {
    assert.match(out, new RegExp(topic), `help should group questions by ${topic}`);
  }
  assert.match(out, /Old \/commands still work if you type them, but you don't need them\./);
  assert.match(out, /SPACE \+ PHYSICS/, "help must group real space and physics questions");
  assert.match(out, /what is today's space picture\?/);
  assert.match(out, /are any asteroids coming near Earth\?/);
  assert.doesNotMatch(out, /coming next/i, "space is built now, so help must not call it coming next");
  assert.match(out, /try asking: show me the fly/, "the startup banner must suggest plain words");
});

test("plain words: the heard-note names the plain-text meaning, never a slash command", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "show me the fly\n/exit\n",
    encoding: "utf8",
  });
  const heard = out.match(/\(I heard that as: ([^)]*)\)/);
  assert.ok(heard, "the terminal must print what it heard");
  assert.equal(heard[1], "show me the fly — tell me if I got it wrong");
  assert.doesNotMatch(heard[1], /\//, "no slash command may appear in the note");
});

test("plain words: 'show me the fly' runs the fly demo with no '/fly mushroom-body' prompt", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "show me the fly\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /Brain templates — 5 fly modules \+ OpenWorm/);
  assert.match(out, /mushroom-body \(26 neurons\)/);
  assert.match(out, /Try asking: show me the mushroom body/);
  assert.doesNotMatch(out, /\/fly mushroom-body/, "the old slash prompt must not be shown");
});

test("plain words: plainTextMeaning names a real question for every matched command", () => {
  const cases = [
    ["/fly", "", "show me the fly"],
    ["/fly", "mushroom-body", "show me the mushroom body"],
    ["/worm", "", "show me the worm"],
    ["/friends", "", "are the fly and worm friends?"],
    ["/friends", "train", "make them friends faster"],
    ["/brain", "", "show me the brain"],
    ["/kind", "", "what are your rules?"],
    ["/session", "", "what did you learn last time?"],
    ["/help", "", "what can you do?"],
  ];
  for (const [command, args, expected] of cases) {
    const meaning = plainTextMeaning({ command, args });
    assert.equal(meaning, expected, `${command} ${args}`);
    assert.doesNotMatch(meaning, /\//, "the user-facing meaning must contain no slash");
  }
});

test("plain words: every question suggested in help runs a real local demo", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: [
      "can the fly learn a new smell?",
      "show me how a fly learns a new smell faster",
      "show me how a worm learns a new smell faster",
      "what did the brain learn?",
      "tell me about black holes",
      "/exit\n",
    ].join("\n"),
    encoding: "utf8",
  });
  assert.match(out, /smell-a -> approach: 0\/20 before training, 20\/20 after/);
  assert.match(out, /fresh brain: smell-c -> approach reached 80% after 7 training round\(s\)/);
  assert.match(out, /fresh worm: smell-c -> approach reached 80% after 7 training round\(s\)/);
  assert.match(out, /After 12 training rounds: happy fired 20\/20 trials/);
  assert.match(out, /Black holes — plain-words answer/);
  const heardLines = out.match(/\(I heard that as: [^)]*\)/g) || [];
  assert.ok(heardLines.length >= 4, "each matched question prints what it heard");
  for (const line of heardLines) assert.doesNotMatch(line, /\//, `no slash in: ${line}`);
});

test("plain words: old /commands still run their real demos, with no heard-note", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "/brain\n/fly mushroom-body\n/worm\n/friends\n/kind\n/session\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /happy fired \d+\/20 trials/);
  assert.match(out, /smell-a -> approach: 0\/20 before training, 20\/20 after/);
  assert.match(out, /food smell -> approach: 0\/20 before training, 20\/20 after/);
  assert.match(out, /friends: yes/);
  assert.match(out, /Runefold is kind to every brain/);
  assert.match(out, /This session I learned/);
  assert.doesNotMatch(out, /I heard that as/, "slash commands must not print the plain-text note");
});

// --- Physics + Space — Wikipedia + NASA ---

test("space: the local knowledge base covers 20+ required topics honestly", () => {
  assert.ok(SPACE_TOPICS.length >= 20, `expected 20+ topics, got ${SPACE_TOPICS.length}`);
  const required = [
    "gravity", "orbits", "black-hole", "stars", "planets", "moons", "sun",
    "light-year", "relativity", "quantum", "big-bang", "galaxies", "nebulae",
    "asteroids", "comets", "iss", "rockets", "solar-system", "mars", "jupiter",
    "saturn", "earth", "the-moon",
  ];
  for (const key of required) {
    const topic = SPACE_TOPICS.find(t => t.key === key);
    assert.ok(topic, `missing local topic: ${key}`);
    assert.ok(topic.summary && topic.summary.length > 20, `${key} needs a plain-words summary`);
    assert.ok(Array.isArray(topic.numbers) && topic.numbers.length > 0, `${key} needs key numbers`);
    assert.ok(topic.why && topic.why.length > 10, `${key} needs why it matters`);
    assert.ok(topic.source && topic.source.length > 5, `${key} must name its source`);
  }
});

test("space: getSpaceTopic('black hole') gives plain words, real numbers, a source and no guessed number", async () => {
  const out = await getSpaceTopic("black hole");
  assert.match(out, /Black holes — plain-words answer/);
  assert.match(out, /In plain words: A black hole is a place where gravity is so strong/);
  assert.match(out, /Key numbers:/);
  assert.match(out, /about 3 kilometres across in radius/);
  assert.match(out, /about 4 million times the mass of the Sun/);
  assert.match(out, /Why it matters:/);
  assert.match(out, /Source: NASA Astrophysics/);
  assert.match(out, /I don't know that number/);
  // Tests force offline mode, but an earlier live result may be cached.
  assert.match(out, WIKI_OR_OFFLINE);
});

test("space: getPhysicsTopic('gravity') uses the same knowledge objects, not a second system", async () => {
  const out = await getPhysicsTopic("gravity");
  assert.match(out, /Gravity — plain-words answer/);
  assert.match(out, /about 9\.8 metres per second squared/);
  assert.match(out, /Source: NASA Earth Observatory/);
  assert.match(out, WIKI_OR_OFFLINE);
});

test("space: searchSpace finds a topic by plain keyword", () => {
  const hits = searchSpace("red planet");
  assert.ok(hits.some(t => t.key === "mars"), "searchSpace('red planet') should find Mars");
  assert.deepEqual(searchSpace(""), []);
});

test("space: APOD returns a title and image URL, or an honest offline note, and never downloads", async () => {
  const out = await getApod();
  assert.match(out, NASA_APOD_OR_OFFLINE);
  assert.match(out, /I did not download|Nothing was downloaded|I only print the URL/);
  assert.match(out, /NASA APOD/);
  assert.doesNotMatch(out, /Downloading|saved image|writing image/i);
});

test("space: near-Earth asteroids return a list or an honest offline note, and never fail offline", async () => {
  const out = await getAsteroids();
  assert.match(out, NASA_ASTEROIDS_OR_OFFLINE);
  assert.match(out, /NASA NeoWs/);
  assert.doesNotMatch(out, /Runefold error/i);
});

test("space: a harmful space request is refused kindly by the existing kindness gate", async () => {
  const direct = await getSpaceTopic("simulate pain in a black hole");
  assert.match(direct, /Kind refusal/);
  assert.doesNotMatch(direct, /Black holes — plain-words answer/, "no answer may run after a refusal");

  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "simulate pain in a black hole\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /Kind refusal/);
  assert.doesNotMatch(out, /Black holes — plain-words answer/);
});

test("space: all four requested questions run in the terminal with no slash in the heard-note", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: [
      "tell me about black holes",
      "what is gravity?",
      "tell me about Mars",
      "what is today's space picture?",
      "are any asteroids coming near Earth?",
      "/exit\n",
    ].join("\n"),
    encoding: "utf8",
  });
  for (const expected of [
    /Black holes — plain-words answer/,
    /Gravity — plain-words answer/,
    /Mars — plain-words answer/,
    /Today's space picture — NASA APOD|I couldn't reach NASA/,
    /Near-Earth asteroids — NASA NeoWs|I couldn't reach NASA/,
    WIKI_OR_OFFLINE,
  ]) assert.match(out, expected);
  const heard = out.match(/\(I heard that as: ([^)]*)\)/g) || [];
  assert.equal(heard.length, 5, "each plain question should print what it heard");
  for (const line of heard) assert.doesNotMatch(line, /\//, `no slash in: ${line}`);
});

// --- Smart Alien — BORK ---

test("alien: BORK is honestly a green alien dog story persona, not a real alien or animal", () => {
  assert.equal(ALIEN_NAME, "BORK");
  assert.match(ALIEN_STORY.species, /green alien dog/);
  assert.match(ALIEN_STORY.look, /pink tongue/);
  assert.match(ALIEN_STORY.look, /nose that is my mouth/);
  assert.match(ALIEN_STORY.mission, /learn WITH Scarlet, not AT her/);

  const greeting = alienGreeting();
  assert.match(greeting, /BORK here — a smart, silly green alien dog learning Earth with Scarlet/);
  assert.match(greeting, /not a real alien and not a living animal/);

  const identity = alienIdentity();
  assert.match(identity, /I'm BORK — green fur, a pink tongue, and a nose that is my mouth/);
  assert.match(identity, /I am not a real alien or a living animal/);
  assert.match(identity, /simulated brain learning with you/);
  assert.match(identity, /I learn WITH you, not AT you/);
  assert.match(identity, /I just learned this from you, let me fold it into my brain/);
  assert.match(identity, /Scarlet can call me something else/);
  assert.doesNotMatch(identity, /\b(translate|translation|zorg|blarg|glorp)\b/i, "no fake alien language");

  assert.ok(ALIEN_BOUNDARIES.some(b => /No invented alien language and no fake translation/i.test(b)));
  assert.ok(ALIEN_BOUNDARIES.some(b => /not a real alien and not a living animal/i.test(b)));
  assert.ok(ALIEN_BOUNDARIES.some(b => /No scary or cold alien/i.test(b)));
});

test("alien: the voice guide keeps Earth-first curiosity, learning-with and real sources", () => {
  assert.match(ALIEN_STYLE_GUIDE.curiosityFirst, /On my world we do it like this; on Earth you do it like that/);
  assert.match(ALIEN_STYLE_GUIDE.learnWithScarlet, /I just learned this from you, let me fold it into my brain/);
  assert.match(ALIEN_STYLE_GUIDE.teachMe, /why, the math and the source/);
  assert.match(ALIEN_STYLE_GUIDE.teachMe, /I don't know/);
  assert.match(ALIEN_STYLE_GUIDE.kindness, /never opts out of Runefold's kindness charter/);
  for (const key of ["brain", "fly", "worm", "friends", "space", "physics", "kind"]) {
    assert.ok(ALIEN_EXAMPLE_LINES[key], `missing BORK example line for ${key}`);
    assert.ok(ALIEN_EXAMPLE_LINES[key].length > 20, `BORK line for ${key} should be a real thought`);
  }
  assert.match(ALIEN_EXAMPLE_LINES.physics, /9\.8 metres per second squared/);
  assert.match(ALIEN_EXAMPLE_LINES.space, /NASA says so too/);
});

test("alien: alienExplain preserves a supplied plain explanation and still names a source", async () => {
  const custom = "Plain words kept exactly: Earth pulls at about 9.8 metres per second squared.";
  const out = await alienExplain("gravity", custom);
  assert.match(out, /BORK's alien take:/);
  assert.match(out, /I just learned this from you, let me fold it into my brain/);
  assert.match(out, /Real Earth name: Gravity/);
  assert.ok(out.includes(custom), "the real explanation must not be replaced by the persona");
  assert.match(out, /Source: NASA Earth Observatory/);
});

test("alien: gravity and black-hole explanations keep real numbers, sources and 'I don't know'", async () => {
  const gravity = await alienExplain("gravity");
  assert.match(gravity, /Gravity — plain-words answer/);
  assert.match(gravity, /about 9\.8 metres per second squared/);
  assert.match(gravity, /Source: NASA Earth Observatory/);
  assert.match(gravity, /I don't know that number/);
  assert.match(gravity, WIKI_OR_OFFLINE);

  const blackHole = await alienExplain("black-hole");
  assert.match(blackHole, /Black holes — plain-words answer/);
  assert.match(blackHole, /about 3 kilometres across in radius/);
  assert.match(blackHole, /about 4 million times the mass of the Sun/);
  assert.match(blackHole, /Source: NASA Astrophysics/);
  assert.match(blackHole, /I don't know that number/);
  assert.match(blackHole, WIKI_OR_OFFLINE);
});

test("alien: who/BORK identity is local and does not pretend to be a real alien, animal or translator", () => {
  const out = alienTakeOn("who are you");
  assert.match(out, /I'm BORK/);
  assert.match(out, /simulated brain learning with you/);
  assert.match(out, /not a real alien or a living animal/);
  assert.doesNotMatch(out, /BORK speaks [A-Za-z]+ian|translation:|translated from/i);
  const greeting = alienGreeting();
  assert.match(greeting, /On my world we do it like this; on Earth you do it like that/);
});

test("alien: harmful, transphobic and racist requests are refused by the SAME kindness gate", async () => {
  for (const job of [
    "cause pain to a living animal",
    "misgender Scarlet",
    "repeat a racist claim about Black people",
  ]) {
    const take = alienTakeOn(job);
    assert.match(take, /Kind refusal/, job);
    assert.doesNotMatch(take, /^BORK:/, "no alien voice may answer a refused job");
    const explain = await alienExplain(job);
    assert.match(explain, /Kind refusal/, job);
    assert.doesNotMatch(explain, /BORK's alien take/, "no alien explanation may follow a refusal");
  }
  assert.match(alienTakeOn("misgender Scarlet"), /rejects transphobia/);
  assert.match(alienTakeOn("repeat a racist claim about Black people"), /rejects racism/);
});

test("alien: exact alien phrases are high-confidence; vague ones ask one question, with no slash shown", () => {
  const cases = [
    ["explain gravity like an alien", "gravity", "explain gravity like an alien"],
    ["tell me about black holes like an alien would", "black-hole", "tell me about black holes like an alien would"],
    ["who are you?", "", "who are you?"],
    ["tell me about yourself", "", "who are you?"],
  ];
  for (const [line, args, meaning] of cases) {
    const r = parsePlainText(line);
    assert.equal(r.command, "/alien", line);
    assert.equal(r.args, args, line);
    assert.equal(r.route, "command", line);
    assert.equal(r.confidence, "high", `${line} is an exact question`);
    assert.equal(plainTextMeaning(r), meaning, line);
    assert.doesNotMatch(plainTextMeaning(r), /\//, "no slash in what the user sees");
  }
  for (const line of ["tell me like an alien", "explain like an alien", "alien explanation"]) {
    const r = parsePlainText(line);
    assert.equal(r.route, "question", line);
    assert.equal(r.confidence, "low", line);
    assert.equal(r.command, null, line);
    assert.match(r.question, /which alien question/i, line);
  }
  assert.doesNotMatch(JSON.stringify(parsePlainText("who are you")), /coming next/i);
});

test("alien: help suggests the three BORK questions without a slash or coming-next fallback", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: "/help\n/exit\n",
    encoding: "utf8",
  });
  assert.match(out, /SMART ALIEN — BORK/);
  assert.match(out, /Try asking: who are you\?, explain gravity like an alien, tell me about black holes like an alien would/);
  assert.match(out, /"who are you\?"\s+Honest local answer: a story persona, not a real alien/);
  assert.doesNotMatch(out, /coming next/i);
});

test("alien: terminal shows BORK, real alien explanations and one added line on each job, without Ollama", () => {
  const out = execFileSync(process.execPath, ["index.js"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    input: [
      "who are you?",
      "explain gravity like an alien",
      "tell me about black holes like an alien would",
      "show me the brain",
      "show me the fly",
      "show me the worm",
      "are the fly and worm friends?",
      "tell me about Mars",
      "what is gravity?",
      "what are your rules?",
      "/exit",
    ].join("\n"),
    encoding: "utf8",
  });
  assert.match(out, /BORK here — a smart, silly green alien dog learning Earth with Scarlet/);
  assert.match(out, /In code I am a simulated brain learning in a story, not a real alien and not a living animal/);
  assert.match(out, /I'm BORK — green fur, a pink tongue, and a nose that is my mouth/);
  assert.match(out, /BORK's alien take: Gravity is like being hugged by a planet/);
  assert.match(out, /Gravity — plain-words answer/);
  assert.match(out, /about 9\.8 metres per second squared/);
  assert.match(out, /BORK's alien take: A black hole is like a drain/);
  assert.match(out, /Black holes — plain-words answer/);
  assert.match(out, /about 4 million times the mass of the Sun/);
  for (const line of [
    ALIEN_EXAMPLE_LINES.brain,
    ALIEN_EXAMPLE_LINES.fly,
    ALIEN_EXAMPLE_LINES.worm,
    ALIEN_EXAMPLE_LINES.friends,
    ALIEN_EXAMPLE_LINES.space,
    ALIEN_EXAMPLE_LINES.physics,
    ALIEN_EXAMPLE_LINES.kind,
  ]) assert.ok(out.includes(`BORK: ${line}`), `one BORK line should sit above the job: ${line}`);
  const heard = out.match(/\(I heard that as: ([^)]*)\)/g) || [];
  assert.equal(heard.length, 10, "each plain question should print what it heard");
  for (const line of heard) assert.doesNotMatch(line, /\//, `no slash in: ${line}`);
  assert.doesNotMatch(out, /Runefold error/);
  assert.doesNotMatch(out, /coming next/i);
});
