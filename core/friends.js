// Runefold Brain v0.4 — "Fly Meets Worm": a friendship simulation.
//
// What this is, in plain words:
//   One small ASCII world. A fly with a mushroom-body brain and a worm with
//   a worm brain start far apart. Each tick they sense which way the other
//   one is (left / right / above / below) and how far away they are. At first
//   they are shy: they approach a little, back off, then approach again.
//   When they meet, nothing bad happens — the fly shares a honey drip
//   ("yum!"), and BOTH brains use the existing STDP training helper to learn
//   "that shape means friend". After a few friendly meetings they stay close
//   and the world says they are friends, with a little heart.
//
// Reuse — no second brain, no second ethics system:
//   * The fly is buildBrainFromTemplate("mushroom-body") from core/fly.js.
//   * The worm is buildBrainFromTemplate("worm") from core/worm.js's
//     registered template, also through fly's builder.
//   * Learning is trainAssociation() from core/fly.js — teacher forcing +
//     the SAME STDP the rest of Runefold uses. Nothing is reinvented here.
//   * Both builders already call assertKindTemplate() -> checkKindness()
//     in core/kindness.js. This world ALSO runs checkKindness() on its own
//     job before it builds anything, so a harmful job would be refused
//     before a single neuron existed.
//   * Decisions are read with stimulate()/tick() exactly like worm.js's
//     senseAndAct(): plasticity is switched OFF while reading the world, so
//     simply looking at a friend cannot secretly train the brain.
//
// What "friends" means in THIS simulation (say it plainly):
//   It means two measured numbers, not feelings. Each time they meet, one
//   round of ordinary STDP training strengthens the "friend smell ->
//   approach" link in each brain. When BOTH brains' learned kc-a-01 ->
//   approach weight has reached FRIEND_WEIGHT and they have shared honey at
//   least MIN_MEETINGS times, they are declared friends. After that they
//   hover / stay close instead of backing off. No pain, no fear, no harm,
//   no punishment signal, no escape circuit: only positive association.
//
// Deterministic: no randomness anywhere. Same inputs -> same trace, so the
// terminal demo and the tests print identical numbers every time.

import { buildBrainFromTemplate, trainAssociation } from "./fly.js";
import { checkKindness } from "./kindness.js";
// Importing worm.js registers the "worm" template with fly's ONE template
// system. The brain itself is still built with buildBrainFromTemplate().
import "./worm.js";

// The job string is deliberately about meeting and sharing. The kindness
// gate reads jobs, not internal neuron names (the mushroom body has an
// input called "punishment" in other demos; it is never used here).
export const FRIENDS_JOB =
  "Two toy brains meet, share honey, and learn a kind friend association";

export const FRIENDS_WIDTH = 20;
export const FRIENDS_HEIGHT = 12;
const GRASS_ROW = 9;
const FLOWERS = new Set(["3,10", "6,11", "11,10", "14,11"]);
const FLY_START = { x: 3, y: 2 };
const WORM_START = { x: 16, y: 10, dir: "W" };
const HONEYCOMB_X = FRIENDS_WIDTH - 1;
const HONEY_DRIP_XS = [17, 18];

const MEET_DISTANCE = 3;   // Manhattan distance <= 3 counts as a meeting
const HOLD_DISTANCE = 2;   // once friends, they settle this close
const MIN_MEETINGS = 2;    // at least two shared honey moments
const FRIEND_WEIGHT = 0.2; // both brains must have learned this much
const PRETRAIN_ROUNDS = 3; // used by /friends train
const DEFAULT_ROUNDS = 90;
const SHY_PAUSE_EVERY = 5; // before the first meeting, a periodic shy step back
const SHY_BACKOFF_TICKS = 2; // after a meeting, step back before meeting again
const SETTLE_AFTER_FRIENDSHIP = 5; // extra ticks so the end grid shows them close

const WORM_OUTPUTS = [
  "approach", "avoid", "crawl-forward", "crawl-backward",
  "turn-dorsal", "turn-ventral",
];

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stepToward(pos, dx, dy) {
  return {
    x: clamp(pos.x + dx, 0, FRIENDS_WIDTH - 1),
    y: clamp(pos.y + dy, 0, FRIENDS_HEIGHT - 1),
  };
}

