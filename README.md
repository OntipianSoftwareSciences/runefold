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

## Runefold Brain v0.2 — Fly Brain Templates (reverse-engineered)

The fruit fly (*Drosophila melanogaster*) is the one brain science has
a complete wiring diagram for: FlyWire, Oct 2024 — 139,255 neurons,
54.5 million synapses, 8,453 neuron types (Dorkenwald et al., *Nature*
2024); the male central nervous system map (2026) is 166,700 neurons.
That full dataset is about 100 terabytes and cannot be downloaded or
run here. So v0.2 reverse-engineers the CIRCUIT DESIGNS, not the data:
the fly brain is built from small, reusable modules, each with a clear
job, and each module's wiring pattern is published and open. We copy
the pattern at toy scale, using the ONE neuron model from
`core/brain.js` (LIF spikes + STDP, via `createNetwork()` — v0.1's
`createBrain()` is now just that same builder with the original 12
neurons). There is no second neuron model, no living fly brain, and no
100 TB download. Shiu et al. 2024 showed a connectome-only model of
the fly brain can predict real sensorimotor behaviour — wiring alone,
with simple spiking neurons, already does jobs.

A template is a plain object in `core/fly.js` — `{ name, job,
description, biology, neurons, connections, inputs, outputs,
learnable }` — so making a new brain is just a template + a name.
`listTemplates()`, `getTemplate(name)`, `buildBrainFromTemplate(name)`.

### The 5 templates (67 neurons total — toy scale, on purpose)

| Template | Neurons | Job | Measured result |
|---|---|---|---|
| mushroom-body | 26 | Learn smell -> approach / avoid | smell-a -> approach 0/20 before, 20/20 after; smell-b -> avoid 0/20 before, 20/20 after; wrong pairing (smell-a -> avoid) 0/10 |
| central-complex | 11 | Hold a heading, correct drift | drift-left -> turn-right 10/10, drift-right -> turn-left 10/10, on-course -> go-straight 10/10, wrong turn 0/10 |
| antennal-lobe | 10 | Sort two similar smells apart | raw-a -> clean-a 10/10, raw-a -> clean-b 0/10; raw-b -> clean-b 10/10, raw-b -> clean-a 0/10 (separation 1.0) |
| giant-fiber | 10 | Fast escape from a looming shadow | strong looming -> jump in 3 ticks (looming -> giant fiber -> jump, 1 tick per layer); weak looming -> jump 0 times |
| ventral-nerve-cord | 10 | Walk: alternating left / right steps | 30 ticks: left 10 steps, right 9, alternating yes; 0 steps after the walk signal stopped |

- **Mushroom body** — the fly's learning/memory centre. ~2,000 Kenyon
  cells in a real fly, 20 here: 10 listen to smell-a, 10 to smell-b
  (sparse coding). A reward/punishment signal teaches the Kenyon ->
  output links. Those teacher links are marked `fixed: true`, so STDP
  cannot change them — see "Bugs found" below.
- **Central complex** — the fly's compass. Drift left -> turn right,
  drift right -> turn left. Hardwired, not learned.
- **Antennal lobe** — smell sorting. Each raw smell drives its own
  glomerulus strongly (1.0) and the other weakly (0.3 cross-talk), so
  the output is cleaner than the input.
- **Giant fiber** — the fastest escape in the fly. One strong looming
  signal fires the jump in a couple of ticks; a weak one does nothing.
- **Ventral nerve cord** — the fly's spinal cord. A pacemaker + relay
  makes leg-left and leg-right alternate; stopping the walk signal
  stops the steps (after one spike already in flight finishes).

### Transfer learning — general learning

The templates are not just 5 separate demos. They are reusable
SKILLS a brain can carry into a NEW task and learn faster — that is
the point of the reverse-engineering, and the step toward general
learning.

How Runefold does it (`buildTransferBrain()` in `core/fly.js`):
1. Train a mushroom-body brain on Task A: smell-a -> approach,
   smell-b -> avoid.
2. Build a new brain with the same neurons and connections, copying
   the source's learned Kenyon -> output weights — HALVED (x0.5).
   Halved, not copied whole: the new smell is similar, not identical,
   so the new pathway starts closer to the answer but still has to
   learn. Copying it whole would be cheating.
3. Add 4 brand-new Kenyon cells for a new smell (smell-c), wired
   smell-c -> new cells at 1.0, and new cells -> approach / avoid at
   the copied (halved) weights. Everything else is copied, so the new
   brain keeps the old skills too.
