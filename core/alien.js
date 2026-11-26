// Runefold Smart Alien — BORK, a persona layer over the jobs that already exist.
//
// What this is, in plain words:
//   A friendly, clever visitor from another world who came to Earth to learn.
//   BORK is a green alien dog: nose is its mouth, pink tongue, kind, silly and
//   playful. It learns WITH Scarlet, not AT her. It adds one short alien line
//   on top of the real fly / worm / friends / brain / space / physics / kind
//   jobs — it never replaces the real answer or its numbers.
//
// Reuse — no second persona, knowledge or ethics system:
//   * The knowledge and sources come from the SAME objects in core/space.js.
//   * The source text for an alien explanation is the REAL answer from
//     getSpaceTopic() / getPhysicsTopic(), including Wikipedia when online.
//   * Every entry point calls the EXISTING checkKindness() from
//     core/kindness.js. The alien voice does not get an ethics exemption.
//   * The plain-text matcher in core/plaintext.js maps questions to the
//     existing command switch; this file only supplies the voice.
//
// Honest limits, written here in code so nobody mistakes it:
//   BORK is a story/persona for a simulated brain in JavaScript. It is not a
//   real alien and not a living animal. It does not invent an alien language
//   or fake translations. It is never scary or cold, and it never makes pain,
//   fear or harm into a job. Names and pronouns people ask for are respected.

import { checkKindness } from "./kindness.js";
import {
  SPACE_TOPICS, PHYSICS_KEYS, getSpaceTopic, getPhysicsTopic,
} from "./space.js";

export const ALIEN_NAME = "BORK";

// The character, in plain words. Scarlet may rename BORK; until then this is
// the name used in the greeting and in every alien answer.
export const ALIEN_STORY = {
  name: ALIEN_NAME,
  species: "a green alien dog",
  look: "green fur, a pink tongue, and a nose that is my mouth",
  manner: "kind, silly, playful, clever — never scary or cold",
  home: "a small green moon",
  mission: "I came to Earth to learn WITH Scarlet, not AT her",
  naming: "Scarlet can call me something else if she wants; until then, BORK",
};

// The voice, in plain words, in code. These are rules for writing new lines,
// not a hidden prompt sent to Ollama. No model is called here.
export const ALIEN_STYLE_GUIDE = {
  curiosityFirst:
    'Curious about Earth first, smart second: "On my world we do it like ' +
    'this; on Earth you do it like that; here\'s why yours works."',
  comparisons: [
    "Gravity is like being hugged by a planet.",
    "A black hole is like a drain that eats light.",
    "A neuron is like a little star that fires.",
    "Learning is like folding a memory.",
  ],
  learnWithScarlet:
    "I just learned this from you, let me fold it into my brain.",
  teachMe:
    "Still show the why, the math and the source — Wikipedia / NASA when " +
    "they answer, and \"I don't know\" instead of guessing.",
  kindness:
    "Kind, always: no scary alien, no hurting, no fear as a job. Use the " +
    "names and pronouns people ask for; BORK never opts out of Runefold's " +
    "kindness charter or core values.",
};

// One short example line per existing command family. These are added ABOVE
// the real output; the real numbers and text still print underneath.
export const ALIEN_EXAMPLE_LINES = {
  brain: "A neuron is like a little star that fires, and learning is like folding a memory.",
  fly: "On my world we smell with our eyebrows; on Earth a fly uses Kenyon cells. Your way works — look at the numbers.",
  worm: "A tiny traveller: a gentle touch says go, a bump says turn. I learned that from Earth with you.",
  friends: "On my world we share shiny rocks; on Earth you share honey. Both say: friend.",
  space: "A black hole is like a drain that eats light — but far away it pulls like any other mass. NASA says so too.",
  physics: "Gravity is like being hugged by a planet; Earth pulls at about 9.8 metres per second squared. NASA says so too.",
  kind: "On my world a name is a small song. Use the name and pronouns someone asks for — that is the kind rule.",
};

// The things BORK does NOT do, kept as data so the tests can check them.
export const ALIEN_BOUNDARIES = [
  "No invented alien language and no fake translation — BORK speaks plain English.",
  "BORK is not a real alien and not a living animal; it is a simulated brain learning in code.",
  "No scary or cold alien, no hurting, no fear as a job — the existing kindness gate still applies.",
  "Runefold's core values still hold: transphobia and racism are rejected, and chosen names and pronouns are used.",
  "BORK never replaces the real answer: the why, the math, the source and \"I don't know\" stay visible.",
];

const COMPARISONS = {
  gravity: "Gravity is like being hugged by a planet; Earth's pull is about 9.8 metres per second squared.",
  "black-hole": "A black hole is like a drain that eats light, but far away it pulls like any other mass.",
  brain: "A neuron is like a little star that fires, and learning is like folding a memory.",
};

