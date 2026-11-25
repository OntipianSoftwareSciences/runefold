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
// Space and physics are REAL jobs now:
//   "tell me about black holes", "what is gravity?", the NASA picture and the
//   near-Earth asteroid list all map onto local jobs in core/space.js. The
//   answers work offline; Wikipedia/NASA are added only when reachable.
//   "who are you?" is still an honest local answer, not a built alien job.

import { checkKindness } from "./kindness.js";
import { SPACE_TOPICS, PHYSICS_KEYS } from "./space.js";

// The table is deliberately small and easy to add to. Add one object here:
//   phrases  — exact simple phrases (matched after lowercasing and trimming)
//   pattern  — a keyword pattern for a looser, medium-confidence match
//   command  — an EXISTING command in index.js (/space, /physics, ...)
//   args     — its existing arguments ("" for none)
// Order matters: the more specific rules come first, so "fly mushroom body"
// reaches /fly mushroom-body before the plain "fly" rule sees "fly".

// A bare word like "space" is not a question. Ask ONE thing, never guess.
const SPACE_QUESTION =
  "Which space question? Try: tell me about black holes, what is gravity?, " +
  "what is today's space picture?, or are any asteroids coming near Earth?";

// "Who are you?" is answered locally, and says honestly that a full answer
// about Runefold's identity is still coming next.
const COMING_NEXT_ALIEN =
  "Local knowledge — I'm Runefold, a local-first terminal assistant with a " +
  "tiny spiking-brain experiment. Ask 'what can you do?' to see what I can do now.";

// The four questions Scarlet asked for, plus the NASA jobs. These are exact
// phrases, so they are high-confidence and do not depend on a broad keyword.
const SPACE_QUESTION_RULES = [
  {
    id: "space-picture",
    phrases: [
      "what is today's space picture", "what is today’s space picture",
      "today's space picture", "today’s space picture", "space picture today",
    ],
    pattern: /\bspace picture\b|\bapod\b/i,
    command: "/apod", args: "", confidence: "high",
    source: "NASA APOD",
  },
  {
    id: "near-earth-asteroids",
    phrases: [
      "are any asteroids coming near earth", "any asteroids coming near earth",
      "asteroids coming near earth", "near earth asteroids", "near-earth asteroids",
    ],
    pattern: /\bnear[- ]earth asteroids?\b|\basteroids? coming near earth\b/i,
    command: "/asteroids", args: "", confidence: "high",
    source: "NASA NeoWs",
  },
  {
    id: "space-black-holes-question",
    phrases: ["tell me about black holes", "tell me about a black hole"],
    pattern: null,
    command: "/space", args: "black-hole", confidence: "high",
    source: "local knowledge + Wikipedia",
  },
  {
    id: "physics-gravity-question",
    phrases: ["what is gravity", "tell me about gravity", "explain gravity"],
    pattern: null,
    command: "/physics", args: "gravity", confidence: "high",
    source: "local knowledge + Wikipedia",
  },
  {
    id: "space-mars-question",
    phrases: ["tell me about mars", "what is mars"],
    pattern: null,
    command: "/space", args: "mars", confidence: "high",
    source: "local knowledge + Wikipedia",
  },
  {
    id: "space-too-vague",
    phrases: ["space", "tell me about space", "space facts"],
    pattern: /\bspace\b/i,
    command: null, args: "", confidence: "low",
    question: SPACE_QUESTION,
    source: "plain-text matcher",
  },
];

