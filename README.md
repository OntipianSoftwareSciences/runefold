# Runefold AI — Adaptive Core 0.6.1

## What's new in 0.6.1 — CodeForge v0.1 (the smallest useful next step)

Runefold could read, plan, and criticise, but it could not *write* code —
so it could not actually build software. That is now fixed, safely:

- `/write <file>` — paste content, end with a line `END`, preview the
  first 20 lines, confirm with `y`. Overwriting an existing file first
  copies it to `<file>.bak`.
- `/edit <file> | <old text> | <new text>` — replaces exactly one match.
  If the old text is missing, or found more than once, it refuses and
  tells you to be more specific. Preview + confirm first, backup to `.bak`.
- `/run` allow-list is now a prefix, not an exact string: `node --test`
  in `config.json` now allows `node --test test.js`, `node --check`
  allows `node --check file.js`. Other commands are still blocked.
  Arguments are split respecting quotes, and still run via `execFile`,
  never a shell.

Safety, as before: paths cannot escape the project root, no deletes,
no file over 200k chars, no silent overwrite. The terminal always asks
before a write lands.

A terminal-first JavaScript assistant with persistent, inspectable learning.
Upgraded from 0.5 with smartest-reasoning changes, not just more commands.

## What's actually new in 0.6 — and why it matters

**1. Retrieval that ranks (core/retrieval.js)**
0.5 asked "does this word appear?" 0.6 uses TF-IDF + cosine similarity,
recency decay (30-day half-life), and a confidence weight. Ask `/search <query>`
and you can *see* the scores. No embeddings server needed, and no pretending
it understands meaning — it matches words, well.

**2. Memory with confidence, not certainty (core/learning.js)**
Every memory starts at confidence 0.6. Confirmation raises it, contradiction
lowers the old one and keeps both visible. `/consolidate` is the "sleep" step:
old, low-confidence, never-used memories decay, near-duplicates merge.
Nothing you taught explicitly is silently deleted.

**3. Plan → Act → Critic (core/agent.js)**
`/plan <task>` breaks a task into testable steps.
`/think <task>` answers, then criticises its own draft, then revises once.
That loop is the core of an agent that improves — a bigger model alone isn't.

**4. Safe tools (core/tools.js)**
`/read`, `/find`, and `/run` for allow-listed checks only (`node --check`,
`node --test` by default). Read-only by default, no shell, no deletes,
paths cannot escape the project folder. Add a command to
`config.json → tools.allowRun` only if you trust it.

**5. Goals, journal, skill promotion**
`/goal <text> | <step1; step2>` — a durable intention with steps.
Repeated success (3x on the same kind of task) drafts a reusable skill.
`/journal` shows what the agent actually did, in order.

**6. Reliability**
Atomic writes + `.bak` backup in `core/store.js`, so a crash mid-save
cannot wipe `memory.json`. Provider retries (3x) with a 120s timeout,
and history is trimmed by character budget instead of growing forever.

## Install
1. Node.js 18+ — https://nodejs.org/
2. Ollama — https://ollama.com/
3. `ollama pull qwen2.5-coder:3b`
4. In PowerShell, in this folder: `node index.js`
5. Check it: `node --test` and `node index.js --doctor`

No npm packages required.

## Commands
- `/teach`, `/memory`, `/forget`, `/consolidate`, `/feedback`, `/experience`
- `/skill`, `/skills`, `/goal`, `/goals`, `/search`, `/journal`
- `/plan`, `/think`, `/read`, `/find`, `/run`
- `/write`, `/edit` — CodeForge v0.1, see above
- `/autolearn on|off`, `/status`, `/help`, `/exit`