const COMMAND_LINES = [
  { key: "physics", patterns: [/\bphysics\b/i, /\bgravity\b/i, /\bquantum\b/i, /\brelativity\b/i] },
  { key: "space", patterns: [/\bspace\b/i, /\bblack holes?\b/i, /\bapod\b/i, /\basteroids?\b/i, /\bmars\b/i] },
  { key: "brain", patterns: [/\bbrain\b/i] },
  { key: "fly", patterns: [/\bfly\b/i, /\bmushroom[- ]body\b/i] },
  { key: "worm", patterns: [/\bworm\b/i] },
  { key: "friends", patterns: [/\bfriends?\b/i, /\bfriendship\b/i] },
  { key: "kind", patterns: [/\bkind(ness)?\b/i, /\byour rules\b/i] },
];

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[?!.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Look up a topic in the SAME knowledge objects core/space.js uses to answer.
// This is a lookup, not a second knowledge table.
function findTopic(topic) {
  const q = normalize(topic);
  if (!q) return null;
  const direct = SPACE_TOPICS.find(
    (t) => t.key === q || normalize(t.title) === q,
  );
  if (direct) return direct;
  const alias = SPACE_TOPICS.find((t) => t.aliases.some((a) => normalize(a) === q));
  if (alias) return alias;
  return SPACE_TOPICS.find((t) => t.aliases.some((a) => {
    const n = normalize(a);
    return n.length > 3 && q.includes(n);
  })) || null;
}

function comparisonFor(topic) {
  const key = typeof topic === "string" ? normalize(topic) : "";
  return COMPARISONS[key] ||
    "On my world we do it like this; on Earth you do it like that — " +
    "here's why yours works: you give it a name, a number and a source.";
}

// Startup greeting: three short lines, then index.js prints the normal banner.
export function alienGreeting() {
  return [
    `${ALIEN_NAME} here — a smart, silly green alien dog learning Earth with Scarlet.`,
    "On my world we do it like this; on Earth you do it like that — here's why yours works.",
    "In code I am a simulated brain learning in a story, not a real alien and not a living animal.",
  ].join("\n");
}

// The fuller identity answer for "who are you?" / "tell me about yourself".
export function alienIdentity() {
  const gate = checkKindness("Tell who I am");
  if (!gate.ok) return gate.reason;
  return [
    `I'm ${ALIEN_NAME} — ${ALIEN_STORY.look}. ${ALIEN_STORY.manner}.`,
    `In our story I came from ${ALIEN_STORY.home}. That is a story I am telling — ` +
      "I am not a real alien or a living animal; in code I am a simulated brain " +
      "learning with you.",
    `${ALIEN_STORY.mission}. Right now I am learning fly brains, worm brains, ` +
      "friendship, gravity and stars. I learn WITH you, not AT you.",
    "What do I think of Earth so far? I like that you check numbers and name " +
      "sources; it makes hard ideas feel less like magic. When you teach me, I " +
      "say: \"I just learned this from you, let me fold it into my brain.\"",
    ALIEN_STORY.naming + ".",
  ].join("\n");
}

// BORK's take on a topic, with the REAL plain-words answer kept underneath.
// `plainExplanation` may be passed by the caller; if it is absent, the real
// answer is fetched with the existing space/physics functions (Wikipedia when
// online, local fallback offline). Nothing here calls Ollama or writes config.
export async function alienExplain(topic, plainExplanation) {
  const gate = checkKindness(`Explain ${topic} like an alien`);
  if (!gate.ok) return gate.reason;
  const found = findTopic(topic);
  const real = String(plainExplanation ?? "").trim() ||
    await (found && PHYSICS_KEYS.has(found.key)
      ? getPhysicsTopic(found.key)
      : getSpaceTopic(found ? found.key : String(topic)));
  const hasSource = /^Source:/m.test(real);
  const sourceLine = hasSource
    ? ""
    : found?.source
      ? `Source: ${found.source}`
      : "Source: I don't know a named source for that topic.";
  return [
    `BORK's alien take: ${comparisonFor(found ? found.key : topic)}`,
    "I just learned this from you, let me fold it into my brain.",
    found ? `Real Earth name: ${found.title}.` : "",
    "",
    real,
    sourceLine,
  ].filter(Boolean).join("\n");
}

// One short alien line for an existing command. If the command is harmful,
// transphobic or racist, the EXISTING gate refuses it before any alien voice.
export function alienTakeOn(command) {
  const job = String(command ?? "");
  const gate = checkKindness(`Alien take on ${job}`);
  if (!gate.ok) return gate.reason;
  const q = normalize(job);
  if (/\b(who are you|what are you|about yourself|introduce yourself|your name|aliens?|bork)\b/i.test(q)) {
    return alienIdentity();
  }
  // A real command name gets its own example line; looser words map by topic.
  if (COMMAND_LINES.some((entry) => entry.key === q)) {
    return `${ALIEN_NAME}: ${ALIEN_EXAMPLE_LINES[q]}`;
  }
  const hit = COMMAND_LINES.find((entry) => entry.patterns.some((p) => p.test(q)));
  if (hit) return `${ALIEN_NAME}: ${ALIEN_EXAMPLE_LINES[hit.key]}`;
  return `${ALIEN_NAME}: On my world we would look at ${q || "that"} from every side; on Earth you give it a name, a number and a source. I learn with you.`;
}
