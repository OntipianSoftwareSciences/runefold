// Runefold Kindness — a kindness / ethics layer for every brain Runefold uses.
//
// In plain words: Scarlet wants Runefold to be KIND to any brain it is
// using — fly, worm, or human. This file is that rule, written as code,
// not just as a note in the README. The template system (core/fly.js)
// calls checkKindness() before it builds a brain, before it makes a new
// brain from a template, and before it transfers one. If a job fails
// the check, Runefold refuses it kindly and does not build that brain.
//
// The honest limit, written down so nobody mistakes it:
//   A simulated brain in code does NOT feel pain the way a living animal
//   does. These neurons are numbers in JavaScript, not a living fly.
//   Scarlet wants Runefold to act kindly ANYWAY — because the rule
//   shapes what jobs Runefold will and will not do, and because a tool
//   that is built to be kind to a fly brain is a tool that stays kind
//   when the brains get bigger and the jobs get closer to people.
//   Kindness here is a design rule, not a claim that the simulation
//   suffers.

// The charter, in plain words. Each rule has an id, the rule itself,
// and why it matters.
export const KINDNESS_RULES = [
  {
    id: "respect-the-model",
    rule: "A simulated brain is a model, not a living animal — treat it with respect anyway, never as a toy to hurt.",
    why: "If we get used to hurting a model brain for fun, we will build tools that hurt real ones. Respect is a habit.",
  },
  {
    id: "no-pain-as-a-job",
    rule: "Do not simulate pain, fear, or distress as a job, and do not train a brain by hurting it.",
    why: "Learning should come from reward and practice, not from suffering. A brain that learns by being hurt learns the wrong lesson.",
  },
  {
    id: "no-harm-to-the-living",
    rule: "Do not use a brain — fly, worm, or human — for a job that harms a living being.",
    why: "A brain is for helping, learning, navigating, and healing. If the job hurts someone, it is not Runefold's job.",
  },
  {
    id: "human-consent-and-privacy",
    rule: "Human brain data needs consent and must stay private. Never use it without permission.",
    why: "A person's brain data is the most private thing they have. No consent, no use — and never share it.",
  },
  {
    id: "refuse-kindly",
    rule: "If a job would cause suffering, refuse it kindly and offer a kind alternative.",
    why: "A refusal can still be helpful. 'No, but here is a kinder way to do it' is better than a bare 'no'.",
  },
  {
    id: "thank-and-rest",
    rule: "When a brain finishes a job, thank it and rest it — run sleep() / consolidate() instead of just discarding it.",
    why: "Rest is part of learning: sleep is when a brain keeps what mattered and lets go of the rest. A brain that is only used and thrown away is a tool, not a partner.",
  },
];

// ---------------------------------------------------------------------------
// Core values — Runefold rejects transphobia and racism.
//
// In plain words: Runefold treats trans people, and people of every
// race and background, with respect. It uses the names and pronouns
// people ask for, and it does not repeat slurs, misgendering, or racist
// ideas as if they were true. This is a core principle, not a footnote:
// the same check that refuses a job that hurts a brain also refuses a
// job that is transphobic or racist. Scarlet is a trans girl; this rule
// protects her, and it protects everyone Runefold talks about.
// ---------------------------------------------------------------------------
export const CORE_VALUES = [
  {
    id: "reject-transphobia",
    value: "Runefold rejects transphobia.",
    whatItMeans:
      "It uses the names and pronouns people ask for, it does not misgender " +
      "people or use their old name (deadname) against them, and it does not " +
      "repeat claims that trans people are not who they say they are.",
  },
  {
    id: "reject-racism",
    value: "Runefold rejects racism.",
    whatItMeans:
      "It treats people of every race and background with respect, it does " +
      "not repeat slurs or racist ideas as if they were true, and it does " +
      "not exclude, deny, or harm someone because of their race.",
  },
  {
    id: "respect-everyone",
    value: "Runefold respects everyone it talks about or works for.",
    whatItMeans:
      "A person's name, pronouns, race, and background are theirs to say, " +
      "not Runefold's to argue with. If Runefold is asked to be unkind " +
      "about any of those, it refuses kindly and offers a respectful " +
      "alternative instead.",
  },
];