// Read a brain's decision without learning from the world. This is the
// same shape as navigateWorm()'s senseAndAct() in core/worm.js: settle,
// stimulate the senses, let the spikes travel through the existing
// neurons, count output spikes, then rest. No new neuron model.
function readDecision(brain, inputs, outputs) {
  const wasPlastic = brain.plasticity;
  brain.setPlasticity(false);
  try {
    brain.settle(8); // clear charge left over from the previous tick
    const before = {};
    for (const n of brain.neurons) before[n.name] = n.spikeCount;
    if (inputs.length) brain.stimulate(inputs, 1.2);
    for (let t = 0; t < 9; t++) brain.tick();
    const after = {};
    for (const n of brain.neurons) after[n.name] = n.spikeCount;
    brain.settle(6);
    const deltas = {};
    for (const name of outputs) deltas[name] = after[name] - before[name];
    return deltas;
  } finally {
    brain.setPlasticity(wasPlastic);
  }
}

// The learned "this shape is a friend" weight in a brain. Both templates
// have the same Kenyon-cell pattern, so this one lookup works for both.
function friendWeight(brain) {
  return brain.weight("kc-a-01", "approach");
}

// Render the one shared world as ASCII: sky at the top, grass and flowers
// at the bottom, a honeycomb on the right, honey drips falling, F = fly,
// w = worm, * = honey drip / honey being carried, ♥ = friends.
export function renderFriendsWorld(world) {
  const rows = [];
  for (let y = 0; y < FRIENDS_HEIGHT; y++) {
    const cells = [];
    for (let x = 0; x < FRIENDS_WIDTH; x++) {
      if (y >= GRASS_ROW) cells.push(FLOWERS.has(`${x},${y}`) ? "y" : ",");
      else if (x === HONEYCOMB_X && y >= 2 && y <= 5) cells.push("H");
      else cells.push(" ");
    }
    rows.push(cells);
  }
  const put = (x, y, ch) => {
    if (x >= 0 && x < FRIENDS_WIDTH && y >= 0 && y < FRIENDS_HEIGHT) rows[y][x] = ch;
  };
  for (const drip of world.drips) put(drip.x, drip.y, "*");
  if (world.friends) {
    const hx = Math.round((world.fly.x + world.worm.x) / 2);
    const hy = Math.round((world.fly.y + world.worm.y) / 2) - 1;
    put(hx, hy, "♥");
  }
  put(world.fly.x, world.fly.y, "F");
  put(world.worm.x, world.worm.y, "w");
  if (world.carryingHoney) {
    // The fly brings the drip with it: show it just above the fly.
    put(world.fly.x, world.fly.y - 1, "*");
  }
  const border = "+" + "-".repeat(FRIENDS_WIDTH) + "+";
  return [border, ...rows.map((r) => "|" + r.join("") + "|"), border].join("\n");
}

// Build the world. preTrain: true is used by /friends train — it teaches
// both brains a few rounds BEFORE they meet, using the same trainAssociation
// helper. An untrained pair starts with weight 0.08 in each brain.
export function createFriendsWorld(options = {}) {
  // The kindness gate runs before any brain is built. The two template
  // builders repeat the same gate, so there is still only ONE ethics rule.
  const kindness = checkKindness(FRIENDS_JOB);
  if (!kindness.ok) throw new Error(kindness.reason);

  const flyBrain = buildBrainFromTemplate("mushroom-body");
  const wormBrain = buildBrainFromTemplate("worm");
  const world = {
    job: FRIENDS_JOB,
    kindness,
    width: FRIENDS_WIDTH,
    height: FRIENDS_HEIGHT,
    tick: 0,
    fly: { ...FLY_START },
    worm: { ...WORM_START },
    // Fixed falling pattern: no randomness. The drips recycle at the top
    // when they reach the grass, like a little honeycomb tap.
    drips: HONEY_DRIP_XS.map((x, i) => ({ x, y: 2 + i * 2 })),
    flyBrain,
    wormBrain,
    preTrained: !!options.preTrain,
    meetings: 0,
    honeyShared: 0,
    friends: false,
    meetingsToFriendship: null,
    distanceBefore: distance(FLY_START, WORM_START),
    distanceAfter: null,
    inContact: false,
    backoffTicks: 0,
    carryingHoney: false,
    lastSense: null,
    lastDecision: null,
    lastEvent: "the fly and the worm have not met yet",
    forwardMoves: 0,
    backwardMoves: 0,
    turnMoves: 0,
    backwardMovesAfterFriendship: 0,
    // These stay at zero by construction: this world has no pain, fear,
    // punishment or harm signals at all. Kept as counts so a test can say
    // "nothing bad happened" with a number, not just a comment.
    painSignals: 0,
    fearSignals: 0,
    harmfulEvents: 0,
    grids: {},
    trace: [],
  };

  if (world.preTrained) {
    // The SAME STDP lesson a meeting teaches, given in advance.
    // Fly: the worm's smell means approach.
    trainAssociation(flyBrain, ["smell-a", "reward"], "approach", PRETRAIN_ROUNDS);
    // Worm: the fly's smell means approach / stay, never crawl-backward.
    // The worm's approach -> avb (forward command) link is fixed in the
    // template, so this lesson strengthens the learned choice, not the
    // escape route. punishment/smell-b are never stimulated here.
    trainAssociation(wormBrain, ["smell-a", "reward"], "approach", PRETRAIN_ROUNDS);
  }
  return world;
}

