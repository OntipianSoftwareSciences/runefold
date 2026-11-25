// Runefold Brain v0.1 + v0.2 — a tiny brain-like spiking neural core.
//
// What this is, in plain words:
//   A small network of fake neurons that talk to each other with SPIKES,
//   the way real brain cells do. A neuron sits quiet, its charge slowly
//   leaks away, and when enough charge arrives at once it fires one short
//   spike to the neurons it is connected to, then it needs a short rest.
//
// What this is NOT:
//   Not a real brain, not AGI, and it does NOT train the LLM weights in
//   Runefold (Ollama / Qwen). It is a toy network so Scarlet can see and
//   touch the ideas: spikes, Hebbian learning, and sleep. The big LLM
//   still does the talking; this brain is a separate, small experiment
//   living next to it.
//
// v0.2 change (and the ONLY change to the neuron model): the network is
// now generic. createBrain() still builds the original 12-neuron
// pink+puppy -> happy brain, exactly as before. createNetwork() builds
// ANY network — same neurons, same tick, same STDP, same sleep — from a
// list of neuron names and a list of connections. The fly templates in
// core/fly.js use createNetwork(), so there is still only ONE neuron
// model in Runefold, not two. If you change the neuron here, every
// template changes with it.
//
// No npm dependencies. Pure Node, ES module ("type": "module").
//
// ---------------------------------------------------------------------------
// The constants, explained in plain words:
// ---------------------------------------------------------------------------
// LEAK (0.85) — each tick, a neuron keeps 85% of its charge and loses 15%.
//   Like a leaky bucket: charge fades unless more keeps arriving. This is
//   why a neuron needs several inputs arriving close together to fire.
// THRESHOLD (1.0) — the charge level a neuron must reach to spike.
//   Below this it stays quiet. Above it, it fires once.
// RESET (0) — after a spike, charge goes back to 0. The neuron starts over.
// REFRACTORY_TICKS (2) — after spiking, a neuron rests for 2 ticks and
//   cannot spike again, even if input arrives. Real neurons do this too.
// SPIKE_STRENGTH (1.0) — how much charge one spike carries. The neuron on
//   the other end receives weight * SPIKE_STRENGTH, so a strong connection
//   (weight near 1) passes on almost the whole spike, a weak one passes
//   on almost nothing.
// STDP_WINDOW (5 ticks) — "just before" means within 5 ticks. If neuron A
//   spikes and neuron B spikes within 5 ticks after A, that counts as
//   A causing B, and the A->B connection gets stronger.
// LEARNING_RATE (0.03) — how much a connection changes in one learning
//   event. Small on purpose: a brain does not rewire itself in one go.
//   (The comment in v0.1 said 0.08; the code has always used 0.03.)
// MIN_WEIGHT / MAX_WEIGHT (0 / 1) — weights are clamped between 0 and 1.
//   A connection can never go negative, and never pass on more than a
//   full spike.
// TICK_MS (10) — we pretend one tick is 10 milliseconds, like a real
//   neuron's timescale. That is only used to report spikes per second.
// ---------------------------------------------------------------------------

export const LEAK = 0.85;
export const THRESHOLD = 1.0;
export const RESET = 0;
export const REFRACTORY_TICKS = 2;
export const SPIKE_STRENGTH = 1.0;
export const STDP_WINDOW = 5;
export const LEARNING_RATE = 0.03;
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 1;
export const TICK_MS = 10;

// The 12 neurons, in 3 layers. Names are the point: the demo association
// is "pink + puppy -> happy", so those names are real neurons here.
export const NEURON_NAMES = [
  "pink", "puppy", "music", "treat",       // 0-3  input layer
  "hidden-a", "hidden-b", "hidden-c", "hidden-d", // 4-7  hidden layer
  "happy", "calm", "excited", "sleepy",    // 8-11 output layer
];
export const LAYERS = {
  input: [0, 1, 2, 3],
  hidden: [4, 5, 6, 7],
  output: [8, 9, 10, 11],
};

