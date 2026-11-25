// Runefold plain text — "just talk to Runefold".
//
// What this is, in plain words:
//   A small, LOCAL, OFFLINE matcher. It takes a line Scarlet types WITHOUT a
//   leading / and maps it onto one of Runefold's EXISTING commands (/fly,
//   /worm, /friends, /brain, /kind, /session, /help, ...). There is no second
//   command system: every match is handed to the same command() switch in
//   index.js that the /commands already use. The /commands stay as the
//   fallback and never change.
//
// What this is NOT, honestly:
//   It does NOT understand all English. It is not a model, it does not call
//   Ollama, and it does not guess. It matches a short table of keywords and
//   simple phrases. When a line is unclear, it asks ONE question and waits.
//   When nothing in the table matches, it says "chat" so the line goes to
//   Ollama exactly as it did before — normal chat is not broken.
//
// Kindness gate:
//   Every plain-text line first goes through the EXISTING checkKindness()
//   from core/kindness.js. A harmful / transphobic / racist request is
//   refused kindly before any command runs — the same refusal a /command
//   would get. No second ethics rule was invented.
//
// Where /space and /physics and /alien do not exist yet:
//   The topic still maps to the intended command, but it is marked
//   available: false and given a local-knowledge note that says plainly
//   the command is coming next. Nothing is faked and no command is run.

import { checkKindness } from "./kindness.js";

// The table is deliberately small and easy to add to. Add one object here:
//   phrases  — exact simple phrases (matched after lowercasing and trimming)
//   pattern  — a keyword pattern for a looser, medium-confidence match
//   command  — an EXISTING command from index.js, never a new one
//   args     — its existing arguments ("" for none)
// Order matters: the more specific rules come first, so "fly mushroom body"
// reaches /fly mushroom-body before the plain "fly" rule sees "fly".
const TOPICS = [
  { topic: "black hole", pattern: /\bblack holes?\b/i, command: "/space" },
  { topic: "mars", pattern: /\bmars\b/i, command: "/space" },
  { topic: "moon", pattern: /\bmoon\b/i, command: "/space" },
  { topic: "planet", pattern: /\bplanets?\b/i, command: "/space" },
  { topic: "space", pattern: /\bspace\b/i, command: "/space" },
  { topic: "gravity", pattern: /\bgravity\b/i, command: "/physics" },
  { topic: "quantum", pattern: /\bquantum\b/i, command: "/physics" },
  { topic: "atom", pattern: /\batoms?\b/i, command: "/physics" },
];

// A tiny, honest local answer for the commands that are not built yet.
const COMING_NEXT_SPACE =
  "I can name the topic, but this offline terminal has no live reference so " +
  "I cannot verify the details here.";
const COMING_NEXT_ALIEN =
  "Local knowledge — I'm Runefold, a local-first terminal assistant with a " +
  "tiny spiking-brain experiment. /help shows what I can do now.";

const TOPIC_RULES = TOPICS.map((t) => ({
  id: `topic-${t.topic}`,
  phrases: [t.topic],
  pattern: t.pattern,
  command: t.command,
  args: t.topic,
  confidence: "medium",
  // /space and /physics are not in index.js yet. Say so; do not fake them.
  available: false,
  source: "local knowledge",
  reply: COMING_NEXT_SPACE,
}));