// One rule per local topic, built from the SAME topic objects core/space.js
// uses to answer. There is no second knowledge table here.
function aliasPattern(aliases) {
  const parts = aliases
    .map((a) => String(a).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return parts.length ? new RegExp(`\\b(${parts.join("|")})\\b`, "i") : null;
}

const TOPIC_RULES = SPACE_TOPICS.map((t) => {
  const command = PHYSICS_KEYS.has(t.key) ? "/physics" : "/space";
  return {
    id: `topic-${t.key}`,
    phrases: [t.key, ...t.aliases],
    pattern: aliasPattern(t.aliases),
    command,
    args: t.key,
    confidence: "medium",
    available: true,
    source: "local knowledge + Wikipedia when online",
  };
});

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
    // More specific than the plain "worm" rule: reuse the trained worm's
    // old skill so a new smell takes fewer rounds (the real transfer demo).
    id: "worm-transfer",
    phrases: [
      "show me how a worm learns a new smell faster", "worm learns a new smell faster",
      "can a worm learn a new smell faster", "can the worm learn a new smell faster",
      "worm transfer",
    ],
    pattern: /\bworm\b[^.]{0,60}\b(new smell|faster)\b/i,
    command: "/worm", args: "transfer", confidence: "medium",
  },
  {
    // Same for the fly: reuse an old skill instead of listing the templates.
    id: "fly-transfer",
    phrases: [
      "show me how a fly learns a new smell faster", "fly learns a new smell faster",
      "can the fly learn a new smell faster", "fly transfer",
    ],
    pattern: /\bfly\b[^.]{0,60}\b(new smell|faster)\b/i,
    command: "/fly", args: "transfer", confidence: "medium",
  },
  {
    // "Can the fly learn a new smell?" is the mushroom-body learning demo,
    // not just the template list. An exact phrase wins over the bare fly rule.
    id: "fly-learn-smell",
    phrases: ["can the fly learn a new smell", "can a fly learn a new smell", "fly learn a new smell"],
    pattern: null,
    command: "/fly", args: "mushroom-body", confidence: "high",
  },
  ...SPACE_QUESTION_RULES,
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

// The tiny note printed in the terminal for a matched line. Internal only:
// this is what the existing command switch still receives as a fallback.
export function heardAs(parsed) {
  return `${parsed.command || ""}${parsed.args ? " " + parsed.args : ""}`;
}

// What the USER sees in that note: the plain-text question they can type,
// never the internal /command. Mapping is by the SAME command + args that
// heardAs() builds, so /commands keep working while the wording stays plain.
const PLAIN_MEANINGS = {
  "/fly": "show me the fly",
  "/fly mushroom-body": "show me the mushroom body",
  "/fly worm": "show me the worm",
  "/fly worm-transfer": "show me how a worm learns a new smell faster",
  "/fly transfer": "show me how a fly learns a new smell faster",
  "/worm": "show me the worm",
  "/worm transfer": "show me how a worm learns a new smell faster",
  "/friends": "are the fly and worm friends?",
  "/friends train": "make them friends faster",
  "/brain": "show me the brain",
  "/kind": "what are your rules?",
  "/session": "what did you learn last time?",
  "/help": "what can you do?",
  "/apod": "what is today's space picture?",
  "/asteroids": "are any asteroids coming near Earth?",
  "/space black-hole": "tell me about black holes",
  "/physics gravity": "what is gravity?",
  "/space mars": "tell me about Mars",
};

export function plainTextMeaning(parsed) {
  const key = heardAs(parsed);
  if (PLAIN_MEANINGS[key]) return PLAIN_MEANINGS[key];
  const topic = String(parsed.args || "").replace(/-/g, " ");
  if (parsed.command === "/space" && topic) return `tell me about ${topic}`;
  if (parsed.command === "/physics" && topic) return `what is ${topic}?`;
  return parsed.args || "what you asked";
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

  // A vague match ("space" on its own) asks one question; it never runs a job.
  if (rule.question) {
    return result({
      confidence: "low",
      question: rule.question,
      route: "question",
      source: rule.source || "plain-text matcher",
    });
  }

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
    // Only "who are you?" is still an honest local reply, not a real job.
    out.route = "reply";
    const label = rule.id === "alien" ? "A full answer about me" : "That topic";
    out.note = `${label} is not built into this terminal yet — that is coming next. Source: ${rule.source}. ${rule.reply}`;
  }
  return out;
}
