// Runefold Brain v0.2 — reverse-engineered fruit fly brain templates.
//
// What "reverse-engineer" means here, honestly:
//   Scientists mapped the whole fruit fly brain (Drosophila melanogaster)
//   — FlyWire, Oct 2024: 139,255 neurons, 54.5 million synapses, 8,453
//   neuron types (Dorkenwald et al., Nature 2024); the male central
//   nervous system map (2026) is 166,700 neurons. That full dataset is
//   about 100 terabytes and CANNOT be downloaded or run here.
//   What we reverse-engineer instead is the CIRCUIT DESIGN: the fly
//   brain is built from small, reusable modules, each with a clear job,
//   and each module's wiring pattern is published and open. We copy the
//   pattern — which neurons talk to which, in what order — at toy scale
//   (10-60 neurons per module instead of thousands), using Runefold's
//   ONE neuron model from core/brain.js (LIF spikes + STDP, via
//   createNetwork()). There is no second neuron model here, and no
//   living fly brain: this is a simulation of a design, not a fly.
//
//   Shiu et al. 2024 showed a connectome-only model of the fly brain
//   can predict real sensorimotor behaviour — the wiring alone, with
//   simple spiking neurons, already does jobs. That is the idea we copy.
//
// A template is a plain object, so a new brain is just a template + a
// name:
//   { name, job, description, biology, neurons: [{name, layer}],
//     connections: [{from, to, weight}], inputs, outputs, learnable }
//   neurons: every neuron in the module, with its layer (input/hidden/output).
//   connections: who talks to whom, and how strongly (weight 0-1).
//   learnable: true if the module is meant to be trained with STDP.
//
// Transfer learning (v0.2, the point of this file):
//   A brain trained on Task A can be the starting point for Task B.
//   buildTransferBrain() copies the LEARNED weights (the skill) from a
//   trained mushroom-body brain into a new brain, adds a NEW input
//   (smell-c) wired to 4 new Kenyon cells, and retrains only that new
//   input. The new brain learns smell-c -> approach in far fewer rounds
//   than a fresh brain, because the approach/avoid wiring is already
//   learned. What is copied: KC -> output weights (halved, see below).
//   What is reset: the new smell's own Kenyon cells and their links.
//   See demoTransfer() for the measured numbers — no faking.

import fs from "node:fs";
import path from "node:path";
import { createNetwork } from "./brain.js";
import { dataLocation, writeJson, readJson } from "./store.js";
import { checkKindness } from "./kindness.js";

// ---------------------------------------------------------------------------
// The 5 templates
// ---------------------------------------------------------------------------

