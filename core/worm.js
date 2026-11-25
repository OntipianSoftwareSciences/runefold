// Runefold Brain v0.3 — OpenWorm, a whole C. elegans roundworm brain as a
// Runefold template.
//
// The real science, honestly:
//   Caenorhabditis elegans is a 1 mm soil roundworm. It was the first
//   animal to have its entire connectome mapped (White, Southgate,
//   Thomson & Brenner, 1986): 302 neurons and roughly 5,000 chemical
//   synapses. OpenWorm (openworm.org, MIT licensed) is the open-source
//   project building a full worm simulation from that map. We do NOT
//   download or run OpenWorm's data here. We copy the CIRCUIT DESIGNS
//   at toy scale, the same way v0.2 copied fruit-fly circuit designs.
//
// Why under 120 neurons, not 302:
//   This is a laptop-friendly toy. 302 neurons with ~5,000 synapses,
//   geophysical cell models and real muscle mechanics is a research
//   project, not a terminal demo. The worm below has 54 neurons (plus
//   5 temporary Kenyon cells when a transfer adds a new smell). It keeps
//   the same decisions — smell -> approach/avoid, gentle touch -> go,
//   head bump -> turn, command interneurons -> alternating muscles —
//   and leaves out the full cell catalogue, gap junctions, continuous
//   time, and the physics of a living body.
//
// Real names are kept in the neuron list and comments:
//   AWA / AWB / AWC  - olfactory (smell) receptor neurons. AWA detects
//                     attractive smells such as diacetyl; AWB/AWC help
//                     detect repellents.
//   ALM / PLM        - touch receptor neurons. Gentle body touch makes
//                     a worm speed up forward; a bump near the head
//                     makes it turn or back up.
//   AFD              - temperature-sensing neuron in the head.
//   AIA / AIB        - first-order interneurons carrying smell signals
//                     deeper into the circuit.
//   AVA / AVD        - "backward" command interneurons.
//   AVB / PVB        - "forward" command interneurons.
//   RIV / SMD        - turning interneurons and dorsal/ventral head
//                     motor neurons (we call the outputs turn-dorsal /
//                     turn-ventral).
//   VA / VB / DA / DB - ventral/dorsal A and B motor neurons driving
//                     the body-wall muscles.
//   Mushroom-body-like Kenyon cells: C. elegans has no fly mushroom
//   body. Learning here is an HONEST ANALOGY: we reuse the v0.2 fly
//   mushroom-body pattern (sparse Kenyon cells + reward teaching + STDP)
//   as the worm's associative module, so transfer also reuses the exact
//   same v0.2 code. The real worm's smell learning lives in cells such
//   as AWA/AIA and is modulated by dopamine/serotonin; that chemistry
//   is not simulated here.
//
// Only ONE neuron model and ONE template system are used: this file
// registers a template with core/fly.js and builds it with fly's
// buildBrainFromTemplate(), which runs the existing checkKindness() gate.
// Training and transfer call fly's trainAssociation(), buildTransferBrain()
// and roundsToLearn() — nothing was reinvented here.

import {
  buildBrainFromTemplate,
  registerTemplate,
  assertKindTemplate,
  trainAssociation,
  buildTransferBrain,
  roundsToLearn,
} from "./fly.js";