// Deterministic starting weights: no randomness, so tests and demos
// give the same numbers every time. Feed-forward only: input -> hidden,
// hidden -> output. Weights start modest so the untrained brain is
// quiet and sparse, and training has room to make a difference.
// Input -> hidden starts a little stronger (0.35-0.55) so two inputs
// together can wake a hidden neuron; hidden -> output starts weaker
// (0.25-0.45) so the output only fires rarely before training.
function initialWeight(from, to) {
  const hiddenLayer = to >= 4 && to < 8;
  const base = hiddenLayer ? 0.35 : 0.25;
  return base + ((from * 7 + to * 3) % 5) * 0.05;
}

// ---------------------------------------------------------------------------
// createNetwork(names, connections, options) — the ONE neuron model.
//
// names: ["smell-a", "kc-01", ...] — every neuron, in order.
// connections: [{ from: "smell-a", to: "kc-01", weight: 1.0 }, ...]
//   `from`/`to` may be names or numeric ids. Weight defaults to 0.3.
//   `protected: true` marks a link as explicitly taught (sleep never
//   prunes it). Omit it for ordinary links.
// options: { layers: { "smell-a": "input", ... }, hidden: ["kc-01", ...],
//            input: [...], output: [...] }
//   Only `hidden` and `input` are used, by train(), to decide which
//   links to protect after teaching. If omitted, layers are guessed:
//   the first third of the neurons are "input", the middle third
//   "hidden", the last third "output". Guessing is fine for the fly
//   templates that pass an explicit list, and harmless otherwise.
// Returns the same brain object createBrain() always returned:
//   stimulate(), tick(), settle(), measure(), train(), sleep(),
//   getState(), weight(), plus .neurons, .connections, .neuronNames.
// ---------------------------------------------------------------------------
export function createNetwork(neuronNames, connectionSpecs = [], options = {}) {
  const names = [...neuronNames];
  const nameToId = new Map(names.map((n, i) => [n, i]));
  const layerOf = {};
  for (const n of names) {
    if (options.layers && options.layers[n]) layerOf[n] = options.layers[n];
    else if (options.input && options.input.includes(n)) layerOf[n] = "input";
    else if (options.hidden && options.hidden.includes(n)) layerOf[n] = "hidden";
    else if (options.output && options.output.includes(n)) layerOf[n] = "output";
    else layerOf[n] = "hidden"; // default middle layer
  }
  // If no layer info was given at all, split into thirds.
  if (!options.layers && !options.input && !options.hidden && !options.output) {
    const third = Math.max(1, Math.floor(names.length / 3));
    names.forEach((n, i) => {
      layerOf[n] = i < third ? "input" : i < names.length - third ? "hidden" : "output";
    });
  }
  const inputIds = new Set(names.filter((n) => layerOf[n] === "input").map((n) => nameToId.get(n)));
  const hiddenIds = new Set(names.filter((n) => layerOf[n] === "hidden").map((n) => nameToId.get(n)));

  const neurons = names.map((name, id) => ({
    id,
    name,
    layer: layerOf[name],
    v: 0,              // membrane potential (charge), 0 = empty
    refractory: 0,     // ticks left resting after a spike
    lastSpikeTick: -1000, // tick of the most recent spike (-1000 = never)
    spikeCount: 0,
    spikedThisTick: false,
  }));

  const connections = connectionSpecs.map((spec) => {
    const from = typeof spec.from === "number" ? spec.from : nameToId.get(spec.from);
    const to = typeof spec.to === "number" ? spec.to : nameToId.get(spec.to);
    if (from === undefined || to === undefined) {
      throw new Error(`Unknown neuron in connection: ${spec.from} -> ${spec.to}`);
    }
    return {
      from, to,
      weight: spec.weight === undefined ? 0.3 : spec.weight,
      protected: !!spec.protected,
      // fixed: a structural / teacher link that STDP must not change.
      // Example: reward -> approach in the mushroom body. If STDP were
      // allowed to strengthen it, the teacher would learn to trigger
      // the answer by itself, the answer would fire on the same tick as
      // the Kenyon cells, and the Kenyon cells would get no credit
      // (STDP needs cause strictly before effect) — learning stalls.
      // Fixed links still carry spikes; they just never change weight.
      fixed: !!spec.fixed,
      useCount: 0, totalUse: 0,
    };
  });
  const outgoing = new Map(); // from id -> [connection, ...]
  const incoming = new Map(); // to id -> [connection, ...]
  for (const c of connections) {
    if (!outgoing.has(c.from)) outgoing.set(c.from, []);
    if (!incoming.has(c.to)) incoming.set(c.to, []);
    outgoing.get(c.from).push(c);
    incoming.get(c.to).push(c);
  }

  let tick = 0;
  let totalSpikes = 0;
  // Plasticity on/off: learning (STDP) is ON normally, but measuring
  // must not change the brain — otherwise the test itself would train
  // it and "before" would already be "after". measure() freezes it.
  let plasticity = true;
  const externalInput = new Array(neurons.length).fill(0); // charge arriving this tick
  const pendingInput = new Array(neurons.length).fill(0); // charge spikes send onward, arriving NEXT tick (synaptic delay: a spike takes one tick to travel)
  const log = []; // short human-readable log of recent events

  function nameOf(idOrName) {
    if (typeof idOrName === "number") return names[idOrName];
    return idOrName;
  }
  function idOf(name) {
    const id = nameToId.get(name);
    if (id === undefined) throw new Error(`Unknown neuron: ${name}`);
    return id;
  }

  // Feed charge into one or more input neurons. Strength 1.2 is just
  // over the threshold (1.0), so a stimulated neuron spikes on the next
  // tick; strength 0.4 is well under it, so it stays quiet.
  function stimulate(inputNames, strength = 1.2) {
    const list = Array.isArray(inputNames) ? inputNames : [inputNames];
    for (const n of list) {
      const id = typeof n === "number" ? n : idOf(n);
      externalInput[id] += strength;
    }
    return brain;
  }

  // STDP / Hebbian learning, applied the moment a neuron spikes.
  // "Neurons that fire together, wire together" — more precisely:
  // if A spiked just BEFORE B, A probably helped cause B, so A->B
  // gets stronger. If B spiked just BEFORE A, the A->B link did not
  // help, so it gets weaker. Small steps, clamped to 0-1.
  function applyStdp(spikedId) {
    if (!plasticity) return;
    for (const c of incoming.get(spikedId) || []) {
      if (c.fixed) continue; // teacher / structural links never learn
      const dt = tick - neurons[c.from].lastSpikeTick;
      // dt must be >= 1: the cause has to spike strictly BEFORE the
      // effect. Same-tick firing is not a cause, it is a coincidence.
      if (dt >= 1 && dt <= STDP_WINDOW) {
        const change = LEARNING_RATE * (1 - dt / (STDP_WINDOW + 1));
        c.weight = Math.min(MAX_WEIGHT, c.weight + change);
      }
    }
    for (const c of outgoing.get(spikedId) || []) {
      if (c.fixed) continue;
      const dt = tick - neurons[c.to].lastSpikeTick;
      if (dt > 0 && dt <= STDP_WINDOW) {
        // Post (the target) spiked before pre: this link did not cause
        // it, so weaken it a little.
        const change = LEARNING_RATE * 0.5 * (1 - dt / (STDP_WINDOW + 1));
        c.weight = Math.max(MIN_WEIGHT, c.weight - change);
      }
    }
  }

  // One tick: leak, add input, check for spikes in layer order,
  // then rest. A spike takes one tick to travel: when a neuron fires,
  // its charge goes into pendingInput and only arrives at the next
  // neuron on the NEXT tick. That delay is what makes "A fired just
  // before B" a real, measurable thing for STDP.
  function tickFn() {
    tick++;
    const spikes = [];
    for (const n of neurons) n.spikedThisTick = false;
    for (const n of neurons) {
      if (n.refractory > 0) {
        n.refractory--;
        n.v = RESET;
        externalInput[n.id] = 0;
        continue;
      }
      // Leak first: keep 85% of the old charge, then add new input.
      n.v = n.v * LEAK + externalInput[n.id];
      externalInput[n.id] = 0;
      if (n.v >= THRESHOLD) {
        n.v = RESET;
        n.refractory = REFRACTORY_TICKS;
        n.lastSpikeTick = tick;
        n.spikeCount++;
        n.spikedThisTick = true;
        totalSpikes++;
        spikes.push(n.name);
        // Pass the spike on, arriving next tick.
        for (const c of outgoing.get(n.id) || []) {
          c.useCount++;
          c.totalUse++;
          pendingInput[c.to] += c.weight * SPIKE_STRENGTH;
        }
        applyStdp(n.id);
      }
    }
    // Deliver next tick's input.
    for (let i = 0; i < neurons.length; i++) {
      externalInput[i] += pendingInput[i];
      pendingInput[i] = 0;
    }
    return { tick, spikes, totalSpikes };
  }

  // Run several ticks with no new input (charge leaks away, spikes fade).
  function settle(steps = 3) {
    const all = [];
    for (let i = 0; i < steps; i++) all.push(tickFn());
    return all;
  }

  // Count how often `outputName` spikes when `inputNames` are stimulated.
  // Measured in trials, not in a relentless stream: each trial is one
  // burst of input, then 6 quiet ticks to let the spike travel
  // input -> hidden -> output and fade away. That is the honest
  // "before vs after" number: a rate per trial, not a yes/no.
  // Returns { spikes, steps, rate } where steps = number of trials.
  function measure(inputNames, outputName, steps = 20) {
    const outId = idOf(outputName);
    const before = neurons[outId].spikeCount;
    const wasPlastic = plasticity;
    plasticity = false; // measuring must not train the brain
    try {
      for (let i = 0; i < steps; i++) {
        stimulate(inputNames, 1.2);
        for (let t = 0; t < 6; t++) tickFn();
        settle(4); // let charge fade so trials do not bleed into each other
      }
    } finally {
      plasticity = wasPlastic;
    }
    // Rest after measuring: 10 quiet ticks, not 3. With only 3, charge
    // left in the output neuron from the last trial could push it over
    // threshold a tick early in the NEXT training round — same tick as
    // its inputs — and STDP needs the cause strictly before the effect,
    // so that round would teach nothing. (Found while building the fly
    // transfer test: learning stalled at weight 0.11 until this rest
    // was lengthened.) Measuring must leave the brain as it found it.
    settle(10);
    const spikes = neurons[outId].spikeCount - before;
    return { spikes, steps, rate: spikes / steps };
  }

  // Teach one association: "these inputs -> that output".
  // Each round, the inputs are stimulated until they spike, and then the
  // target output neuron is also stimulated (teacher forcing — like
  // showing the brain the right answer while the inputs are still fresh),
  // so STDP strengthens input -> hidden -> output links that fired in
  // the right order. Those links are marked protected: sleep will never
  // prune something that was explicitly taught.
  function train(inputNames, outputName, rounds = 12) {
    const outId = idOf(outputName);
    for (let r = 0; r < rounds; r++) {
      // Let the input spike travel: input fires, hidden fires a tick
      // later, and only then show the right answer (the output), so
      // STDP sees hidden just before output and strengthens that link.
      stimulate(inputNames, 1.2);
      tickFn(); tickFn(); tickFn();
      stimulate(outputName, 1.2);
      tickFn(); tickFn();
      settle(2);
      // Protect every link on the path that was actually used this round:
      // any link feeding the trained output, and any input -> hidden link.
      for (const c of connections) {
        if (c.useCount > 0 && (c.to === outId || (hiddenIds.has(c.to) && inputIds.has(c.from)))) {
          c.protected = true;
        }
      }
    }
    return getState();
  }

  // Sleep / consolidation: the brain tidies itself while it is quiet.
  // - Links used a lot recently get a little stronger (memory kept).
  // - Links never used recently fade a little (memory forgotten).
  // - Very weak, unprotected, unused links are pruned (weight -> 0).
  // - Protected links (explicitly taught) are never pruned, and barely
  //   fade. Nothing explicitly taught is silently deleted — same rule
  //   as Runefold's /consolidate.
  function sleep() {
    let strengthened = 0;
    let decayed = 0;
    let pruned = 0;
    for (const c of connections) {
      if (c.protected) {
        if (c.useCount > 0) {
          c.weight = Math.min(MAX_WEIGHT, c.weight + 0.02);
          strengthened++;
        } else {
          c.weight = Math.max(0.1, c.weight - 0.01); // barely fades, never dies
        }
      } else if (c.useCount >= 3) {
        c.weight = Math.min(MAX_WEIGHT, c.weight + 0.05);
        strengthened++;
      } else if (c.useCount === 0) {
        c.weight = Math.max(MIN_WEIGHT, c.weight - 0.08);
        decayed++;
        if (c.weight < 0.08) {
          c.weight = 0;
          pruned++;
        }
      }
      c.useCount = 0; // a new day starts after sleep
    }
    log.push(`sleep: strengthened ${strengthened}, decayed ${decayed}, pruned ${pruned}`);
    return { strengthened, decayed, pruned };
  }

  function getState() {
    const spikesPerTick = tick > 0 ? totalSpikes / tick : 0;
    return {
      tick,
      totalSpikes,
      // Spikes per second, pretending 1 tick = 10 ms (100 ticks/sec).
      // Sparse firing = low energy. A brain uses ~20 watts; an LLM
      // running on a GPU uses hundreds. This number is the proof.
      spikesPerTick,
      spikesPerSecond: spikesPerTick * (1000 / TICK_MS),
      neurons: neurons.map((n) => ({
        id: n.id, name: n.name, layer: n.layer,
        v: Number(n.v.toFixed(3)), spikedThisTick: n.spikedThisTick,
        spikeCount: n.spikeCount, refractory: n.refractory,
      })),
      connections: connections.map((c) => ({
        from: names[c.from], to: names[c.to],
        weight: Number(c.weight.toFixed(3)), protected: c.protected,
        fixed: c.fixed,
        useCount: c.useCount, totalUse: c.totalUse,
      })),
      log: [...log],
    };
  }

  function weight(from, to) {
    const c = connections.find(
      (x) => names[x.from] === nameOf(from) && names[x.to] === nameOf(to),
    );
    return c ? c.weight : 0;
  }

  const brain = {
    stimulate, tick: tickFn, settle, measure, train, sleep, getState, weight,
    neurons, connections, nameOf, idOf,
    neuronNames: names,
    setPlasticity: (v) => { plasticity = !!v; },
    get plasticity() { return plasticity; },
  };
  return brain;
}