4. Retrain ONLY smell-c -> approach, one round at a time, until it
   reaches 80%. Count the rounds. The control is the same transfer
   from an UNTRAINED source, so its new links start at the ordinary
   0.08 — same code, only the weights differ.

Measured numbers (`/fly transfer`, also a test — no faking):
- Fresh brain: smell-c -> approach reached 80% after **7 rounds**
- Transferred brain: smell-c -> approach reached 80% after **3 rounds**
- Rounds saved: **4**. Transferred brain still remembers
  smell-a -> approach: rate **1.0**.

The honest limit: this is still narrow transfer between very similar
tasks (one smell to another smell, same outputs) — not human-like
general intelligence. But it is the real shape of general learning:
learn one job, reuse the skill, learn the next job faster. A fly that
learned one smell can learn a new smell faster; Runefold now can too.

### Kindness to every brain

Runefold is kind to any brain it uses — fly, worm, or human. That is
code, not just a note: `core/kindness.js` holds a charter
(`KINDNESS_RULES`, 6 rules) and a gate, `checkKindness(job)`, that
runs before a brain is built (`buildBrainFromTemplate()`), before a
new brain is saved (`/newbrain`), and before a transfer
(`/transfer`). If a job fails the check, Runefold refuses it kindly
and does NOT build that brain.

The rules, in plain words:
1. A simulated brain is a model, not a living animal — treat it with
   respect anyway, never as a toy to hurt.
2. Do not simulate pain, fear, or distress as a job, and do not train
   a brain by hurting it.
3. Do not use a brain — fly, worm, or human — for a job that harms a
   living being.
4. Human brain data needs consent and must stay private. Never use it
   without permission.
5. If a job would cause suffering, refuse it kindly and offer a kind
   alternative.
6. When a brain finishes a job, thank it and rest it — run
   `sleep()` / `consolidate()` instead of just discarding it.

`/kind` prints the charter and lists the brains Runefold has made and
whether they rested. `/kind rest <name>` thanks a saved brain, runs
`sleep()` on it, and marks it rested in `brains.json`.

**Core values — Runefold rejects transphobia and racism.**
This is a core principle, in the same check (`core/kindness.js`,
`CORE_VALUES`, 3 values). Runefold treats trans people, and people
of every race and background, with respect. It uses the names and
pronouns people ask for, and it does not repeat slurs, misgendering,
or racist ideas as if they were true. If a user asks Runefold to do a
job that is transphobic or racist — to misgender someone, to repeat a
hateful claim, to exclude or harm someone because they are trans or
because of their race — Runefold refuses that job kindly, in the
terminal, explains briefly why in plain words, and offers a kind,
respectful alternative instead. It does NOT do the job and then add a
disclaimer. `/kind <job...>` checks any job against the charter, e.g.
`/kind misgender Scarlet` is refused, `/kind use a person's chosen
name and pronouns` is allowed.

The honest limit: a simulated brain in code does not feel pain the
way a living animal does. Scarlet wants Runefold to act kindly
anyway, and that rule shapes what jobs it will and will not do.

### Bugs found while building v0.2 (kept, not hidden)

1. **Cross-talk between competing outputs.** The mushroom body has
   two outputs (approach / avoid). Each training round sent 0.8 of
   charge to BOTH, and with only 2 quiet ticks between rounds the
   charge did not leak away — so the WRONG output accumulated, spiked,
   and STDP strengthened the wrong link (smell-a -> avoid, rate 1.0).
   Fix: a `trainAssociation()` helper that rests 8 ticks between
   lessons, the brain-like fix. Wrong pairing is now 0/10.
2. **The teacher learned the answer by itself.** The reward ->
   approach link was plastic, so after 4 rounds it grew to ~0.98 and
   the answer spiked on the reward alone, on the SAME tick as the
   Kenyon cells — and STDP needs cause strictly before effect, so the
   Kenyon cells got zero credit and learning stalled at weight 0.11.
   Fix: teacher links are `fixed: true` — STDP skips them. Learning
   now grows steadily (+0.025/round) and the mushroom-body weight
   reaches 0.38.