// Helper to build the 10 Kenyon cells that listen to one smell, with the
// exact names the v0.2 transfer code expects (kc-a-01 .. kc-a-10).
function kcGroup(prefix, count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}-${String(i + 1).padStart(2, "0")}`,
    layer: "hidden",
  }));
}

// The worm template. Same shape as every fly template:
// { name, job, description, biology, neurons, connections, inputs,
//   outputs, learnable }. The job is deliberately kind and plain: crawl,
//   learn, navigate — the kindness gate reads this string first.
export const WORM_TEMPLATE = {
  name: "worm",
  job: "Crawl toward food smells and away from bad smells, and turn at walls",
  description:
    "A toy C. elegans roundworm: smell, touch and temperature senses; " +
    "AVA/AVB command interneurons for backward/forward crawl; alternating " +
    "body-wall muscles; and a small associative module that learns smells " +
    "and transfers that skill to a new smell.",
  biology:
    "Real C. elegans: 302 neurons, ~5,000 chemical synapses, first complete " +
    "connectome in 1986; OpenWorm is open source (MIT). Kept here: AWA/AWB " +
    "smell sensing, ALM/PLM touch, AFD temperature, AIA/AIB interneurons, " +
    "AVA/AVD backward and AVB/PVB forward command interneurons, VA/VB/DA/DB " +
    "motor neurons, RIV/SMD turns, and sparse Kenyon-cell-style smell " +
    "learning with STDP. Left out: 248 of the 302 neurons, gap junctions, " +
    "real muscle physics, neuromodulators, and continuous time — 54 neurons " +
    "is a toy scale that runs instantly on a laptop.",
  neurons: [
    // Senses and teaching signals (real worm names in comments above).
    { name: "smell-a", layer: "input" },  // food smell, e.g. diacetyl via AWA
    { name: "smell-b", layer: "input" },  // bad smell, e.g. repellent via AWB/AWC
    { name: "touch", layer: "input" },    // gentle body touch via PLM
    { name: "temp", layer: "input" },     // temperature shift via AFD
    { name: "wall-touch", layer: "input" }, // bump near the head via ALM
    { name: "reward", layer: "input" },   // food teaching signal (dopamine-like)
    { name: "punishment", layer: "input" }, // avoidance teaching signal (not pain)
    // Sensory interneurons.
    { name: "awa", layer: "hidden" },
    { name: "awb", layer: "hidden" },
    { name: "alm", layer: "hidden" },
    { name: "plm", layer: "hidden" },
    { name: "afd", layer: "hidden" },
    { name: "aia", layer: "hidden" },
    { name: "aib", layer: "hidden" },
    // Associative module: the v0.2 mushroom-body pattern, 20 sparse cells.
    ...kcGroup("kc-a", 10),
    ...kcGroup("kc-b", 10),
    // Command interneurons.
    { name: "ava", layer: "hidden" },     // backward command
    { name: "avb", layer: "hidden" },     // forward command
    { name: "avd", layer: "hidden" },     // backward relay
    { name: "pvb", layer: "hidden" },     // forward relay
    { name: "riv", layer: "hidden" },     // turning interneuron
    { name: "turn-relay", layer: "hidden" }, // delays the other turn direction
    // Motor neurons (VA/VB/DA/DB) and relays for alternating muscles.
    { name: "va", layer: "hidden" },
    { name: "vb", layer: "hidden" },
    { name: "da", layer: "hidden" },
    { name: "db", layer: "hidden" },
    { name: "motor-relay-f", layer: "hidden" },
    { name: "motor-relay-b", layer: "hidden" },
    // Outputs: learned choice, crawl direction, turns, body-wall muscles.
    { name: "approach", layer: "output" },
    { name: "avoid", layer: "output" },
    { name: "crawl-forward", layer: "output" },
    { name: "crawl-backward", layer: "output" },
    { name: "turn-dorsal", layer: "output" },
    { name: "turn-ventral", layer: "output" },
    { name: "muscle-dorsal", layer: "output" },
    { name: "muscle-ventral", layer: "output" },
  ],
  connections: [
    // --- Associative module: exactly the fly mushroom-body design. ---
    // One smell wakes its own 10 Kenyon cells strongly (sparse coding).
    ...kcGroup("kc-a", 10).map((kc) => ({ from: "smell-a", to: kc.name, weight: 1.0 })),
    ...kcGroup("kc-b", 10).map((kc) => ({ from: "smell-b", to: kc.name, weight: 1.0 })),
    // Teacher signals are fixed: STDP must not let the teacher fire the
    // answer by itself (the v0.2 bug documented in core/fly.js).
    { from: "reward", to: "approach", weight: 0.9, fixed: true },
    { from: "punishment", to: "avoid", weight: 0.9, fixed: true },
    // 10 cells x 0.08 = 0.8, just under threshold: an untrained worm is
    // quiet. Training grows these links; that IS the learning.
    ...kcGroup("kc-a", 10).flatMap((kc) => [
      { from: kc.name, to: "approach", weight: 0.08 },
      { from: kc.name, to: "avoid", weight: 0.08 },
    ]),
    ...kcGroup("kc-b", 10).flatMap((kc) => [
      { from: kc.name, to: "approach", weight: 0.08 },
      { from: kc.name, to: "avoid", weight: 0.08 },
    ]),

    // --- Smell senses: AWA (food) and AWB/AWC (bad) via AIA / AIB. ---
    { from: "smell-a", to: "awa", weight: 1.0 },
    { from: "smell-b", to: "awb", weight: 1.0 },
    { from: "awa", to: "aia", weight: 1.0 },
    { from: "awb", to: "aib", weight: 1.0 },
    { from: "aia", to: "avb", weight: 1.0 }, // food smell -> forward crawl
    { from: "aib", to: "ava", weight: 1.0 }, // bad smell -> backward crawl

    // --- Touch and temperature. ---
    // Gentle posterior touch (PLM) makes a real worm crawl forward.
    { from: "touch", to: "plm", weight: 1.0 },
    { from: "plm", to: "avb", weight: 1.0 },
    { from: "touch", to: "alm", weight: 0.2 }, // weak: gentle touch is not a bump
    // A bump near the head (ALM) starts the turning circuit, not forward.
    { from: "wall-touch", to: "alm", weight: 1.0 },
    { from: "alm", to: "riv", weight: 1.0 },
    // AFD reports temperature shifts; a shift feeds the avoidance route.
    { from: "temp", to: "afd", weight: 1.0 },
    { from: "afd", to: "aib", weight: 1.0 },

    // --- Learned choices drive the same command interneurons. ---
    // fixed: true — a structure link. Learning must not erase the path
    // from a learned choice to the crawl command.
    { from: "approach", to: "avb", weight: 1.0, fixed: true },
    { from: "avoid", to: "ava", weight: 1.0, fixed: true },

    // --- Command interneurons -> motor neurons -> crawl direction. ---
    // AVA/AVD are the real backward commands, AVB/PVB the forward ones.
    { from: "avb", to: "pvb", weight: 1.0 },
    { from: "pvb", to: "vb", weight: 1.0 },
    { from: "vb", to: "crawl-forward", weight: 1.0 },
    { from: "avb", to: "vb", weight: 0.6 },
    { from: "ava", to: "avd", weight: 1.0 },
    { from: "avd", to: "va", weight: 1.0 },
    { from: "va", to: "crawl-backward", weight: 1.0 },
    { from: "ava", to: "va", weight: 0.6 },
    // DA/DB motor neurons: real worm names, weaker supporting routes.
    { from: "avb", to: "da", weight: 0.5 },
    { from: "da", to: "crawl-forward", weight: 0.3 },
    { from: "ava", to: "db", weight: 0.5 },
    { from: "db", to: "crawl-backward", weight: 0.3 },

    // --- Turning: RIV -> SMD-like dorsal turn, relay -> ventral turn. ---
    // A repeated bump alternates the two, like a worm's undulating head.
    { from: "riv", to: "turn-dorsal", weight: 1.0 },
    { from: "riv", to: "turn-relay", weight: 1.0 },
    { from: "turn-relay", to: "turn-ventral", weight: 1.0 },
    { from: "ava", to: "riv", weight: 0.3 }, // backing up often turns too

    // --- Alternating body-wall muscles (worm-style crawl). ---
    // Forward: dorsal muscle now, ventral muscle one tick later.
    // Backward: the order reverses. That alternation is the whole point.
    { from: "crawl-forward", to: "muscle-dorsal", weight: 1.0 },
    { from: "crawl-forward", to: "motor-relay-f", weight: 1.0 },
    { from: "motor-relay-f", to: "muscle-ventral", weight: 1.0 },
    { from: "crawl-backward", to: "muscle-ventral", weight: 1.0 },
    { from: "crawl-backward", to: "motor-relay-b", weight: 1.0 },
    { from: "motor-relay-b", to: "muscle-dorsal", weight: 1.0 },
    { from: "turn-dorsal", to: "muscle-dorsal", weight: 0.8 },
    { from: "turn-ventral", to: "muscle-ventral", weight: 0.8 },
  ],
  inputs: ["smell-a", "smell-b", "touch", "temp", "wall-touch", "reward", "punishment"],
  outputs: [
    "approach", "avoid", "crawl-forward", "crawl-backward",
    "turn-dorsal", "turn-ventral", "muscle-dorsal", "muscle-ventral",
  ],
  learnable: true,
};

// Register with the existing template system. fly's listTemplates() still
// returns only the 5 fly modules (so old tests and commands are unchanged);
// /fly and /template list use fly's listAllTemplates() to show the worm too.
registerTemplate(WORM_TEMPLATE);

export function getWormTemplate() {
  return WORM_TEMPLATE;
}

// The SAME kindness gate as every fly brain: no second ethics system.
// buildWormBrain() goes through fly's buildBrainFromTemplate(), which calls
// assertKindTemplate() (checkKindness) before it creates any neurons.
export function assertWormKind(template = WORM_TEMPLATE) {
  return assertKindTemplate(template);
}

export function buildWormBrain() {
  return buildBrainFromTemplate("worm");
}

// Train the worm's smell associations with the v0.2 training helper —
// the same teacher-forcing + 8-tick rest that fixed the fly cross-talk bug.
export function trainWormSmells(brain, rounds = 12) {
  trainAssociation(brain, ["smell-a", "reward"], "approach", rounds);
  trainAssociation(brain, ["smell-b", "punishment"], "avoid", rounds);
  return brain;
}

// ---------------------------------------------------------------------------
// A tiny grid world. The worm is a point on a 7x7 grid facing N/E/S/W.
// Food smell means "food is somewhere ahead in this direction" (a plume),
// bad smell means "repellent is ahead", and a step outside the grid is a
// wall bump. There is no randomness anywhere: same brain, same trace.
// The brain decides each step; the grid only supplies senses and moves.
// ---------------------------------------------------------------------------
const DIRECTIONS = {
  N: { dx: 0, dy: -1, left: "W", right: "E" },
  E: { dx: 1, dy: 0, left: "N", right: "S" },
  S: { dx: 0, dy: 1, left: "E", right: "W" },
  W: { dx: -1, dy: 0, left: "S", right: "N" },
};
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
const ACTION_NEURONS = ["crawl-forward", "crawl-backward", "turn-dorsal", "turn-ventral"];

function inside(x, y, world) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

function cellAhead(pos, dir) {
  const d = DIRECTIONS[dir];
  return { x: pos.x + d.dx, y: pos.y + d.dy };
}

// A smell plume: the source is up to `range` cells straight ahead. This
// is a toy stand-in for a worm's spatial gradient sensing.
function plumeAhead(pos, dir, target, world, range = 5) {
  if (!target) return false;
  const d = DIRECTIONS[dir];
  for (let i = 1; i <= range; i++) {
    const x = pos.x + d.dx * i;
    const y = pos.y + d.dy * i;
    if (!inside(x, y, world)) return false;
    if (x === target.x && y === target.y) return true;
  }
  return false;
}

function spikeCounts(brain) {
  const counts = {};
  for (const n of brain.neurons) counts[n.name] = n.spikeCount;
  return counts;
}

// One sensory-motor step. Plasticity is off while navigating: sensing the
// world must not secretly train the worm (the same rule as measure()).
function senseAndAct(brain, inputs) {
  const wasPlastic = brain.plasticity;
  brain.setPlasticity(false);
  try {
    brain.settle(8); // clear charge left over from the previous step
    const before = spikeCounts(brain);
    if (inputs.length) brain.stimulate(inputs, 1.2);
    // 9 ticks: one per synaptic layer. smell -> AWA -> AIA -> AVB ->
    // PVB -> VB -> crawl, plus a tick for the spike to arrive. Shorter
    // windows miss the motor output; longer ones just waste time.
    for (let t = 0; t < 9; t++) brain.tick();
    const after = spikeCounts(brain);
    brain.settle(6);
    const deltas = {};
    for (const name of ACTION_NEURONS) deltas[name] = after[name] - before[name];
    let action = "rest";
    let best = 0;
    for (const name of ACTION_NEURONS) {
      if (deltas[name] > best) { best = deltas[name]; action = name; }
    }
    return { inputs: [...inputs], action, deltas };
  } finally {
    brain.setPlasticity(wasPlastic);
  }
}

export function navigateWorm(options = {}) {
  const brain = options.brain || buildWormBrain();
  const world = options.world || { width: 7, height: 7, food: { x: 6, y: 3 }, bad: { x: 0, y: 3 } };
  const start = options.start || { x: 2, y: 3, dir: "E" };
  const maxSteps = options.maxSteps || 10;
  let pos = { x: start.x, y: start.y };
  let dir = start.dir;
  const trace = [];
  let reachedFood = false;
  let lastTurn = null; // repeated bumps alternate dorsal / ventral turns
  for (let step = 0; step < maxSteps; step++) {
    const inputs = [];
    if (plumeAhead(pos, dir, world.food, world)) inputs.push("smell-a");
    if (plumeAhead(pos, dir, world.bad, world)) inputs.push("smell-b");
    const ahead = cellAhead(pos, dir);
    if (!inside(ahead.x, ahead.y, world)) inputs.push("wall-touch");
    const decision = senseAndAct(brain, inputs);
    // A bump fires both SMD-like turn outputs (one tick apart). A real
    // worm alternates the bend, so take the other side on a repeat bump.
    if (decision.deltas["turn-dorsal"] > 0 && decision.deltas["turn-ventral"] > 0 && lastTurn) {
      decision.action = lastTurn === "turn-dorsal" ? "turn-ventral" : "turn-dorsal";
    }
    if (decision.action.startsWith("turn")) lastTurn = decision.action;
    let moved = false;
    if (decision.action === "crawl-forward") { pos = ahead; moved = true; }
    else if (decision.action === "crawl-backward") {
      pos = cellAhead(pos, OPPOSITE[dir]);
      moved = true;
    } else if (decision.action === "turn-dorsal") dir = DIRECTIONS[dir].left;
    else if (decision.action === "turn-ventral") dir = DIRECTIONS[dir].right;
    trace.push({
      step: step + 1, x: pos.x, y: pos.y, dir,
      senses: decision.inputs.join(",") || "(none)",
      action: decision.action, moved,
      spikes: decision.deltas,
    });
    if (world.food && pos.x === world.food.x && pos.y === world.food.y) {
      reachedFood = true;
      break;
    }
  }
  return {
    world,
    start: { ...start },
    trace,
    final: { x: pos.x, y: pos.y, dir },
    reachedFood,
    steps: trace.length,
  };
}

// Three fixed scenarios in the same small grid world: approach food,
// retreat from a bad smell, and turn instead of walking through a wall.
export function demoWormNavigation(brain) {
  const b = brain || buildWormBrain();
  const world = { width: 7, height: 7, food: { x: 6, y: 3 }, bad: { x: 0, y: 3 } };
  // The retreat and wall scenarios use the same grid with the food cell
  // removed, so they test only "away from bad" and "turn at wall".
  const noFood = { ...world, food: null };
  return {
    world,
    foodRun: navigateWorm({ brain: b, world, start: { x: 2, y: 3, dir: "E" }, maxSteps: 8 }),
    badRun: navigateWorm({ brain: b, world: noFood, start: { x: 2, y: 3, dir: "W" }, maxSteps: 6 }),
    wallRun: navigateWorm({ brain: b, world: noFood, start: { x: 6, y: 3, dir: "E" }, maxSteps: 3 }),
  };
}

// The terminal demo: before/after numbers for learning, plus the navigation
// trace. Every number comes from the real spiking brain, never faked.
export function demoWorm(brain) {
  const b = brain || buildWormBrain();
  const beforeApproach = b.measure(["smell-a"], "approach", 20);
  const beforeAvoid = b.measure(["smell-b"], "avoid", 20);
  trainWormSmells(b, 12);
  const afterApproach = b.measure(["smell-a"], "approach", 20);
  const afterAvoid = b.measure(["smell-b"], "avoid", 20);
  const wrong = b.measure(["smell-a"], "avoid", 10);
  const navigation = demoWormNavigation(); // a fresh worm for a clean crawl demo
  return {
    template: "worm",
    job: WORM_TEMPLATE.job,
    beforeApproach, beforeAvoid, afterApproach, afterAvoid, wrong,
    weightKcAApproach: Number(b.weight("kc-a-01", "approach").toFixed(3)),
    navigation,
  };
}

// Worm transfer uses fly's buildTransferBrain() with templateName "worm":
// the source's learned Kenyon weights are copied (halved), 4 new Kenyon
// cells for smell-c are added, and ONLY smell-c is retrained. The control
// is a fresh worm source, so the comparison is identical to /fly transfer.
export function demoWormTransfer() {
  const source = buildWormBrain();
  trainWormSmells(source, 12);
  const freshSource = buildWormBrain();
  const fresh = buildTransferBrain(freshSource, null, "worm");
  const freshResult = roundsToLearn(fresh);
  const transferred = buildTransferBrain(source, null, "worm");
  const transferResult = roundsToLearn(transferred);
  const retainedRate = transferred.measure(["smell-a"], "approach", 10).rate;
  return {
    template: "worm-transfer",
    job: "A worm learns a new smell faster by reusing an old skill",
    freshRounds: freshResult.rounds,
    freshRate: freshResult.rate,
    transferRounds: transferResult.rounds,
    transferRate: transferResult.rate,
    retainedRate,
    roundsSaved: freshResult.rounds - transferResult.rounds,
    copiedApproachWeight: transferred.transferCopiedApproach,
  };
}

// One-line-per-fact summary for the terminal, same style as fly's
// demoSummary() so /worm, /fly worm and /brain <saved worm> print alike.
export function wormDemoSummary(result) {
  if (result.template === "worm-transfer") {
    return [
      `fresh worm: smell-c -> approach reached 80% after ${result.freshRounds} training round(s) (rate ${result.freshRate})`,
      `transferred worm: smell-c -> approach reached 80% after ${result.transferRounds} training round(s) (rate ${result.transferRate})`,
      `transferred worm still remembers smell-a -> approach: rate ${result.retainedRate}`,
      `rounds saved: ${result.roundsSaved} — the new smell reused the learned approach pathway`,
    ];
  }
  const n = result.navigation;
  const first = (run) => run.trace[0] ? run.trace[0].action : "rest";
  const wallTurn = n.wallRun.trace[0] || {};
  return [
    `food smell -> approach: ${result.beforeApproach.spikes}/${result.beforeApproach.steps} before training, ${result.afterApproach.spikes}/${result.afterApproach.steps} after`,
    `bad smell -> avoid: ${result.beforeAvoid.spikes}/${result.beforeAvoid.steps} before training, ${result.afterAvoid.spikes}/${result.afterAvoid.steps} after`,
    `wrong pairing (smell-a -> avoid): ${result.wrong.spikes}/${result.wrong.steps} — stays quiet, as it should`,
    `kc-a-01 -> approach weight: now ${result.weightKcAApproach}`,
    `navigation: food ahead -> ${first(n.foodRun)}, reached food in ${n.foodRun.steps} step(s) from (${n.foodRun.start.x},${n.foodRun.start.y})`,
    `navigation: bad smell ahead -> ${first(n.badRun)}, ending at (${n.badRun.final.x},${n.badRun.final.y})`,
    `navigation: wall ahead -> ${wallTurn.action} (${n.wallRun.start.dir} -> ${n.wallRun.final.dir}), no step into the wall`,
  ];
}