const RULES = [
  {
    id: "friends-train",
    phrases: [
      "train the friends", "train friends", "make them friends faster",
      "make the friends faster", "friends train", "train the fly and worm",
    ],
    pattern: /\b(train|faster|quicker)\b[^.]{0,40}\bfriends?\b|\bfriends?\b[^.]{0,40}\b(train|faster|quicker)\b/i,
    command: "/friends", args: "train", confidence: "medium",
  },
  {
    id: "friends",
    phrases: [
      "friends", "the friends", "friendship", "fly meets worm",
      "are they friends", "are the fly and worm friends", "are the fly and the worm friends",
      "show me the friends",
    ],
    pattern: /\bfriends?\b|\bfriendship\b|\bfly meets worm\b/i,
    command: "/friends", args: "", confidence: "medium",
  },
  {
    id: "mushroom-body",
    phrases: [
      "fly mushroom body", "mushroom body", "mushroom-body",
      "the mushroom body", "show me the mushroom body",
    ],
    pattern: /\bmushroom[- ]body\b/i,
    command: "/fly", args: "mushroom-body", confidence: "medium",
  },
  ...TOPIC_RULES,
  {
    id: "alien",
    phrases: [
      "alien", "aliens", "who are you", "what are you",
      "tell me about yourself", "introduce yourself", "your name",
    ],
    pattern: /\balien(s)?\b|\bwho are you\b|\babout yourself\b|\bwhat are you\b/i,
    command: "/alien", args: "", confidence: "medium",
    // /alien is not in index.js yet. Answer locally and say so.
    available: false,
    source: "local knowledge",
    reply: COMING_NEXT_ALIEN,
  },
  {
    id: "kind",
    // Bare "kind" is only an EXACT phrase, on purpose: "kind of" in normal
    // chat must stay chat and go to Ollama.
    phrases: ["kind", "be kind", "kindness", "what are your rules", "your rules", "the rules"],
    pattern: /\bkindness\b|\bbe kind\b|\byour rules\b/i,
    command: "/kind", args: "", confidence: "medium",
  },
  {
    id: "worm",
    phrases: [
      "worm", "the worm", "show me the worm", "run the worm",
      "worm brain", "worm demo",
    ],
    pattern: /\bworms?\b/i,
    command: "/worm", args: "", confidence: "medium",
  },
  {
    id: "fly",
    phrases: [
      "fly", "the fly", "show me the fly", "run the fly",
      "run the fly brain", "fly brain", "fly demo",
    ],
    pattern: /\bflies\b|\bfly\b/i,
    command: "/fly", args: "", confidence: "medium",
  },
  {
    id: "brain",
    phrases: ["brain", "the brain", "show me the brain", "run the brain", "brain demo"],
    pattern: /\bbrain\b/i,
    command: "/brain", args: "", confidence: "medium",
  },
  {
    id: "session",
    phrases: [
      "session", "what did you learn", "what have you learned",
      "what did we learn", "learning summary",
    ],
    pattern: /\bwhat did you learn\b|\bwhat have you learned\b/i,
    command: "/session", args: "", confidence: "medium",
  },
  {
    id: "help",
    // No broad pattern: "can you help me debug this function" is code chat,
    // not the /help command. Only the exact short phrases below match.
    phrases: [
      "help", "what can you do", "commands", "what commands",
      "list commands", "show commands",
    ],
    pattern: null,
    command: "/help", args: "", confidence: "high",
  },
];

// A generic little word, or an unfinished "show me", is not a topic. Ask.
const UNCLEAR_PATTERN =
  /^(thing|things|stuff|something|it|that|this|one|demo|show me|tell me|tell me about|what|huh|whatever)$/i;

const UNCLEAR_QUESTION =
  "Did you mean the fly, the worm, or the friends? Tell me which one and I'll run it.";

function normalize(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/g, "")
    .trim()
    .toLowerCase();
}

function result(overrides) {
  return {
    command: null,
    args: "",
    confidence: "none",
    question: null,
    route: "chat",
    source: null,
    available: false,
    ...overrides,
  };
}

function askOneQuestion() {
  return result({
    confidence: "low",
    question: UNCLEAR_QUESTION,
    route: "question",
    source: "plain-text matcher",
  });
}

// The tiny note printed in the terminal for a matched line.
export function heardAs(parsed) {
  return `${parsed.command || ""}${parsed.args ? " " + parsed.args : ""}`;
}

// parsePlainText(text) -> { command, args, confidence, question }
//   plus `route`, `source`, `available`, `note` / `refusal` for the wiring.
//   route: "command" (run it) | "question" (wait) | "chat" (Ollama)
//          | "reply" (honest local answer, no command exists yet)
//          | "refusal" (kindness gate said no).
export function parsePlainText(text) {
  const raw = String(text ?? "");

  // Kindness gate FIRST — before matching, before any job could run.
  const kindness = checkKindness(raw);
  if (!kindness.ok) {
    return result({
      confidence: "high",
      route: "refusal",
      refusal: kindness.reason,
      source: "core/kindness.js — checkKindness()",
    });
  }

  const normalized = normalize(raw);
  if (!normalized) return result({});

  const phraseHits = RULES.filter((r) => r.phrases && r.phrases.includes(normalized));
  const patternHits = phraseHits.length
    ? phraseHits
    : RULES.filter((r) => r.pattern && r.pattern.test(normalized));

  // No match at all: leave the line alone for Ollama.
  if (!patternHits.length) {
    return UNCLEAR_PATTERN.test(normalized) ? askOneQuestion() : result({});
  }

  // Two different commands in one line means we are not sure. Ask, never guess.
  if (new Set(patternHits.map((r) => r.id)).size > 1) return askOneQuestion();

  const rule = patternHits[0];
  const out = result({
    command: rule.command,
    args: rule.args || "",
    // Exact simple phrases are high; a looser keyword is medium. Both run.
    confidence: phraseHits.length ? "high" : (rule.confidence || "medium"),
    route: "command",
    source: rule.source || "plain-text matcher",
    available: rule.available !== false,
  });

  if (!out.available) {
    // /space, /physics and /alien are not built yet. Say so; run nothing.
    out.route = "reply";
    out.note = `${rule.command} is not built yet — that is coming next. Source: ${rule.source}. ${rule.reply}`;
  }
  return out;
}