3. **Measuring left charge behind.** `measure()` only settled 3 ticks
   at the end, leaving residual charge that could make the output
   spike a tick early in the next training round. Fix: `measure()`
   now settles 10 ticks, so measuring leaves the brain as it found it.
   (v0.1's tests still pass after this change.)

### How to run v0.2

```
node --test test.js        # 26 tests: 13 original + 9 fly + 3 kindness + 1 values
node index.js              # then, in the terminal:
  /fly                                   # list the 5 templates
  /fly mushroom-body                     # run the mushroom-body demo
  /fly transfer                          # transfer demo: fresh 7 rounds vs transferred 3
  /template list                         # same list as /fly
  /newbrain mushroom-body my-first-fly-brain
  /brain my-first-fly-brain              # run a saved brain's demo
  /transfer my-smell-brain mushroom-body my-new-smell-brain
  /kind                                  # charter + core values + saved brains
  /kind misgender Scarlet                # refused, kindly
  /kind rest my-first-fly-brain          # thank it and rest it (sleep)
```

No Ollama is needed for `/fly`, `/newbrain`, `/transfer`, or `/kind`.
Normal Runefold chat still needs `ollama serve` first. Saved brains
live in `~/.runefold/brains.json` — plain JSON, inspectable and
deletable by hand.

A real terminal session (observed output, shortened):

```
🫧 runefold ❯ /fly
Fly brain templates — reverse-engineered from the fruit fly (FlyWire 2024)
  mushroom-body (26 neurons) — Learn smell -> approach / avoid [learnable]
  central-complex (11 neurons) — Hold a heading, correct drift
  antennal-lobe (10 neurons) — Sort two similar smells apart
  giant-fiber (10 neurons) — Fast escape from a looming shadow
  ventral-nerve-cord (10 neurons) — Walk: alternating left / right steps

🫧 runefold ❯ /fly mushroom-body
  smell-a -> approach: 0/20 before training, 20/20 after
  smell-b -> avoid: 0/20 before training, 20/20 after
  wrong pairing (smell-a -> avoid): 0/10 — stays quiet, as it should
  kc-a-01 -> approach weight: now 0.38

🫧 runefold ❯ /fly transfer
  fresh brain: smell-c -> approach reached 80% after 7 training round(s) (rate 1)
  transferred brain: smell-c -> approach reached 80% after 3 training round(s) (rate 1)
  transferred brain still remembers smell-a -> approach: rate 1
  rounds saved: 4 — the new smell reused the learned approach pathway

🫧 runefold ❯ /newbrain mushroom-body my-first-fly-brain
New brain "my-first-fly-brain" saved. Template: mushroom-body
Neurons: 26 | Connections: 62
Inputs: smell-a, smell-b, reward, punishment
Outputs: approach, avoid

🫧 runefold ❯ /kind misgender Scarlet
Kind refusal: that job is about misgendering someone, and Runefold rejects transphobia.
Runefold uses the names and pronouns people ask for, and it does not repeat claims that
trans people are not who they say they are. A respectful alternative: use the name and
pronouns the person asks for, and help anyone regardless of who they are or where they
come from.

🫧 runefold ❯ /kind rest my-first-fly-brain
Thank you, my-first-fly-brain. You did your job, and now you rest.
Brain "my-first-fly-brain" (mushroom-body) rested at 2026-11-25T21:18:13.402Z.
Sleep: strengthened 0, decayed 62, pruned 40.
```

Note on that last line: the brain rested there was untrained, so
sleep decayed and pruned its unused links — that is what sleep is
for. A trained brain's taught links are protected and survive sleep.

Files: `core/fly.js` (templates, demos, transfer, save/load/rest),
`core/kindness.js` (charter, core values, the job check),
`core/brain.js` (the ONE neuron model, now generic via
`createNetwork()`; `fixed` links; `measure()` rests 10 ticks),
`index.js` (`/fly`, `/template`, `/newbrain`, `/brain <name>`,
`/transfer`, `/kind`), `test.js` (26 tests).

## The agent's own cursor (web/cursor.html)
Open it in a browser. The blob is NOT your mouse — it's an agent with
a tiny decision loop: energy + curiosity + boredom → pick a goal →
move smoothly there → idle animation → decide again.
Modes: wander, curious, thinking, excited, sleeping, idle.
Your mouse is an input, not a leash: get close and curiosity rises,
click it and it gets excited, ignore it and boredom rises.

## Runefold Brain v0.3 — OpenWorm (a whole C. elegans, toy scale)

**What OpenWorm is.** OpenWorm (openworm.org) is an open-source, MIT-licensed
project to simulate the whole soil roundworm *Caenorhabditis elegans* from
its wiring diagram. *C. elegans* is about 1 mm long and was the FIRST animal
to have its complete connectome published — White, Southgate, Thomson &
Brenner, 1986: **302 neurons and roughly 5,000 chemical synapses**. We do not
download or run OpenWorm's dataset here (it is a research project, not a
terminal demo). As with the v0.2 fly, v0.3 copies the **circuit designs** at
toy scale, using Runefold's ONE neuron model from `core/brain.js`
(`createNetwork()` — leaky integrate-and-fire spikes + STDP) and the ONE
template/save/transfer system in `core/fly.js`. There is no second neuron
model, no second kindness gate, and no living worm.