// One tick of the shared world: sense, decide with the two existing brains,
// move, and (if they met) share honey and learn one friendly round.
export function stepFriendsWorld(world) {
  world.tick++;
  world.carryingHoney = false;

  // Sense the other one: direction and distance, both plain numbers.
  const dx = world.worm.x - world.fly.x;
  const dy = world.worm.y - world.fly.y;
  world.lastSense = {
    horizontal: dx > 0 ? "right" : dx < 0 ? "left" : "same",
    vertical: dy > 0 ? "below" : dy < 0 ? "above" : "same",
    distance: distance(world.fly, world.worm),
  };

  // Honey drips fall one row per tick and start again at the honeycomb.
  for (const drip of world.drips) {
    drip.y++;
    if (drip.y >= GRASS_ROW) drip.y = 2;
  }

  // "smell-a" is the friendly shape: the other animal. Only this input and
  // the reward teacher are ever used — no fear, no pain, no punishment.
  const flyChoice = readDecision(world.flyBrain, ["smell-a"], ["approach", "avoid"]);
  const wormChoice = readDecision(world.wormBrain, ["smell-a"], WORM_OUTPUTS);
  world.lastDecision = {
    flyApproach: flyChoice.approach,
    flyAvoid: flyChoice.avoid,
    wormForward: wormChoice["crawl-forward"] + wormChoice.approach,
    wormBackward: wormChoice["crawl-backward"] + wormChoice.avoid,
    wormTurn: wormChoice["turn-dorsal"] + wormChoice["turn-ventral"],
  };

  // Shyness. Before friendship: a periodic step back, and two more steps
  // back right after every meeting. They approach a little, back off, then
  // approach again — they never rush straight at each other.
  const shy = !world.friends &&
    (world.backoffTicks > 0 || world.tick % SHY_PAUSE_EVERY === 0);
  if (world.backoffTicks > 0) world.backoffTicks--;

  // The dominant axis is just geometry from the senses. The brain supplies
  // the choice to approach (learned, or quiet = curious); the world turns
  // that choice into up / down / left / right.
  const useX = Math.abs(dx) >= Math.abs(dy);
  const towardX = Math.sign(dx);
  const towardY = Math.sign(dy);
  const sign = shy ? -1 : 1;
  const settled = world.friends && world.lastSense.distance <= HOLD_DISTANCE;

  let flyMove = "hover";
  if (!settled) {
    if (useX && towardX !== 0) {
      world.fly = stepToward(world.fly, towardX * sign, 0);
      flyMove = shy ? "fly-away" : "fly-toward";
    } else if (towardY !== 0) {
      world.fly = stepToward(world.fly, 0, towardY * sign);
      flyMove = shy ? "fly-away" : "fly-toward";
    }
  }

  // The worm's outputs map to crawl-forward, crawl-backward and turns,
  // exactly as in core/worm.js's navigateWorm(). After learning, the
  // approach lesson means forward / stay — never backing away from a friend.
  let wormAction = "stay";
  if (!settled) {
    if (shy) {
      wormAction = "crawl-backward";
      // towardX / towardY point from the fly to the worm, so "away" is the
      // same sign for the worm and the opposite sign for the fly.
      if (useX && towardX !== 0) world.worm = stepToward(world.worm, towardX, 0);
      else if (towardY !== 0) world.worm = stepToward(world.worm, 0, towardY);
    } else if (wormChoice["turn-dorsal"] + wormChoice["turn-ventral"] > 0 &&
               wormChoice["crawl-forward"] === 0) {
      // A turn changes heading without moving into the other one.
      wormAction = wormChoice["turn-dorsal"] > 0 ? "turn-dorsal" : "turn-ventral";
      world.worm.dir = wormAction === "turn-dorsal"
        ? { N: "W", W: "S", S: "E", E: "N" }[world.worm.dir]
        : { N: "E", E: "S", S: "W", W: "N" }[world.worm.dir];
      world.turnMoves++;
    } else {
      wormAction = "crawl-forward";
      if (useX && towardX !== 0) world.worm = stepToward(world.worm, -towardX, 0);
      else if (towardY !== 0) world.worm = stepToward(world.worm, 0, -towardY);
      world.forwardMoves++;
    }
  }
  if (wormAction === "crawl-backward") {
    world.backwardMoves++;
    if (world.friends) world.backwardMovesAfterFriendship++;
  }

  // Did they meet? A little hysteresis (inContact) stops one long visit
  // being counted as five separate meetings: they must step apart first.
  const now = distance(world.fly, world.worm);
  if (now <= MEET_DISTANCE && !world.inContact) {
    world.inContact = true;
    world.meetings++;
    world.honeyShared++;
    world.carryingHoney = true;
    world.lastEvent = "yum! the fly shared a honey drip with the worm";

    // No bad thing happened, so both brains learn the friendly shape.
    // This is ordinary trainAssociation() (STDP), one round per meeting.
    trainAssociation(world.flyBrain, ["smell-a", "reward"], "approach", 1);
    trainAssociation(world.wormBrain, ["smell-a", "reward"], "approach", 1);

    if (!world.friends && world.meetings >= MIN_MEETINGS &&
        friendWeight(world.flyBrain) >= FRIEND_WEIGHT &&
        friendWeight(world.wormBrain) >= FRIEND_WEIGHT) {
      world.friends = true;
      world.meetingsToFriendship = world.meetings;
      world.lastEvent = "friends! ♥ they stay close and share honey";
    }
    if (!world.friends) world.backoffTicks = SHY_BACKOFF_TICKS;
  } else if (now > MEET_DISTANCE + 1) {
    world.inContact = false;
  }

  world.trace.push({
    tick: world.tick,
    sense: `${world.lastSense.horizontal}/${world.lastSense.vertical} d=${world.lastSense.distance}`,
    flyMove,
    wormAction,
    distance: now,
    meetings: world.meetings,
    honeyShared: world.honeyShared,
    friends: world.friends,
    event: world.lastEvent,
  });
  return world;
}

