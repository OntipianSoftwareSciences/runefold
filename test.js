import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tokenize, search } from "./core/retrieval.js";
import { teach, forgetMemory, listMemories, consolidate, addGoal } from "./core/learning.js";
import { writeFile, editFile, runAllowed } from "./core/tools.js";
import { createBrain, demoBrain } from "./core/brain.js";
import { listTemplates, listAllTemplates, getTemplate, buildBrainFromTemplate, demoMushroomBody, demoCentralComplex, demoAntennalLobe, demoGiantFiber, demoVentralNerveCord, demoTransfer, buildTransferBrain, saveBrain, loadBrain, assertKindTemplate, restBrain, listSavedBrains } from "./core/fly.js";
import { getWormTemplate, buildWormBrain, demoWorm, demoWormTransfer, demoWormNavigation, navigateWorm, assertWormKind } from "./core/worm.js";
import { KINDNESS_RULES, CORE_VALUES, checkKindness, isKindJob, kindnessCharterText } from "./core/kindness.js";
import { dataLocation } from "./core/store.js";
import { FRIENDS_JOB, createFriendsWorld, stepFriendsWorld, runFriendsWorld, demoFriends, renderFriendsWorld } from "./core/friends.js";

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