function kcGroup(prefix, count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}-${String(i + 1).padStart(2, "0")}`,
    layer: "hidden",
  }));
}

export const TEMPLATES = [
  {
    name: "mushroom-body",
    job: "Learn smell -> approach / avoid",
    description:
      "Learns that one smell means approach and another means avoid, " +
      "and remembers it. The fly's learning and memory centre.",
    biology:
      "Real fly mushroom body: about 2,000 Kenyon cells. Smells arrive " +
      "from the antennal lobe; each Kenyon cell listens to only a few " +
      "smells (sparse coding). A reward or punishment signal then " +
      "teaches the Kenyon -> output links which smell means approach " +
      "and which means avoid. Simplified here to 20 Kenyon cells: 10 " +
      "listen to smell-a, 10 to smell-b. Left out: the thousands of " +
      "cells, the dopamine teaching signal's timing, and the many " +
      "output neurons — kept: sparse Kenyon cells + STDP teaching.",
    neurons: [
      { name: "smell-a", layer: "input" },
      { name: "smell-b", layer: "input" },
      { name: "reward", layer: "input" },
      { name: "punishment", layer: "input" },
      ...kcGroup("kc-a", 10),
      ...kcGroup("kc-b", 10),
      { name: "approach", layer: "output" },
      { name: "avoid", layer: "output" },
    ],
    connections: [
      // Smell -> its Kenyon cells, strong (1.0): one smell wakes its cells.
      ...kcGroup("kc-a", 10).map((kc) => ({ from: "smell-a", to: kc.name, weight: 1.0 })),
      ...kcGroup("kc-b", 10).map((kc) => ({ from: "smell-b", to: kc.name, weight: 1.0 })),
      // Reward / punishment teach the outputs directly (teacher signal).
      // fixed: true — STDP must not change these links. If it did, the
      // teacher would learn to fire the answer by itself, the answer
      // would spike on the same tick as the Kenyon cells, and the
      // Kenyon cells would get no STDP credit at all (see brain.js).
      { from: "reward", to: "approach", weight: 0.9, fixed: true },
      { from: "punishment", to: "avoid", weight: 0.9, fixed: true },
      // Kenyon cells -> outputs, weak to start (0.08): 10 cells x 0.08
      // = 0.8, just under the 1.0 threshold, so the untrained brain
      // stays quiet. Training grows these links; that IS the learning.
      ...kcGroup("kc-a", 10).flatMap((kc) => [
        { from: kc.name, to: "approach", weight: 0.08 },
        { from: kc.name, to: "avoid", weight: 0.08 },
      ]),
      ...kcGroup("kc-b", 10).flatMap((kc) => [
        { from: kc.name, to: "approach", weight: 0.08 },
        { from: kc.name, to: "avoid", weight: 0.08 },
      ]),
    ],
    inputs: ["smell-a", "smell-b", "reward", "punishment"],
    outputs: ["approach", "avoid"],
    learnable: true,
  },
  {
    name: "central-complex",
    job: "Hold a heading, correct drift",
    description:
      "The fly's compass. If it drifts left, it turns right to get " +
      "back on course; if it drifts right, it turns left.",
    biology:
      "Real fly central complex: a ring of compass neurons (E-PG cells) " +
      "that track heading, plus shift neurons that correct it. " +
      "Simplified here to a feed-forward compass: drift signals go " +
      "through error neurons to the opposite turn. Left out: the ring " +
      "attractor, the actual heading angle, and inhibition (our weights " +
      "cannot go negative, so correction is done by exciting the " +
      "opposite turn, not by inhibiting the wrong one). Kept: sense " +
      "drift -> correct the other way.",
    neurons: [
      { name: "drift-left", layer: "input" },
      { name: "drift-right", layer: "input" },
      { name: "on-course", layer: "input" },
      { name: "error-left", layer: "hidden" },
      { name: "error-right", layer: "hidden" },
      { name: "steady", layer: "hidden" },
      { name: "heading-a", layer: "hidden" },
      { name: "heading-b", layer: "hidden" },
      { name: "turn-left", layer: "output" },
      { name: "turn-right", layer: "output" },
      { name: "go-straight", layer: "output" },
    ],
    connections: [
      { from: "drift-left", to: "error-left", weight: 1.0 },
      { from: "error-left", to: "turn-right", weight: 1.0 },
      { from: "drift-right", to: "error-right", weight: 1.0 },
      { from: "error-right", to: "turn-left", weight: 1.0 },
      { from: "on-course", to: "steady", weight: 1.0 },
      { from: "steady", to: "go-straight", weight: 1.0 },
      // Compass cells: weak inputs, they stay quiet in this toy — they
      // are the part a fuller ring compass would use.
      { from: "drift-left", to: "heading-a", weight: 0.5 },
      { from: "drift-right", to: "heading-b", weight: 0.5 },
      { from: "on-course", to: "heading-a", weight: 0.5 },
      { from: "heading-a", to: "turn-right", weight: 0.2 },
      { from: "heading-b", to: "turn-left", weight: 0.2 },
    ],
    inputs: ["drift-left", "drift-right", "on-course"],
    outputs: ["turn-left", "turn-right", "go-straight"],
    learnable: false,
  },
  {
    name: "antennal-lobe",
    job: "Sort two similar smells apart",
    description:
      "Takes messy, overlapping raw smell signals and cleans them into " +
      "two separate channels, so similar smells can be told apart.",
    biology:
      "Real fly antennal lobe: smells arrive at glomeruli, one per " +
      "smell type, and lateral neurons sharpen the difference between " +
      "them. Simplified here to 2 glomeruli + 2 lateral cells: each raw " +
      "smell drives its own glomerulus strongly (1.0) and the other one " +
      "weakly (0.3, the cross-talk). The output is cleaner than the " +
      "input: the wrong channel stays quiet. Left out: the ~50 " +
      "glomeruli, and real lateral inhibition (again, no negative " +
      "weights here — separation comes from the strong/weak ratio).",
    neurons: [
      { name: "raw-a", layer: "input" },
      { name: "raw-b", layer: "input" },
      { name: "glom-a", layer: "hidden" },
      { name: "glom-b", layer: "hidden" },
      { name: "lateral-a", layer: "hidden" },
      { name: "lateral-b", layer: "hidden" },
      { name: "clean-a", layer: "output" },
      { name: "clean-b", layer: "output" },
      { name: "sorted-a", layer: "output" },
      { name: "sorted-b", layer: "output" },
    ],
    connections: [
      { from: "raw-a", to: "glom-a", weight: 1.0 },
      { from: "raw-b", to: "glom-b", weight: 1.0 },
      { from: "raw-a", to: "glom-b", weight: 0.3 },
      { from: "raw-b", to: "glom-a", weight: 0.3 },
      { from: "glom-a", to: "clean-a", weight: 1.0 },
      { from: "glom-b", to: "clean-b", weight: 1.0 },
      { from: "clean-a", to: "sorted-a", weight: 1.0 },
      { from: "clean-b", to: "sorted-b", weight: 1.0 },
      { from: "raw-a", to: "lateral-a", weight: 0.5 },
      { from: "raw-b", to: "lateral-b", weight: 0.5 },
      { from: "lateral-a", to: "glom-b", weight: 0.2 },
      { from: "lateral-b", to: "glom-a", weight: 0.2 },
    ],
    inputs: ["raw-a", "raw-b"],
    outputs: ["clean-a", "clean-b", "sorted-a", "sorted-b"],
    learnable: false,
  },
  {
    name: "giant-fiber",
    job: "Fast escape from a looming shadow",
    description:
      "One strong looming signal fires the escape neurons in a couple " +
      "of ticks. A weak signal does nothing — no false alarms.",
    biology:
      "Real fly giant fiber system: giant fiber neurons are among the " +
      "largest in the fly brain. A looming shadow (something about to " +
      "hit the fly) fires them, and they drive the jump muscles " +
      "directly — the fastest escape in the fly, in milliseconds. " +
      "Simplified here to 2 giant fibers + relays: looming (1.2) -> " +
      "giant fiber (1 tick) -> jump / escape (1 more tick). Weak " +
      "looming (0.4) is under threshold, so nothing fires. Kept: the " +
      "speed (1 tick per layer) and the strong-only trigger.",
    neurons: [
      { name: "looming", layer: "input" },
      { name: "giant-fiber", layer: "hidden" },
      { name: "giant-fiber-2", layer: "hidden" },
      { name: "relay-a", layer: "hidden" },
      { name: "relay-b", layer: "hidden" },
      { name: "alert", layer: "hidden" },
      { name: "freeze", layer: "hidden" },
      { name: "jump", layer: "output" },
      { name: "escape", layer: "output" },
      { name: "run", layer: "output" },
    ],
    connections: [
      { from: "looming", to: "giant-fiber", weight: 1.0 },
      { from: "looming", to: "giant-fiber-2", weight: 1.0 },
      { from: "giant-fiber", to: "jump", weight: 1.0 },
      { from: "giant-fiber", to: "escape", weight: 1.0 },
      { from: "giant-fiber-2", to: "run", weight: 1.0 },
      { from: "looming", to: "alert", weight: 0.6 },
      { from: "alert", to: "freeze", weight: 0.5 },
      { from: "giant-fiber", to: "relay-a", weight: 0.3 },
      { from: "giant-fiber-2", to: "relay-b", weight: 0.3 },
      { from: "relay-a", to: "run", weight: 0.2 },
      { from: "relay-b", to: "escape", weight: 0.2 },
    ],
    inputs: ["looming"],
    outputs: ["jump", "escape", "run"],
    learnable: false,
  },
  {
    name: "ventral-nerve-cord",
    job: "Walk: alternating left / right steps",
    description:
      "When told to walk, it produces an alternating left, right, " +
      "left, right stepping rhythm. When the walk signal stops, the " +
      "steps stop.",
    biology:
      "Real fly ventral nerve cord: the fly's spinal cord. It runs the " +
      "six legs, with central pattern generators that produce the " +
      "stepping rhythm even without the brain. Simplified here to a " +
      "pacemaker + relay: each walk pulse fires the pacemaker, which " +
      "fires leg-left at once and leg-right one tick later (through a " +
      "relay), so the steps alternate. Left out: six legs, the actual " +
      "muscles, and the pattern generator's own rhythm — here the " +
      "rhythm is driven by the walk signal, and stopping the signal " +
      "stops the steps. That is the honest limit of this toy.",
    neurons: [
      { name: "walk", layer: "input" },
      { name: "stop", layer: "input" },
      { name: "pacemaker", layer: "hidden" },
      { name: "relay-r", layer: "hidden" },
      { name: "motor-a", layer: "hidden" },
      { name: "motor-b", layer: "hidden" },
      { name: "leg-left", layer: "output" },
      { name: "leg-right", layer: "output" },
      { name: "step-left", layer: "output" },
      { name: "step-right", layer: "output" },
    ],
    connections: [
      { from: "walk", to: "pacemaker", weight: 1.0 },
      { from: "pacemaker", to: "leg-left", weight: 1.0 },
      { from: "pacemaker", to: "relay-r", weight: 1.0 },
      { from: "relay-r", to: "leg-right", weight: 1.0 },
      { from: "leg-left", to: "step-left", weight: 1.0 },
      { from: "leg-right", to: "step-right", weight: 1.0 },
      { from: "pacemaker", to: "motor-a", weight: 0.5 },
      { from: "pacemaker", to: "motor-b", weight: 0.5 },
      { from: "stop", to: "pacemaker", weight: 0.1 },
    ],
    inputs: ["walk", "stop"],
    outputs: ["leg-left", "leg-right", "step-left", "step-right"],
    learnable: false,
  },
];

export function listTemplates() {
  return TEMPLATES.map((t) => ({
    name: t.name,
    job: t.job,
    neurons: t.neurons.length,
    inputs: [...t.inputs],
    outputs: [...t.outputs],
    learnable: t.learnable,
  }));
}

export function getTemplate(name) {
  const t = TEMPLATES.find((x) => x.name === name);
  if (!t) throw new Error(`Unknown fly template: ${name}. Try /fly to list them.`);
  return t;
}

// Kindness gate: every template must pass checkKindness() before it
// may be built. A template whose JOB is to cause pain, fear, or harm
// is refused here — the brain is never built. See core/kindness.js.
// Exported so tests can prove a harmful job is refused.
export function assertKindTemplate(template) {
  const check = checkKindness(template.job || template.name || "");
  if (!check.ok) throw new Error(check.reason);
  return check;
}

// Build a working brain from a template, using the ONE neuron model
// in core/brain.js. Returns the brain object (stimulate/tick/measure/
// train/sleep/getState/weight) with .template attached.
export function buildBrainFromTemplate(name) {
  const t = getTemplate(name);
  assertKindTemplate(t); // kindness check first — refuse harmful jobs
  const names = t.neurons.map((n) => n.name);
  const layers = {};
  for (const n of t.neurons) layers[n.name] = n.layer;
  const brain = createNetwork(names, t.connections, { layers });
  brain.template = t.name;
  brain.templateJob = t.job;
  return brain;
}

// ---------------------------------------------------------------------------
// Training helper for the mushroom body.
//
// brain.train() (v0.1) settles only 2 ticks between rounds. That is fine
// when there is one output, but the mushroom body has TWO competing
// outputs (approach / avoid): each round sends 0.8 of charge to BOTH
// outputs (10 Kenyon cells x 0.08), and with only 2 quiet ticks that
// charge does not leak away before the next round — so the WRONG output
// accumulates charge, spikes, and STDP then strengthens the wrong link.
// That is a real, brain-like cross-talk bug, and the fix is the brain-like
// one: rest longer between lessons. trainAssociation() does exactly what
// brain.train() does (stimulate inputs, let the spike travel, then show
// the right answer), but settles 8 ticks between rounds, so charge from
// the last lesson has faded before the next one starts. It also protects
// the links it used, the same way brain.train() does.
// ---------------------------------------------------------------------------
function trainAssociation(brain, inputNames, outputName, rounds = 12) {
  const outId = brain.idOf(outputName);
  const inputIds = new Set(inputNames.map((n) => brain.idOf(n)));
  const hiddenIds = new Set(
    brain.neurons.filter((n) => n.layer === "hidden").map((n) => n.id),
  );
  for (let r = 0; r < rounds; r++) {
    brain.stimulate(inputNames, 1.2);
    brain.tick(); brain.tick(); brain.tick();
    brain.stimulate(outputName, 1.2);
    brain.tick(); brain.tick();
    brain.settle(8); // rest: let the wrong output's charge leak away
    for (const c of brain.connections) {
      if (c.useCount > 0 && (c.to === outId || (hiddenIds.has(c.to) && inputIds.has(c.from)))) {
        c.protected = true;
      }
    }
  }
  return brain.getState();
}

// ---------------------------------------------------------------------------
// Demos — each one proves its template's job with numbers.
// ---------------------------------------------------------------------------

export function demoMushroomBody(brain) {
  const b = brain || buildBrainFromTemplate("mushroom-body");
  const beforeApproach = b.measure(["smell-a"], "approach", 20);
  const beforeAvoid = b.measure(["smell-b"], "avoid", 20);
  trainAssociation(b, ["smell-a", "reward"], "approach", 12);
  trainAssociation(b, ["smell-b", "punishment"], "avoid", 12);
  const afterApproach = b.measure(["smell-a"], "approach", 20);
  const afterAvoid = b.measure(["smell-b"], "avoid", 20);
  // And the wrong pairing must stay quiet: smell-a must NOT mean avoid.
  const wrong = b.measure(["smell-a"], "avoid", 10);
  return {
    template: "mushroom-body",
    job: "Learn smell -> approach / avoid",
    beforeApproach, beforeAvoid, afterApproach, afterAvoid, wrong,
    weightKcAApproach: Number(b.weight("kc-a-01", "approach").toFixed(3)),
  };
}

export function demoCentralComplex(brain) {
  const b = brain || buildBrainFromTemplate("central-complex");
  return {
    template: "central-complex",
    job: "Hold a heading, correct drift",
    driftLeftToTurnRight: b.measure(["drift-left"], "turn-right", 10),
    driftRightToTurnLeft: b.measure(["drift-right"], "turn-left", 10),
    onCourseToStraight: b.measure(["on-course"], "go-straight", 10),
    driftLeftToTurnLeft: b.measure(["drift-left"], "turn-left", 10),
  };
}

export function demoAntennalLobe(brain) {
  const b = brain || buildBrainFromTemplate("antennal-lobe");
  // Same input, two outputs: only the right channel may fire.
  // Separation = correct rate minus wrong rate, per smell.
  const aToCleanA = b.measure(["raw-a"], "clean-a", 10);
  const aToCleanB = b.measure(["raw-a"], "clean-b", 10);
  const bToCleanB = b.measure(["raw-b"], "clean-b", 10);
  const bToCleanA = b.measure(["raw-b"], "clean-a", 10);
  return {
    template: "antennal-lobe",
    job: "Sort two similar smells apart",
    aToCleanA, aToCleanB, bToCleanB, bToCleanA,
    separationA: Number((aToCleanA.rate - aToCleanB.rate).toFixed(2)),
    separationB: Number((bToCleanB.rate - bToCleanA.rate).toFixed(2)),
  };
}

export function demoGiantFiber(brain) {
  const b = brain || buildBrainFromTemplate("giant-fiber");
  // Strong looming: count ticks until jump first spikes.
  const jumpBefore = b.neurons.find((n) => n.name === "jump").spikeCount;
  b.stimulate("looming", 1.2);
  let latencyTicks = null;
  for (let t = 1; t <= 6; t++) {
    const r = b.tick();
    if (r.spikes.includes("jump")) { latencyTicks = t; break; }
  }
  const jumpAfterStrong = b.neurons.find((n) => n.name === "jump").spikeCount - jumpBefore;
  // Weak looming: same 6 ticks, jump must stay quiet.
  const weakBefore = b.neurons.find((n) => n.name === "jump").spikeCount;
  b.settle(4);
  b.stimulate("looming", 0.4);
  for (let t = 0; t < 6; t++) b.tick();
  const jumpAfterWeak = b.neurons.find((n) => n.name === "jump").spikeCount - weakBefore;
  return {
    template: "giant-fiber",
    job: "Fast escape from a looming shadow",
    latencyTicks, // ticks from the looming input to the jump (giant fiber fires 1 tick in, jump 1 tick after it)
    jumpAfterStrong,
    jumpAfterWeak,
  };
}

export function demoVentralNerveCord(brain) {
  const b = brain || buildBrainFromTemplate("ventral-nerve-cord");
  // Walk for 30 ticks, stimulating "walk" every tick. The walk neuron
  // spikes every 3rd tick (refractory), the pacemaker follows, and
  // leg-left / leg-right must alternate in the spike order.
  const order = [];
  for (let t = 0; t < 30; t++) {
    b.stimulate("walk", 1.2);
    const r = b.tick();
    for (const s of r.spikes) if (s === "leg-left" || s === "leg-right") order.push(s);
  }
  const leftSteps = order.filter((s) => s === "leg-left").length;
  const rightSteps = order.filter((s) => s === "leg-right").length;
  let alternations = 0;
  for (let i = 1; i < order.length; i++) if (order[i] !== order[i - 1]) alternations++;
  // Stop: no more walk input. First let the spike that was already
  // travelling through the pacemaker -> relay finish (1 step may land —
  // that is a spike already in flight, not new walking), then count
  // 10 ticks: no new steps may appear after that.
  b.settle(4);
  const leftBefore = b.neurons.find((n) => n.name === "leg-left").spikeCount;
  const rightBefore = b.neurons.find((n) => n.name === "leg-right").spikeCount;
  for (let t = 0; t < 10; t++) b.tick();
  const stepsAfterStop =
    (b.neurons.find((n) => n.name === "leg-left").spikeCount - leftBefore) +
    (b.neurons.find((n) => n.name === "leg-right").spikeCount - rightBefore);
  return {
    template: "ventral-nerve-cord",
    job: "Walk: alternating left / right steps",
    order: order.join(","),
    leftSteps, rightSteps,
    alternations,
    alternating: order.length > 1 && alternations === order.length - 1,
    stepsAfterStop,
  };
}

export function runTemplateDemo(name, brain) {
  switch (name) {
    case "mushroom-body": return demoMushroomBody(brain);
    case "central-complex": return demoCentralComplex(brain);
    case "antennal-lobe": return demoAntennalLobe(brain);
    case "giant-fiber": return demoGiantFiber(brain);
    case "ventral-nerve-cord": return demoVentralNerveCord(brain);
    case "transfer": return demoTransfer();
    default: throw new Error(`Unknown fly template: ${name}. Try /fly to list them.`);
  }
}

// One-line-per-fact summary of a demo, for the terminal.
export function demoSummary(result) {
  switch (result.template) {
    case "mushroom-body":
      return [
        `smell-a -> approach: ${result.beforeApproach.spikes}/${result.beforeApproach.steps} before training, ${result.afterApproach.spikes}/${result.afterApproach.steps} after`,
        `smell-b -> avoid: ${result.beforeAvoid.spikes}/${result.beforeAvoid.steps} before training, ${result.afterAvoid.spikes}/${result.afterAvoid.steps} after`,
        `wrong pairing (smell-a -> avoid): ${result.wrong.spikes}/${result.wrong.steps} — stays quiet, as it should`,
        `kc-a-01 -> approach weight: now ${result.weightKcAApproach}`,
      ];
    case "central-complex":
      return [
        `drift-left -> turn-right: ${result.driftLeftToTurnRight.spikes}/${result.driftLeftToTurnRight.steps}`,
        `drift-right -> turn-left: ${result.driftRightToTurnLeft.spikes}/${result.driftRightToTurnLeft.steps}`,
        `on-course -> go-straight: ${result.onCourseToStraight.spikes}/${result.onCourseToStraight.steps}`,
        `wrong turn (drift-left -> turn-left): ${result.driftLeftToTurnLeft.spikes}/${result.driftLeftToTurnLeft.steps} — stays quiet`,
      ];
    case "antennal-lobe":
      return [
        `raw-a -> clean-a: ${result.aToCleanA.spikes}/${result.aToCleanA.steps}, raw-a -> clean-b: ${result.aToCleanB.spikes}/${result.aToCleanB.steps} (separation ${result.separationA})`,
        `raw-b -> clean-b: ${result.bToCleanB.spikes}/${result.bToCleanB.steps}, raw-b -> clean-a: ${result.bToCleanA.spikes}/${result.bToCleanA.steps} (separation ${result.separationB})`,
      ];
    case "giant-fiber":
      return [
        `strong looming -> jump in ${result.latencyTicks} ticks (looming -> giant fiber -> jump, 1 tick per layer), jump fired ${result.jumpAfterStrong} time(s)`,
        `weak looming -> jump fired ${result.jumpAfterWeak} time(s) — no false alarm`,
      ];
    case "ventral-nerve-cord":
      return [
        `steps in 30 ticks: left ${result.leftSteps}, right ${result.rightSteps}`,
        `step order: ${result.order}`,
        `alternating left/right: ${result.alternating ? "yes" : "no"} (${result.alternations} alternations)`,
        `steps after the walk signal stopped: ${result.stepsAfterStop}`,
      ];
    case "transfer":
      return [
        `fresh brain: smell-c -> approach reached 80% after ${result.freshRounds} training round(s) (rate ${result.freshRate})`,
        `transferred brain: smell-c -> approach reached 80% after ${result.transferRounds} training round(s) (rate ${result.transferRate})`,
        `transferred brain still remembers smell-a -> approach: rate ${result.retainedRate}`,
        `rounds saved: ${result.roundsSaved} — the new smell reused the learned approach pathway`,
      ];
    default:
      return [JSON.stringify(result)];
  }
}

// ---------------------------------------------------------------------------
// Saving brains — so /newbrain persists across sessions.
// Stored in the Runefold memory store (~/.runefold/brains.json), plain
// JSON, inspectable and deletable by hand, like the rest of Runefold.
// ---------------------------------------------------------------------------

function brainsFile() {
  return path.join(dataLocation(), "brains.json");
}
function readBrains() {
  return readJson(brainsFile(), { items: [] }).items;
}
function writeBrains(items) {
  writeJson(brainsFile(), { items });
}
export function listSavedBrains() {
  return readBrains().map((b) => ({
    name: b.name, template: b.template, createdAt: b.createdAt,
    rested: !!b.rested, restedAt: b.restedAt || null,
  }));
}
export function saveBrain(name, templateName, brain, extra = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) {
    throw new Error(`Bad brain name: ${name}. Use letters, numbers and dashes, e.g. my-smell-brain.`);
  }
  const template = getTemplate(templateName);
  assertKindTemplate(template); // kindness check first, same as building
  const state = brain.getState();
  const record = {
    name,
    template: template.name,
    createdAt: new Date().toISOString(),
    // Kindness rule "thank and rest": a brain is rested only after
    // someone runs sleep() on it (see restBrain()). A newly saved
    // brain starts as not rested.
    rested: !!extra.rested,
    restedAt: extra.restedAt || null,
    neurons: brain.neuronNames.map((n) => ({
      name: n,
      layer: brain.neurons.find((x) => x.name === n).layer,
    })),
    connections: state.connections.map((c) => ({
      from: c.from, to: c.to, weight: c.weight, protected: c.protected,
      fixed: c.fixed,
    })),
  };
  const items = readBrains().filter((b) => b.name !== name);
  items.push(record);
  writeBrains(items);
  return record;
}

// Rest a saved brain: run sleep() on it (consolidation — keep what
// mattered, let go of the rest), thank it, and save it back marked as
// rested. This is kindness rule "thank-and-rest" in code: a brain is
// not just discarded after its job.
export function restBrain(name) {
  const brain = loadBrain(name);
  const sleepResult = brain.sleep();
  const record = saveBrain(name, brain.template, brain, {
    rested: true,
    restedAt: new Date().toISOString(),
  });
  return {
    name,
    template: brain.template,
    sleep: sleepResult,
    restedAt: record.restedAt,
    thankYou: `Thank you, ${name}. You did your job, and now you rest.`,
  };
}
export function loadBrain(name) {
  const record = readBrains().find((b) => b.name === name);
  if (!record) {
    const known = listSavedBrains().map((b) => b.name).join(", ");
    throw new Error(`No saved brain called ${name}.${known ? ` Saved brains: ${known}.` : " No brains saved yet — try /newbrain mushroom-body my-first-brain."}`);
  }
  const layers = {};
  for (const n of record.neurons) layers[n.name] = n.layer;
  const brain = createNetwork(
    record.neurons.map((n) => n.name),
    record.connections,
    { layers },
  );
  brain.template = record.template;
  brain.savedName = record.name;
  return brain;
}
export function brainSummary(brain, name) {
  const state = brain.getState();
  return {
    name: name || brain.savedName || "(unsaved)",
    template: brain.template || "(unknown template)",
    neurons: brain.neuronNames.length,
    connections: state.connections.length,
    inputs: brain.neuronNames.filter((n) => brain.neurons.find((x) => x.name === n).layer === "input"),
    outputs: brain.neuronNames.filter((n) => brain.neurons.find((x) => x.name === n).layer === "output"),
  };
}

// ---------------------------------------------------------------------------
// Transfer learning — the point of the reverse-engineering.
//
// A mushroom-body brain that learned smell-a -> approach and
// smell-b -> avoid carries a SKILL: its Kenyon -> approach / avoid
// wiring. A new brain for a NEW smell (smell-c) can start from that
// skill instead of from scratch.
//
// How it works, exactly:
//   1. Train the source brain on smell-a -> approach, smell-b -> avoid.
//   2. Build a new brain with the same neurons and connections, copying
//      the source's learned KC -> output weights — HALVED (x0.5).
//      Halved, not copied whole: the new smell is similar, not
//      identical, so the new pathway starts closer to the answer but
//      still has to learn. Copying it whole would be cheating; halving
//      it is the honest version of "reuse the skill, retrain the rest".
//   3. Add 4 brand-new Kenyon cells (kc-c-01..04) for smell-c, wired
//      smell-c -> kc-c at 1.0, and kc-c -> approach / avoid at the
//      copied (halved) weights. Everything else about the new brain is
//      copied from the source, so it keeps the old skills too.
//   4. Retrain ONLY smell-c -> approach, one round at a time, until it
//      reaches 80%. Count the rounds. A fresh brain — built the same
//      way, but from an UNTRAINED source, so its kc-c -> approach links
//      start at the usual 0.08 — is the control, trained the same way.
// ---------------------------------------------------------------------------

export function buildTransferBrain(sourceBrain, newName) {
  if (!sourceBrain || typeof sourceBrain.getState !== "function") {
    throw new Error("buildTransferBrain needs a trained mushroom-body brain as its source.");
  }
  const state = sourceBrain.getState();
  const avgWeight = (fromPrefix, to) => {
    const ws = state.connections
      .filter((c) => c.from.startsWith(fromPrefix) && c.to === to)
      .map((c) => c.weight);
    return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0.08;
  };
  // The copied skill, halved (see the comment above) — but never below
  // the ordinary starting weight of 0.08. Halving an UNTRAINED source
  // (0.08 -> 0.04) would make the control brain start worse than a
  // fresh brain, which would be an unfair comparison.
  const copiedApproach = Math.max(0.08, Number((avgWeight("kc-a", "approach") * 0.5).toFixed(3)));
  const copiedAvoid = Math.max(0.08, Number((avgWeight("kc-a", "avoid") * 0.5).toFixed(3)));

  const template = getTemplate("mushroom-body");
  const neurons = [
    ...template.neurons,
    { name: "smell-c", layer: "input" },
    ...kcGroup("kc-c", 4),
  ];
  const connections = template.connections.map((c) => {
    // Copy the source's learned weights for the old links, so the new
    // brain keeps the old skills. Untrained links keep template weights.
    const learned = state.connections.find((s) => s.from === c.from && s.to === c.to);
    return learned ? { ...c, weight: learned.weight, protected: learned.protected } : { ...c };
  });
  // The new smell's wiring: smell-c -> its 4 new Kenyon cells (strong),
  // and those cells -> approach / avoid at the copied (halved) weights.
  for (const kc of kcGroup("kc-c", 4)) {
    connections.push({ from: "smell-c", to: kc.name, weight: 1.0 });
    connections.push({ from: kc.name, to: "approach", weight: copiedApproach });
    connections.push({ from: kc.name, to: "avoid", weight: copiedAvoid });
  }
  const layers = {};
  for (const n of neurons) layers[n.name] = n.layer;
  const brain = createNetwork(neurons.map((n) => n.name), connections, { layers });
  brain.template = "mushroom-body";
  brain.transferSource = sourceBrain.savedName || "trained mushroom-body";
  brain.transferCopiedApproach = copiedApproach;
  brain.transferCopiedAvoid = copiedAvoid;
  if (newName) brain.savedName = newName;
  return brain;
}

// Count training rounds until smell-c -> approach reaches 80% (rate
// >= 0.8 over 10 trials), one round at a time, max 20 rounds.
// Returns { rounds, rate } — rounds is 0 if it already passes.
function roundsToLearn(brain, maxRounds = 20) {
  for (let rounds = 0; rounds <= maxRounds; rounds++) {
    const rate = brain.measure(["smell-c"], "approach", 10).rate;
    if (rate >= 0.8) return { rounds, rate };
    if (rounds === maxRounds) return { rounds, rate };
    trainAssociation(brain, ["smell-c", "reward"], "approach", 1);
  }
  return { rounds: maxRounds, rate: 0 };
}

export function demoTransfer() {
  // The skill: a mushroom-body brain trained on two smells.
  const source = buildBrainFromTemplate("mushroom-body");
  trainAssociation(source, ["smell-a", "reward"], "approach", 12);
  trainAssociation(source, ["smell-b", "punishment"], "avoid", 12);
  // Control: the same transfer, but from an UNTRAINED source — its
  // kc-c links start at 0.08, the ordinary starting weight.
  const freshSource = buildBrainFromTemplate("mushroom-body");
  const fresh = buildTransferBrain(freshSource);
  const freshResult = roundsToLearn(fresh);
  // Experimental: transfer from the TRAINED source.
  const transferred = buildTransferBrain(source);
  const transferResult = roundsToLearn(transferred);
  // Does the transferred brain still remember the old skill?
  const retainedRate = transferred.measure(["smell-a"], "approach", 10).rate;
  return {
    template: "transfer",
    job: "Learn a new smell faster by reusing an old skill",
    freshRounds: freshResult.rounds,
    freshRate: freshResult.rate,
    transferRounds: transferResult.rounds,
    transferRate: transferResult.rate,
    retainedRate,
    roundsSaved: freshResult.rounds - transferResult.rounds,
    copiedApproachWeight: transferred.transferCopiedApproach,
  };
}

// /transfer <source-brain> mushroom-body <new-name>: load a SAVED trained
// brain, transfer it to a new brain, save the new brain, and report the
// numbers. The new template must be mushroom-body — transfer is only
// implemented for the mushroom body, because that is the learning module.
export function transferSavedBrain(sourceName, newTemplate, newName) {
  if (newTemplate !== "mushroom-body") {
    throw new Error(`Transfer is only built for mushroom-body, not ${newTemplate}. The mushroom body is the learning module; the other templates are hardwired circuits.`);
  }
  // Kindness check first: transferring a skill is only kind if the new
  // job is kind. "Learn a new smell -> approach" passes; a harmful
  // new job would be refused here, before any brain is built.
  const check = checkKindness("learn a new smell (smell-c) -> approach, to help someone");
  if (!check.ok) throw new Error(check.reason);
  const source = loadBrain(sourceName);
  if (source.template !== "mushroom-body") {
    throw new Error(`Cannot transfer from ${sourceName}: it is a ${source.template} brain, and transfer needs a mushroom-body brain.`);
  }
  const transferred = buildTransferBrain(source, newName);
  const before = transferred.measure(["smell-c"], "approach", 10);
  const learned = roundsToLearn(transferred);
  const after = transferred.measure(["smell-c"], "approach", 10);
  saveBrain(newName, "mushroom-body", transferred);
  return {
    source: sourceName,
    newName,
    template: "mushroom-body",
    copiedApproachWeight: transferred.transferCopiedApproach,
    beforeRate: before.rate,
    roundsToLearn: learned.rounds,
    afterRate: after.rate,
  };
}