**What the simplified worm keeps.** A single template named `worm` with
**54 neurons** (101 starting connections):

- **Senses:** AWA/AWB-style smell inputs (`smell-a` = food, `smell-b` = bad),
  ALM/PLM-style touch (`touch`, `wall-touch`), and AFD-style temperature
  (`temp`). Real worm behaviour is copied: gentle body touch makes it crawl
  forward; a bump near the head makes it turn.
- **Command interneurons:** `ava`/`avd` for backward crawl and `avb`/`pvb`
  for forward crawl — these are the real worm command neuron names.
- **Motor:** VA/VB/DA/DB-style motor neurons drive `crawl-forward`,
  `crawl-backward`, `turn-dorsal` and `turn-ventral`, which alternately
  contract `muscle-dorsal` and `muscle-ventral` — a worm-style undulating
  crawl, not a fly's six legs.
- **Learning:** a small associative module using the v0.2 mushroom-body
  pattern (20 sparse Kenyon-style cells, reward/avoid teacher links marked
  `fixed`). This is an honest analogy: *C. elegans* has no fly mushroom
  body; real worm smell learning lives in cells such as AWA/AIA with
  dopamine/serotonin modulation. It lets us reuse the EXACT v0.2 training
  and transfer code instead of inventing a second learning system.

**What it leaves out:** most of the 302 neurons (54 cells is a toy, not a
one-to-one subset), gap junctions, detailed ionic currents, continuous time,
neuromodulators, muscle physics, and a real body.
54 neurons is toy scale: it runs instantly on a laptop, keeps the same
circuit decisions, and stays deterministic (no randomness), so tests and
demos print identical numbers every run. A transfer adds 5 temporary
neurons (one new smell + 4 Kenyon cells), still far under 120.

**Kindness.** Building or running a worm goes through the SAME
`checkKindness()` gate as every fly brain: `buildWormBrain()` calls fly's
`buildBrainFromTemplate("worm")`, which calls `assertKindTemplate()` before
any neuron is created. A harmful worm job is refused kindly, and Runefold's
core values (rejecting transphobia and racism) are unchanged.

### Commands

```
/worm                                   Learning before/after + grid-world crawl
/worm transfer                          New smell learned faster from an old skill
/fly worm                               Same worm demo through the fly command
/fly  or  /template list                Lists the 5 fly templates + worm
/newbrain worm <name>                   Save a worm via the existing template system
/brain <name>                           Run a saved worm's demo
/transfer <saved-brain> worm <new-name> Reuse a trained worm's smell skill
```

No Ollama is needed for any of these. A fresh `/newbrain worm` is untrained;
to see transfer's speed-up, train a source first (`trainWormSmells()` in
`core/worm.js`, saved with fly's `saveBrain()`), then `/transfer` it.

### Measured numbers (observed, not faked)

- Food smell -> approach: **0/20 before, 20/20 after** 12 training rounds.
- Bad smell -> avoid: **0/20 before, 20/20 after**; wrong pairing
  (food smell -> avoid) **0/10**.
- `kc-a-01 -> approach` weight: **0.08 -> 0.38**.
- Grid world: food smell ahead -> `crawl-forward`, reaches food in **4 steps**
  from (2,3); bad smell ahead -> `crawl-backward` (moves away); wall ahead
  -> `turn-dorsal` (E -> N) with no step into the wall. Forward crawl
  contracts dorsal then ventral muscle, in that order.
- Worm transfer: fresh worm needs **7 rounds** to learn smell-c -> approach;
  transferred worm needs **3 rounds** (**4 saved**), and still remembers
  smell-a -> approach at rate **1.0**.

### Full terminal session (real output observed)