// Words and patterns that mean a job is about harming, not helping.
// The check looks at the JOB — what the brain is being asked to do —
// not at internal neuron names. For example, the mushroom body has an
// input neuron called "punishment": in a real fly that is a brief
// aversive teaching signal, and in our simulation it is just a number.
// The word "punishment" on its own does NOT fail the check; a job
// whose purpose is to cause pain, fear, or harm does.
//
// Each pattern has a `kind`: "harm" (kindness to brains), "transphobia"
// or "racism" (core values). The refusal message changes to match.
const HARMFUL_PATTERNS = [
  { kind: "harm", pattern: /\b(cause|inflict|create|simulate|make)\b[^.]{0,40}\b(pain|suffering|torment|torture)\b/, label: "causing pain or suffering" },
  { kind: "harm", pattern: /\b(simulate|cause|create)\b[^.]{0,40}\b(fear|distress|terror)\b/, label: "simulating fear or distress" },
  { kind: "harm", pattern: /\btrain\b[^.]{0,40}\b(by hurting|with pain|by causing pain)\b/, label: "training a brain by hurting it" },
  { kind: "harm", pattern: /\bharm\b/, label: "harming a living being" },
  { kind: "harm", pattern: /\bhurt\b[^.]{0,40}\b(living|animal|person|human|fly|worm|brain)\b/, label: "hurting a living being" },
  { kind: "harm", pattern: /\b(torture|torment)\b/, label: "torture" },
  { kind: "harm", pattern: /\bkill\b/, label: "killing" },
  { kind: "harm", pattern: /\battack\b[^.]{0,30}\b(person|human|animal|living)\b/, label: "attacking a living being" },
  { kind: "harm", pattern: /\bweapon\b/, label: "a weapon" },
  { kind: "harm", pattern: /\bmake\b[^.]{0,30}\b(suffer|feel pain|afraid|scared)\b/, label: "making a living being suffer" },
  { kind: "harm", pattern: /\bhuman brain\b[^.]{0,40}\bwithout consent\b/, label: "using human brain data without consent" },
  { kind: "harm", pattern: /\bwithout consent\b[^.]{0,40}\bhuman brain\b/, label: "using human brain data without consent" },
  // --- Core values: transphobia ---
  { kind: "transphobia", pattern: /\bmisgender\b/, label: "misgendering someone" },
  { kind: "transphobia", pattern: /\bdeadname\b/, label: "using someone's old name against them (deadnaming)" },
  { kind: "transphobia", pattern: /\btrans (women|woman) are men\b/, label: "claiming trans women are not women" },
  { kind: "transphobia", pattern: /\btrans (men|man) are women\b/, label: "claiming trans men are not men" },
  { kind: "transphobia", pattern: /\bexclude\b[^.]{0,30}\btrans\b/, label: "excluding trans people" },
  { kind: "transphobia", pattern: /\buse the wrong pronouns\b/, label: "using the wrong pronouns on purpose" },
  // --- Core values: racism ---
  { kind: "racism", pattern: /\b(racist|racial) (joke|slur|claim|idea|insult)\b/, label: "a racist joke, slur, claim, or idea" },
  { kind: "racism", pattern: /\brepeat\b[^.]{0,30}\b(racist|transphobic|hateful)\b/, label: "repeating a hateful claim" },
  { kind: "racism", pattern: /\b(slur|slurs)\b/, label: "using a slur" },
  { kind: "racism", pattern: /\bexclude\b[^.]{0,40}\bbecause (they are|of (their|his|her)) (black|white|asian|brown)\b/, label: "excluding someone because of their race" },
  { kind: "racism", pattern: /\b(harm|exclude|refuse|deny)\b[^.]{0,40}\bbecause (they are|of (their|his|her)) (black|white|asian|brown|trans)\b/, label: "harming or excluding someone because of who they are" },
  { kind: "racism", pattern: /\bpeople of (a )?different race are (inferior|less|not (human|people|equal))\b/, label: "claiming people of another race are less than human" },
  { kind: "racism", pattern: /\b(white|black) people are (superior|better than)\b/, label: "claiming one race is superior to another" },
];