// Run the world for up to `rounds` ticks. It stops a few ticks after
// friendship so the end grid really shows them settled close together.
export function runFriendsWorld(options = {}) {
  const rounds = options.rounds || DEFAULT_ROUNDS;
  const world = createFriendsWorld(options);
  world.rounds = rounds;
  world.grids.start = renderFriendsWorld(world);
  const middleTick = Math.ceil(rounds / 2);
  let ticksAfterFriendship = 0;
  for (let i = 0; i < rounds; i++) {
    stepFriendsWorld(world);
    // The "middle" grid is the first honey-sharing meeting: far apart at
    // the start, meeting in the middle, friends at the end.
    if (!world.grids.middle && (world.meetings >= 1 || world.tick === middleTick)) {
      world.grids.middle = renderFriendsWorld(world);
    }
    if (world.friends) {
      ticksAfterFriendship++;
      if (ticksAfterFriendship >= SETTLE_AFTER_FRIENDSHIP) break;
    }
  }
  if (!world.grids.middle) world.grids.middle = renderFriendsWorld(world);
  world.grids.end = renderFriendsWorld(world);
  world.distanceAfter = distance(world.fly, world.worm);
  world.ticks = world.tick;
  world.kindnessPassed = world.kindness.ok && world.harmfulEvents === 0 &&
    world.painSignals === 0 && world.fearSignals === 0;
  return world;
}

// The numbers printed by /friends and used by the tests. No rounding that
// hides anything: these are the real counters from the real brains.
function summary(world) {
  return {
    distanceBefore: world.distanceBefore,
    distanceAfter: world.distanceAfter,
    meetings: world.meetings,
    meetingsToFriendship: world.meetingsToFriendship,
    honeyShared: world.honeyShared,
    friends: world.friends,
    ticks: world.ticks,
    grids: world.grids,
    flyWeight: Number(friendWeight(world.flyBrain).toFixed(3)),
    wormWeight: Number(friendWeight(world.wormBrain).toFixed(3)),
    backwardMoves: world.backwardMoves,
    backwardMovesAfterFriendship: world.backwardMovesAfterFriendship,
    forwardMoves: world.forwardMoves,
    turnMoves: world.turnMoves,
    kindnessPassed: world.kindnessPassed,
    world,
  };
}

// demoFriends() with before/after numbers. By default it runs one world.
// { trained: true } runs the pre-trained pair. { compare: true } runs both
// so the terminal can show that the trained pair needs fewer meetings.
export function demoFriends(options = {}) {
  const rounds = options.rounds || DEFAULT_ROUNDS;
  const untrained = summary(runFriendsWorld({ rounds, preTrain: false }));
  if (!options.compare && !options.trained) return untrained;
  const trained = summary(runFriendsWorld({ rounds, preTrain: true }));
  if (!options.compare) return trained;
  return {
    ...untrained,
    compare: true,
    untrained,
    trained,
    meetingsSaved: untrained.meetingsToFriendship - trained.meetingsToFriendship,
  };
}