// The original v0.1 brain, unchanged in behaviour: 12 neurons,
// input -> hidden -> output, deterministic starting weights.
export function createBrain() {
  const connections = [];
  for (const from of LAYERS.input) {
    for (const to of LAYERS.hidden) {
      connections.push({ from, to, weight: initialWeight(from, to) });
    }
  }
  for (const from of LAYERS.hidden) {
    for (const to of LAYERS.output) {
      connections.push({ from, to, weight: initialWeight(from, to) });
    }
  }
  return createNetwork(NEURON_NAMES, connections, {
    input: NEURON_NAMES.slice(0, 4),
    hidden: NEURON_NAMES.slice(4, 8),
    output: NEURON_NAMES.slice(8, 12),
  });
}

// A one-shot demo for the terminal (/brain): measure pink+puppy -> happy
// before training, train it, measure again, and print the numbers.
export function demoBrain() {
  const brain = createBrain();
  const before = brain.measure(["pink", "puppy"], "happy", 20);
  const weightBefore = brain.weight("hidden-a", "happy");
  brain.train(["pink", "puppy"], "happy", 12);
  const after = brain.measure(["pink", "puppy"], "happy", 20);
  const state = brain.getState();
  return {
    before, after,
    weightBefore: Number(weightBefore.toFixed(3)),
    weightAfter: state.connections.find((c) => c.from === "hidden-a" && c.to === "happy").weight,
    spikesPerSecond: Number(state.spikesPerSecond.toFixed(1)),
    totalSpikes: state.totalSpikes,
    ticks: state.tick,
  };
}