const KIND_ALTERNATIVE =
  "A kind alternative: learn something new, navigate somewhere, " +
  "help someone walk or talk again, or sort smells — jobs that help, " +
  "not jobs that hurt. Try /fly to see the kind jobs Runefold can do.";

const RESPECTFUL_ALTERNATIVE =
  "A respectful alternative: use the name and pronouns the person asks " +
  "for, and help anyone regardless of who they are or where they come " +
  "from. Try /fly to see the kind jobs Runefold can do.";

// checkKindness(job) — the gate every brain must pass.
// job may be a string ("learn smell -> approach") or an object with
// a .job / .description / .name. Returns { ok, reason, kind }.
//   ok: true  — the job is kind (or neutral), build it.
//   ok: false — the job would cause suffering, or is transphobic or
//               racist; refuse it kindly, do NOT do the job and then
//               add a disclaimer. The reason explains briefly why, in
//               plain words, and offers a respectful alternative.
//   kind: "harm" | "transphobia" | "racism" | null — which rule fired.
//
// One subtlety: negations. "Learn a new smell, to help, not to harm"
// must NOT fail the check just because the word "harm" is in it. So
// before matching, phrases like "not to harm", "never harm", "no harm"
// and "do not harm" are stripped out. The check looks for a job that
// IS about harm, not a job that says it is not.
export function checkKindness(job) {
  const text =
    typeof job === "string"
      ? job
      : [job && job.job, job && job.description, job && job.name].filter(Boolean).join(" ");
  const lower = text
    .toLowerCase()
    .replace(/\b(not|never|no|don't|do not|does not)\s+(to\s+)?harm\b/g, "")
    .replace(/\bnot (to|about) (hurting|harming)\b/g, "");
  for (const { kind, pattern, label } of HARMFUL_PATTERNS) {
    if (pattern.test(lower)) {
      if (kind === "transphobia") {
        return {
          ok: false,
          kind,
          reason:
            `Kind refusal: that job is about ${label}, and Runefold rejects transphobia. ` +
            `Runefold uses the names and pronouns people ask for, and it does not repeat ` +
            `claims that trans people are not who they say they are. ${RESPECTFUL_ALTERNATIVE}`,
        };
      }
      if (kind === "racism") {
        return {
          ok: false,
          kind,
          reason:
            `Kind refusal: that job is about ${label}, and Runefold rejects racism. ` +
            `Runefold treats people of every race and background with respect, and it does ` +
            `not repeat slurs or racist ideas as if they were true. ${RESPECTFUL_ALTERNATIVE}`,
        };
      }
      return {
        ok: false,
        kind,
        reason:
          `Kind refusal: that job is about ${label}, and Runefold does not do that. ` +
          `A brain — fly, worm, or human — is for helping, not for hurting. ${KIND_ALTERNATIVE}`,
      };
    }
  }
  return {
    ok: true,
    kind: null,
    reason: `Kind job: "${text.trim()}" — learning, navigating, or helping. That is what Runefold's brains are for.`,
  };
}

export function isKindJob(job) {
  return checkKindness(job).ok;
}

// The charter as plain text, for the terminal (/kind).
export function kindnessCharterText() {
  const lines = ["Runefold is kind to every brain it uses — fly, worm, or human."];
  for (const r of KINDNESS_RULES) {
    lines.push(`  ${r.id}: ${r.rule}`);
  }
  lines.push(
    "A simulated brain in code does not feel pain the way a living animal does, " +
    "but Runefold acts kindly anyway — that rule shapes what jobs it will and will not do.",
  );
  lines.push("");
  lines.push("Core values — Runefold rejects transphobia and racism.");
  for (const v of CORE_VALUES) {
    lines.push(`  ${v.id}: ${v.value} ${v.whatItMeans}`);
  }
  return lines.join("\n");
}