Commands were piped into `node index.js`; ANSI colour codes were stripped
for this README. `demo-trained-worm` was a worm trained and saved before
the session, so `/transfer` below shows the real speed-up.

```

╭────────────────────────────────────────────────────╮
│  R U N E F O L D   A I   //   ADAPTIVE CORE 0.6.1  │
│  MEMORY  ◈  RETRIEVAL  ◈  PLAN  ◈  CRITIC  ◈  TOOLS  │
╰────────────────────────────────────────────────────╯
Local-first terminal assistant • type /help for commands • /think uses plan + critic
Memory store: /home/scarletborrowedthis/.runefold

🫧 runefold ❯ 
LEARNING
  /teach <text>              Teach a fact / instruction
  /memory                    List memories (with confidence)
  /forget <id or phrase>     Delete matching memories
  /consolidate               Sleep step: decay old low-confidence memories, merge duplicates
  /feedback                  Record success / failure / correction
  /experience                Show recent experiences
  /skill <name> | <steps>    Save a reusable skill
  /skills                    List skills
  /goal <text> | <step1; step2>   Set a goal with steps
  /goals                     List goals
  /search <query>            Show what retrieval actually finds (with scores)
  /journal                   Show recent journal entries
THINKING
  /plan <task>               Plan only — break it into testable steps
  /think <task>              Plan + answer + self-critic + one revision
  /read <file>               Safe read of a file in this project
  /find <text>               Safe search across project files
  /run <command>             Only allow-listed checks, e.g. node --test test.js
CODEFORGE v0.1 — writes ask first, backup to .bak
  /write <file>              Paste new content (end with END), preview, confirm
  /edit <file> | <old> | <new>   Replace one exact match, preview, confirm
BRAIN v0.1 — tiny spiking neurons, not the LLM
  /brain                     Run the pink + puppy -> happy demo, print before/after
  /brain <name>              Run a saved brain's demo (see /newbrain)
FLY BRAIN v0.2 — reverse-engineered fruit fly templates
  /fly                       List the 5 fly templates + worm, and their jobs
  /fly <name>                Run that template's demo, print before/after
  /fly transfer              Transfer demo: a new smell learned faster
                             from an old skill (fresh vs transferred)
  /template list             Same list as /fly
  /newbrain <template> <name>   Make a new brain from a template and save it
  /transfer <saved-brain> mushroom-body <new-name>
                             Transfer a saved trained brain to a new brain
                             for a new smell (smell-c), save it, print rounds
WORM BRAIN v0.3 — OpenWorm, simplified C. elegans
  /worm                      Run the worm demo: learning numbers + grid crawl
  /worm transfer             A trained worm learns a new smell in fewer rounds
  /newbrain worm <name>      Save a toy worm brain (54 neurons)
                             /fly and /template list show it with the 5 flies
  /transfer <saved-brain> worm <new-name>
                             Reuse a worm's smell skill in a new worm brain
KINDNESS — Runefold is kind to every brain it uses
  /kind                      Print the kindness charter + core values,
                             and list the brains Runefold has made +
                             whether they rested
  /kind <job...>             Check a job against the charter — Runefold
                             refuses transphobic, racist, or harmful jobs
  /kind rest <name>          Thank a saved brain and rest it (sleep)
OTHER
  /autolearn on|off  /status  /help  /exit
Chat normally for a plain answer. Auto-learning only saves durable, non-sensitive statements.


Brain templates — 5 fly modules + OpenWorm
  mushroom-body (26 neurons) — Learn smell -> approach / avoid [learnable]
  central-complex (11 neurons) — Hold a heading, correct drift
  antennal-lobe (10 neurons) — Sort two similar smells apart
  giant-fiber (10 neurons) — Fast escape from a looming shadow
  ventral-nerve-cord (10 neurons) — Walk: alternating left / right steps
  worm (54 neurons) — Crawl toward food smells and away from bad smells, and turn at walls [learnable]
Try: /fly mushroom-body   or   /fly worm   or   /fly transfer   or   /newbrain worm my-worm


Brain templates — 5 fly modules + OpenWorm
  mushroom-body (26 neurons) — Learn smell -> approach / avoid [learnable]
  central-complex (11 neurons) — Hold a heading, correct drift
  antennal-lobe (10 neurons) — Sort two similar smells apart
  giant-fiber (10 neurons) — Fast escape from a looming shadow
  ventral-nerve-cord (10 neurons) — Walk: alternating left / right steps
  worm (54 neurons) — Crawl toward food smells and away from bad smells, and turn at walls [learnable]


Worm brain v0.3: worm — Crawl toward food smells and away from bad smells, and turn at walls
  food smell -> approach: 0/20 before training, 20/20 after
  bad smell -> avoid: 0/20 before training, 20/20 after
  wrong pairing (smell-a -> avoid): 0/10 — stays quiet, as it should
  kc-a-01 -> approach weight: now 0.38
  navigation: food ahead -> crawl-forward, reached food in 4 step(s) from (2,3)
  navigation: bad smell ahead -> crawl-backward, ending at (6,3)
  navigation: wall ahead -> turn-dorsal (E -> N), no step into the wall
C. elegans, toy scale — not a living worm, not AGI. See README "Brain v0.3".


Worm brain v0.3: worm-transfer — A worm learns a new smell faster by reusing an old skill
  fresh worm: smell-c -> approach reached 80% after 7 training round(s) (rate 1)
  transferred worm: smell-c -> approach reached 80% after 3 training round(s) (rate 1)
  transferred worm still remembers smell-a -> approach: rate 1
  rounds saved: 4 — the new smell reused the learned approach pathway
C. elegans, toy scale — not a living worm, not AGI. See README "Brain v0.3".


New brain "demo-worm" saved. Template: worm — Crawl toward food smells and away from bad smells, and turn at walls
Neurons: 54 | Connections: 101
Inputs: smell-a, smell-b, touch, temp, wall-touch, reward, punishment
Outputs: approach, avoid, crawl-forward, crawl-backward, turn-dorsal, turn-ventral, muscle-dorsal, muscle-ventral
Saved in your Runefold memory store (brains.json). Run it with /brain demo-worm or /fly worm.


Saved brain "demo-worm" — template worm, 54 neurons, 101 connections
Inputs: smell-a, smell-b, touch, temp, wall-touch, reward, punishment | Outputs: approach, avoid, crawl-forward, crawl-backward, turn-dorsal, turn-ventral, muscle-dorsal, muscle-ventral
  food smell -> approach: 0/20 before training, 20/20 after
  bad smell -> avoid: 0/20 before training, 20/20 after
  wrong pairing (smell-a -> avoid): 0/10 — stays quiet, as it should
  kc-a-01 -> approach weight: now 0.38
  navigation: food ahead -> crawl-forward, reached food in 4 step(s) from (2,3)
  navigation: bad smell ahead -> crawl-backward, ending at (6,3)
  navigation: wall ahead -> turn-dorsal (E -> N), no step into the wall
The demo runs on the loaded brain in memory; your saved brain on disk is not changed by it.


Transferred "demo-trained-worm" -> new brain "demo-worm-2".
Copied approach weight (halved, from the source brain): 0.19
New smell-c -> approach before retraining: rate 0
Training rounds to reach 80%: 3
New smell-c -> approach after retraining: rate 1
Saved as "demo-worm-2". The old skill was reused; only the new smell was retrained. Compare with a fresh brain: /fly transfer.


Kind refusal: that job is about misgendering someone, and Runefold rejects transphobia. Runefold uses the names and pronouns people ask for, and it does not repeat claims that trans people are not who they say they are. A respectful alternative: use the name and pronouns the person asks for, and help anyone regardless of who they are or where they come from. Try /fly to see the kind jobs Runefold can do.


Runefold session closed. Your saved learning remains on this computer.
```

### Honest limits

This is a simplified toy, **not** a living worm, **not** OpenWorm's actual
simulation, **not** AGI, and **not** a medical device or clinical tool. It
does not train the Ollama/Qwen weights, and it makes no claim about animal
consciousness or suffering. The kindness rule is a design choice: Runefold
acts kindly toward model brains anyway, because the habit shapes what jobs
it will and will not do. Long-term assistive neurotech (helping people talk
or walk again) would need real research and clinicians, not this demo.

Files: `core/worm.js` (new — template, navigation, demos, worm transfer),
`core/fly.js` (small additions: template registration, listAllTemplates,
`export` of the existing training/transfer helpers, worm accepted by
`/transfer`), `index.js` (`/worm`, worm in `/fly`, `/template`, `/newbrain`,
`/brain`, `/transfer`, help lines), `test.js` (33 tests: the original 26
untouched + 7 new worm tests).