## Where learning is stored
`%USERPROFILE%\.runefold\` — `memory.json`, `experiences.jsonl`,
`skills.json`, `goals.json`, `journal.jsonl`. Plain text, inspectable,
back up or delete by hand.

## The honest AGI note — please read this

This does **not** train model weights, and it does **not** become a general
AI by running it. The model underneath (Qwen, Gemma, etc.) is still a
next-token predictor. What 0.6 adds is the *scaffolding* real agents use:
memory, retrieval, planning, self-critique, tools, goals, and learning
from outcomes.

That scaffolding is the right direction, and it's how you learn the
ideas that matter for AGI. The path from here, in order, would be:
1. **Better retrieval** — real embeddings (Ollama `nomic-embed-text`)
   behind the same `search()` interface in `core/retrieval.js`.
2. **Better world model** — let the agent keep a structured model of
   a project (files, tests, what changed) instead of only chat text.
3. **Longer-horizon planning** — goals that span days, with the agent
   checking its own progress and asking for help when stuck.
4. **Evaluation** — a test suite the agent runs on itself, so "I got
   better" is measured, not felt.
5. **Weight training — much later, and not on this PC** — fine-tuning
   a small model needs a GPU, a clean dataset, and careful evaluation.
   Do not try it on an 8GB CPU machine; it will be slow and the result
   will usually be worse than the base model.

Keep Big Pickle / a strong cloud model for hard jobs, use this local
core to learn how agents think. That split — strong teacher outside,
small learner inside — is exactly how you get smarter without
pretending the small model already is general AI.

## Safety boundary
No autonomous shell, no file edits, no API keys in chat or in files.
Secrets and health details are filtered from memory — review `/memory`
and use `/forget` whenever needed.

## Runefold Brain v0.1 — a tiny brain-like spiking core

Runefold's chatbot runs on an LLM (Ollama / Qwen). The Brain is a
separate, tiny experiment next to it: 12 fake neurons that talk to each
other with **spikes**, the way real brain cells do.

- A neuron's charge leaks away a little every tick. Enough charge at
  once, and it fires one short spike, then rests for 2 ticks.
- **Hebbian / STDP learning:** if neuron A spikes just before neuron B,
  the A → B connection gets stronger ("fire together, wire together").
  If B fires first, the link weakens. Small steps, weights clamped 0–1.
- **Sleep / consolidation:** `sleep()` strengthens links that were used
  a lot, fades links that were never used, and prunes very weak unused
  ones. Links you explicitly taught are protected — sleep never deletes
  something you taught on purpose, same rule as `/consolidate`.
- **Energy:** the brain reports spikes per second. Sparse firing is the
  point: a real brain runs on about 20 watts.

The demo association is **pink + puppy → happy**. Before training,
happy fires in about half the trials (10/20). After 12 training rounds
it fires in all of them (20/20), and pink alone still does not trigger
it — the brain learned the pair, not just pink. The weight
hidden-a → happy grows from 0.35 to about 0.63.

### What it is NOT
Not a real brain. Not AGI. It does not train LLM weights, and running
it does not make Runefold generally intelligent. It is a 12-neuron toy
so you can see and touch the ideas. Scarlet's long-term direction is
for Runefold's brain to one day help people talk again and walk again
(assistive neurotech) — that is a very long, clinical path needing real
brain-computer-interface research and clinicians, not a promise. v0.1
is step one: a brain you can watch learn one tiny thing.

### How to run it
```
node --test test.js        # 13 tests: 8 original + 5 brain tests
node index.js              # then type /brain for the in-terminal demo
```
Or open `web/brain-demo.html` in a browser (double-click it — no
server, no trackers, no internet needed). Buttons: Stimulate pink /
puppy / pink+puppy, Train, Sleep, Reset. Neurons light up when they
spike; connections get thicker and gold as they grow stronger.

Code: `core/brain.js` — pure Node, no dependencies. API:
`createBrain()`, `stimulate()`, `tick()`, `train()`, `measure()`,
`sleep()`, `getState()`, plus `demoBrain()` for the terminal demo.

## The agent's own cursor (web/cursor.html)
Open it in a browser. The blob is NOT your mouse — it's an agent with
a tiny decision loop: energy + curiosity + boredom → pick a goal →
move smoothly there → idle animation → decide again.
Modes: wander, curious, thinking, excited, sleeping, idle.
Your mouse is an input, not a leash: get close and curiosity rises,
click it and it gets excited, ignore it and boredom rises.
