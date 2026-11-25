# Runefold AI — Adaptive Core 0.6.1

## What's new in 0.6.1 — CodeForge v0.1 (the smallest useful next step)

Runefold could read, plan, and criticise, but it could not *write* code —
so it could not actually build software. That is now fixed, safely:

- **Write a file** — name the file, paste content, end with a line `END`,
  preview the first 20 lines, confirm with `y`. Overwriting an existing file
  first copies it to `<file>.bak`.
- **Edit a file** — name the file, the exact old text and the new text. It
  replaces exactly one match; if the old text is missing, or found more than
  once, it refuses and asks you to be more specific. Preview + confirm first,
  backup to `.bak`.
- **Run an allow-listed check** — `node --test` in `config.json` now allows
  `node --test test.js`, `node --check` allows `node --check file.js`. Other
  commands are still blocked. Arguments are split respecting quotes and still
  run via `execFile`, never a shell.

Safety, as before: paths cannot escape the project root, no deletes,
no file over 200k chars, no silent overwrite. The terminal always asks
before a write lands.

A terminal-first JavaScript assistant with persistent, inspectable learning.
Upgraded from 0.5 with smartest-reasoning changes, not just more commands.

## What's actually new in 0.6 — and why it matters

**1. Retrieval that ranks (core/retrieval.js)**
0.5 asked "does this word appear?" 0.6 uses TF-IDF + cosine similarity,
recency decay (30-day half-life), and a confidence weight. Ask me to search
your memories and you can *see* the scores. No embeddings server needed, and no pretending
it understands meaning — it matches words, well.

**2. Memory with confidence, not certainty (core/learning.js)**
Every memory starts at confidence 0.6. Confirmation raises it, contradiction
lowers the old one and keeps both visible. The "sleep" step:
old, low-confidence, never-used memories decay, near-duplicates merge.
Nothing you taught explicitly is silently deleted.

**3. Plan → Act → Critic (core/agent.js)**
Ask me to plan a task and it breaks into testable steps.
Ask me to think something through: it answers, criticises its own draft,
then revises once.
That loop is the core of an agent that improves — a bigger model alone isn't.

**4. Safe tools (core/tools.js)**
Ask me to read a file, find text, or run an allow-listed check (`node --check`,
`node --test` by default). Read-only by default, no shell, no deletes,
paths cannot escape the project folder. Add a command to
`config.json → tools.allowRun` only if you trust it.

**5. Goals, journal, skill promotion**
Give me a goal and its steps — a durable intention with steps.
Repeated success (3x on the same kind of task) drafts a reusable skill.
Ask to see the journal: it shows what the agent actually did, in order.

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

## What to ask — plain words, no slash needed

Runefold hears short plain-text questions locally and offline. Ask one of these:

**Fly**

- "show me the fly" — list the fly modules and what each one does
- "show me the mushroom body" — watch a fly learn that one smell means approach
- "can the fly learn a new smell?" — the same learning demo, asked as a question
- "show me how a fly learns a new smell faster" — watch a fly reuse an old skill

**Worm**

- "show me the worm" — learning numbers and a grid-world crawl
- "can the worm crawl to food?" — watch it crawl toward food and turn at walls
- "show me how a worm learns a new smell faster" — a trained worm reuses a skill

**Friends**

- "are the fly and worm friends?" — two toy brains share honey in a little ASCII world
- "show me the friends" — the same world, another way to ask
- "make them friends faster" — compare a pair that trained first

**Brain**

- "show me the brain" — the pink + puppy -> happy spiking demo
- "what did the brain learn?" — the same demo, with before and after numbers

**Kindness**

- "what are your rules?" — the kindness charter and the core values
- "be kind" — the same charter, in plain words

**Session**

- "what did you learn last time?" — this session's learning summary
- "what have you learned?" — the same summary, another way to ask

**Space — coming next**

- "tell me about black holes" — I can name the topic, but there is no live space
  reference built here yet, so I cannot verify the details. Coming next.

**About me and everyday work**

- "who are you?" — a short local answer about me
- "what can you do?" — the full list of questions above
- Ask me to turn auto-learning on or off, show your status, or close the session.

/commands still work as a fallback, but you don't need them.

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
Secrets and health details are filtered from memory — ask to see your
memories and ask me to forget anything whenever needed.

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
  something you taught on purpose, same rule as the memory sleep step.
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
node index.js              # then ask: show me the brain
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

Measured numbers (ask "show me how a fly learns a new smell faster"; also a
test — no faking):
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
new brain is saved, and before a transfer. If a job fails the check,
Runefold refuses it kindly
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

Ask "what are your rules?" to see the charter and the brains Runefold has
made and whether they rested. Name a saved brain and ask me to thank and
rest it: that runs `sleep()` on it and marks it rested in `brains.json`.

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
disclaimer. You can ask whether a job is kind: "misgender Scarlet" is
refused, "use a person's chosen name and pronouns" is allowed.

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
node index.js              # then, in the terminal, ask:
  "show me the fly"                       # list the 5 fly templates and the worm
  "show me the mushroom body"             # run the mushroom-body learning demo
  "show me how a fly learns a new smell faster"   # fresh 7 rounds vs transferred 3
  "what are your rules?"                  # charter + core values + saved brains
  "misgender Scarlet"                     # refused, kindly
  "name a brain to thank and rest"        # thank it and rest it (sleep)
```

No Ollama is needed for any of those questions. Normal Runefold chat still
needs `ollama serve` first. Saved brains live in `~/.runefold/brains.json`
— plain JSON, inspectable and deletable by hand.

A real terminal session with the current plain-text questions is shown at the
end of this README. The fly demos there print the same numbers: 7 fresh rounds
vs 3 transferred rounds, with the mushroom-body weight at 0.38. Ask "what are
your rules?" for the charter, and name a saved brain to thank and rest it.

Note on that last line: the brain rested there was untrained, so
sleep decayed and pruned its unused links — that is what sleep is
for. A trained brain's taught links are protected and survive sleep.

Files: `core/fly.js` (templates, demos, transfer, save/load/rest),
`core/kindness.js` (charter, core values, the job check),
`core/brain.js` (the ONE neuron model, now generic via
`createNetwork()`; `fixed` links; `measure()` rests 10 ticks),
`index.js` (the fly and brain questions, template list, brain saving,
transfer and kindness questions), `test.js` (26 tests).

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

### What to ask

```
"show me the worm"                       Learning before/after + grid-world crawl
"show me how a worm learns a new smell faster"
                                         New smell learned faster from an old skill
"can the worm crawl to food?"            The same crawl demo, asked as a question
"show me the fly"                        Lists the 5 fly templates + the worm
"name a worm and ask to save it"         Save a worm via the existing template system
"name a saved worm and ask to run it"    Run that saved worm's demo
"name a source brain, worm, and a new name"
                                         Reuse a trained worm's smell skill
```

No Ollama is needed for any of these. A freshly saved worm is untrained;
to see transfer's speed-up, train a source first (`trainWormSmells()` in
`core/worm.js`, saved with fly's `saveBrain()`), then ask for the transfer.

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

Piped into `node index.js`, in order: `show me the worm`, `show me how a worm
learns a new smell faster`, then exit. ANSI colour codes were stripped. The
prompt is printed once at the start with piped input, so later prompts cluster
at the end.

```

╭────────────────────────────────────────────────────╮
│  R U N E F O L D   A I   //   ADAPTIVE CORE 0.6.1  │
│  MEMORY  ◈  RETRIEVAL  ◈  PLAN  ◈  CRITIC  ◈  TOOLS  │
╰────────────────────────────────────────────────────╯
Local-first terminal assistant • try asking: show me the fly • show me the worm • are the fly and worm friends? • what can you do?
Memory store: /home/scarletborrowedthis/.runefold

🫧 runefold ❯ (I heard that as: show me the worm — tell me if I got it wrong)

Worm brain v0.3: worm — Crawl toward food smells and away from bad smells, and turn at walls
  food smell -> approach: 0/20 before training, 20/20 after
  bad smell -> avoid: 0/20 before training, 20/20 after
  wrong pairing (smell-a -> avoid): 0/10 — stays quiet, as it should
  kc-a-01 -> approach weight: now 0.38
  navigation: food ahead -> crawl-forward, reached food in 4 step(s) from (2,3)
  navigation: bad smell ahead -> crawl-backward, ending at (6,3)
  navigation: wall ahead -> turn-dorsal (E -> N), no step into the wall
C. elegans, toy scale — not a living worm, not AGI. See README "Brain v0.3".

(I heard that as: show me how a worm learns a new smell faster — tell me if I got it wrong)

Worm brain v0.3: worm-transfer — A worm learns a new smell faster by reusing an old skill
  fresh worm: smell-c -> approach reached 80% after 7 training round(s) (rate 1)
  transferred worm: smell-c -> approach reached 80% after 3 training round(s) (rate 1)
  transferred worm still remembers smell-a -> approach: rate 1
  rounds saved: 4 — the new smell reused the learned approach pathway
C. elegans, toy scale — not a living worm, not AGI. See README "Brain v0.3".

🫧 runefold ❯ 🫧 runefold ❯ 
This session I learned nothing new, I got better at no new skills, I rested no brains, and I had no questions I couldn't answer.
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
the transfer path), `index.js` (worm questions, worm in the fly template list,
brain saving and transfer, help lines), `test.js` (33 tests: the original 26
untouched + 7 new worm tests).

## Fly Meets Worm — friends (Brain v0.4)

**What it is.** One 20 × 12 ASCII world, printed in the terminal: sky at
the top, grass and flowers at the bottom, a honeycomb on the right, and
honey drips falling. `F` is a fly, `w` is a worm, `*` is honey, `H` is the
honeycomb, and `♥` appears when they become friends. They start far apart
(distance **21** by grid steps). Every tick each one senses where the other
is (left / right / above / below) and how far away. At first they are shy:
they approach a little, back off, then approach again — they never rush
straight at each other. When they meet, the fly shares a honey drip
("yum!") and both brains learn one small friendly lesson.

**Reuse, not reinvention.** The fly is
`buildBrainFromTemplate("mushroom-body")`; the worm is
`buildBrainFromTemplate("worm")` (its template is registered by
`core/worm.js`). Both use the ONE neuron model in `core/brain.js` and the
ONE template system in `core/fly.js`. Nothing is added to either brain.
Decisions are read by stimulating existing inputs (`smell-a`, the friendly
shape) and counting output spikes with plasticity switched off — the same
pattern as `navigateWorm()` in `core/worm.js`, so looking at a friend does
not secretly train a brain.

**How they learn the other is safe.** Every meeting runs the existing
`trainAssociation()` from `core/fly.js` for one round on each brain:
`smell-a + reward -> approach`. That is ordinary STDP / teacher-forcing,
the same learning used by the fly and worm demos — no second learning
system. In each brain the measured `kc-a-01 -> approach` weight grows from
**0.08** to **0.205**. "Friends" is a plain, measured rule in this toy: both
learned weights have reached **0.20** and at least **two** honey moments
have happened; after that they stay close (distance 1) and the heart is
drawn. The worm's learned `approach` drives its existing fixed
`approach -> avb` forward-crawl link, so after learning it does **not**
crawl backward away from the fly (measured: **0** backward moves after
friendship). No pain, fear, punishment, escape or harm signal exists in
this world, and `checkKindness()` from `core/kindness.js` gates the job
before any brain is built.

**How to run it.** No Ollama needed.

```
"are the fly and worm friends?"   # ASCII world + before/after numbers
"make them friends faster"        # train both brains first; compare meetings needed
node --test test.js               # 40 tests: 33 original + 7 friends tests
```

**Numbers observed (real runs, deterministic):**

| Pair | Distance before → after | Meetings to friendship | Honey shared | Friends |
|---|---|---|---|---|
| Untrained | 21 → 1 | 5 | 5 | yes |
| Trained first | 21 → 1 | 2 | 2 | yes |

Training saved **3** meetings. Both pairs became friends in the end; the
trained pair already had the association, so it needed fewer honey
meetings to cross the same learned-weight threshold.

**Full terminal session (real output observed).** Questions were piped into
`node index.js`; ANSI colour codes were stripped. With piped input the
prompt is printed once at the start, so the second question's output follows
directly after the first.

```

╭────────────────────────────────────────────────────╮
│  R U N E F O L D   A I   //   ADAPTIVE CORE 0.6.1  │
│  MEMORY  ◈  RETRIEVAL  ◈  PLAN  ◈  CRITIC  ◈  TOOLS  │
╰────────────────────────────────────────────────────╯
Local-first terminal assistant • try asking: show me the fly • show me the worm • are the fly and worm friends? • what can you do?
Memory store: /home/scarletborrowedthis/.runefold

🫧 runefold ❯ 
Fly Meets Worm — friendship simulation (F = fly, w = worm, H = honeycomb, * = honey, ♥ = friends)

start grid:
+--------------------+
|                    |
|                    |
|   F             * H|
|                   H|
|                  *H|
|                   H|
|                    |
|                    |
|                    |
|,,,,,,,,,,,,,,,,,,,,|
|,,,y,,,,,,,y,,,,w,,,|
|,,,,,,y,,,,,,,y,,,,,|
+--------------------+

middle grid:
+--------------------+
|                    |
|                    |
|                   H|
|                  *H|
|         *         H|
|         F         H|
|                    |
|          w         |
|                 *  |
|,,,,,,,,,,,,,,,,,,,,|
|,,,y,,,,,,,y,,,,,,,,|
|,,,,,,y,,,,,,,y,,,,,|
+--------------------+

end grid:
+--------------------+
|                    |
|                    |
|                   H|
|                   H|
|                 * H|
|          ♥        H|
|         Fw       * |
|                    |
|                    |
|,,,,,,,,,,,,,,,,,,,,|
|,,,y,,,,,,,y,,,,,,,,|
|,,,,,,y,,,,,,,y,,,,,|
+--------------------+

final numbers
  distance before: 21 | distance after: 1
  meetings: 5 (friends after 5 friendly meetings)
  honey shared: 5
  friends: yes
  learned weight kc-a-01 -> approach: fly 0.205, worm 0.205
  worm crawl-backward after friendship: 0
  kindness gate: passed — no pain, no fear, no harm
Toy ASCII world with two simulated brains learning a positive association — not real animals, not feelings.


Fly Meets Worm — trained pair (F = fly, w = worm, H = honeycomb, * = honey, ♥ = friends)

start grid:
+--------------------+
|                    |
|                    |
|   F             * H|
|                   H|
|                  *H|
|                   H|
|                    |
|                    |
|                    |
|,,,,,,,,,,,,,,,,,,,,|
|,,,y,,,,,,,y,,,,w,,,|
|,,,,,,y,,,,,,,y,,,,,|
+--------------------+

middle grid:
+--------------------+
|                    |
|                    |
|                   H|
|                  *H|
|         *         H|
|         F         H|
|                    |
|          w         |
|                 *  |
|,,,,,,,,,,,,,,,,,,,,|
|,,,y,,,,,,,y,,,,,,,,|
|,,,,,,y,,,,,,,y,,,,,|
+--------------------+

end grid:
+--------------------+
|                    |
|                    |
|                 * H|
|                   H|
|                  *H|
|          ♥        H|
|         Fw         |
|                    |
|                    |
|,,,,,,,,,,,,,,,,,,,,|
|,,,y,,,,,,,y,,,,,,,,|
|,,,,,,y,,,,,,,y,,,,,|
+--------------------+

untrained pair — same world, no head start
  distance before: 21 | distance after: 1
  meetings: 5 (friends after 5 friendly meetings)
  honey shared: 5
  friends: yes
  learned weight kc-a-01 -> approach: fly 0.205, worm 0.205
  worm crawl-backward after friendship: 0
  kindness gate: passed — no pain, no fear, no harm

trained pair — both brains trained first
  distance before: 21 | distance after: 1
  meetings: 2 (friends after 2 friendly meetings)
  honey shared: 2
  friends: yes
  learned weight kc-a-01 -> approach: fly 0.205, worm 0.205
  worm crawl-backward after friendship: 0
  kindness gate: passed — no pain, no fear, no harm
  meetings saved by training: 3 (untrained 5 -> trained 2)
Both pairs use the same STDP lesson in core/friends.js; only the starting weights differ.


Runefold session closed. Your saved learning remains on this computer.
```

**Honest limits.** This is a toy-scale, simplified ASCII world. It is
**not** real animals, **not** OpenWorm or a real fly connectome, **not**
AGI, and **not** a medical device or clinical tool. It does not train the
Ollama/Qwen weights. Two simulated brains are learning a positive
association by STDP — **not having real feelings**, not suffering, and not
forming a real friendship. The kindness rule is a design choice applied
anyway: the world refuses harmful jobs through the existing gate and uses
only reward and practice.

Files: `core/friends.js` (new — world, rendering, stepping, demos),
`index.js` (the two friendship questions and help lines only),
`test.js` (7 new friends tests; the original 33 untouched), this README.

## Autosave — each session makes Runefold smarter

Runefold now learns across sessions **without Scarlet running a command**.
The new `core/autosave.js` keeps a short, in-memory record of the current
session only: what Scarlet taught, accepted or rejected; which commands were
used; which brains were trained or used; what worked; what failed; and which
questions Runefold could not answer. Nothing is written to a new database —
everything goes into the same `~/.runefold` store as before.

**What autosaves, and when**

- **Every 5 minutes, or every 10 user messages, whichever comes first** —
  memory, brain weights and learned skills are written to the existing
  `memory.json`, `brains.json` and `skills.json`. These writes are atomic
  with a `.bak` copy, so a crash mid-save cannot wipe the store.
  The terminal prints one quiet line: `autosaved ✓` (throttled, so it does
  not spam the screen).
- **On exit** — ask to close the session, press Ctrl+C, send SIGTERM, or simply
  close the terminal. The session close-out runs automatically, then saves one last
  time and prints a short plain-words summary before
  `Runefold session closed`.
- **At the start of the next session** — Runefold loads the saved summary
  from `~/.runefold/last-session.json` (plain JSON in the same store) and
  prints a `Welcome back — last time I learned ...` line. The memories,
  skills and brains themselves are read from the existing store too.

**What the close-out does (plain words)**

1. **Memory sleep:** memories that were used or accepted get stronger;
   memories that were rejected or unused get weaker. The actual work is
   done by the existing `consolidate()` in `core/learning.js` — the same
   "sleep" step. No second learning system was added.
2. **Skill promotion:** a lesson Scarlet taught 3+ times, a command that
   worked 3+ times, or a repeated success becomes a skill in the existing
   `skills.json`, so the next session starts with it.
3. **Forget kindly:** very low-confidence memories that were never used are
   allowed to drop. Memories Scarlet explicitly taught, verified
   corrections, and kindness / core-value memories are never dropped.
4. **Brains rest:** every brain used or trained this session is rested with
   the existing `restBrain()` / `sleep()` from `core/fly.js` — the same rest
   step used when you thank a brain — and is marked `rested` with a
   `restedAt` time.
5. **Kindness gate:** `checkKindness()` from `core/kindness.js` runs before
   anything becomes a skill or stays a memory. A harmful, transphobic or
   racist job is refused kindly, is not saved, and is noted in the summary.

Ask "what did you learn last time?" to see the current session's summary on
demand. It is **only** a view — autosave works whether or not you ever ask.
Nothing else was changed, and normal chat still needs Ollama; autosave, that
question and the welcome-back line do not.

**Full terminal session (real output observed).** Questions were piped into
`node index.js` with ANSI colour codes stripped. Ten ordinary chat lines
(`m1`...`m10`) were piped for the automatic 10-message save; no Ollama was
running. With piped input the prompt is printed once at the start, so later
prompts appear clustered.

```

╭────────────────────────────────────────────────────╮
│  R U N E F O L D   A I   //   ADAPTIVE CORE 0.6.1  │
│  MEMORY  ◈  RETRIEVAL  ◈  PLAN  ◈  CRITIC  ◈  TOOLS  │
╰────────────────────────────────────────────────────╯
Local-first terminal assistant • try asking: show me the fly • show me the worm • are the fly and worm friends? • what can you do?
Memory store: /home/scarletborrowedthis/.runefold

Welcome back — last time I learned from now on use pink terminals.
🫧 runefold ❯ 
New brain "demo-autosave-brain" saved. Template: mushroom-body — Learn smell -> approach / avoid
Neurons: 26 | Connections: 62
Inputs: smell-a, smell-b, reward, punishment
Outputs: approach, avoid
Saved in your Runefold memory store (brains.json). You can run it by its name, demo-autosave-brain, or ask "show me the mushroom body".

Learned and saved (confidence 0.6 — it rises with confirmation).
This session I learned remember that I prefer pink terminals, I got better at no new skills, I rested no brains, and I had no questions I couldn't answer.
autosaved ✓
This session I learned remember that I prefer pink terminals, I got better at no new skills, I rested no brains, and I had no questions I couldn't answer.
🫧 runefold ❯ 🫧 runefold ❯ 🫧 runefold ❯ 🫧 runefold ❯ 
This session I learned remember that I prefer pink terminals, I got better at no new skills, I rested 1 brain, and I had no questions I couldn't answer.
Runefold session closed. Your saved learning remains on this computer.
```

**Crash-safe check (observed).** Before that session, `memory.json` and
`last-session.json` had one set of hashes; after it, `memory.json`,
`brains.json` and `last-session.json` all had different hashes, and the saved
brain showed `rested: true`. Starting a fresh `node index.js` immediately
afterwards printed:

```
Welcome back — last time I learned remember that I prefer pink terminals.
```

**Honest limits.** Autosave writes to the local computer only — it does
**not** upload anything to a cloud. It does **not** train the Ollama/Qwen
model weights. It makes Runefold better at remembering and reusing what
Scarlet taught it, not generally intelligent. A simulated brain still does
not feel pain; resting it is a kindness rule in code, not a claim that it
suffers.

Files: `core/autosave.js` (new — session tracking, autosave, close-out,
summary text), `index.js` (timer/exit wiring, the session-summary question,
help lines and event tracking only), `test.js` (5 new autosave tests; the original 40
untouched — 45 tests total), this README.

## Plain text — just talk to Runefold

You no longer need to remember a slash command. Type what you mean in plain
words and Runefold tries to hear it locally, offline, with no Ollama call.

**How it works, in plain words.** Type a question instead of a command.
Runefold first asks a small matcher in `core/plaintext.js`. That matcher is a
short table of keywords and simple phrases. An exact short phrase
(`show me the fly`) is a **high**-confidence match; a single clear keyword
(`worm`) is a **medium**-confidence match. Either way it runs the **existing**
local job — there is no second command system — and prints a tiny note in
plain words, never a command name:

```
(I heard that as: show me the mushroom body — tell me if I got it wrong)
```

If the line is genuinely unclear (`thing`, or two different topics in one
line), it does **not** guess: it asks **one** question and waits for your
answer. If nothing in the table matches at all (`hi`, `how are you`, a question
about code), the line stays normal chat and goes to Ollama exactly as it did
before. Lines that begin with an old slash command still go straight to the
original command switch, unchanged. Every plain-text line passes through the
existing `checkKindness()` gate first, so a harmful, transphobic or racist
request is refused kindly before any job runs.

**Examples of what to type**

| Type this | What happens | Ollama needed? |
|---|---|---|
| `fly`, `show me the fly`, `run the fly brain` | lists the fly modules and their jobs | no |
| `fly mushroom body`, `mushroom body`, `can the fly learn a new smell?` | runs the mushroom-body learning demo | no |
| `show me how a fly learns a new smell faster` | fresh vs transferred fly (7 rounds vs 3) | no |
| `worm`, `show me the worm`, `can the worm crawl to food?` | runs the worm learning + crawl demo | no |
| `show me how a worm learns a new smell faster` | fresh vs transferred worm (7 rounds vs 3) | no |
| `friends`, `fly meets worm`, `are the fly and worm friends?` | runs the ASCII friendship world | no |
| `train the friends`, `make them friends faster` | compares a pair that trained first | no |
| `black hole`, `tell me about mars`, `what is gravity` | names the topic, says "coming next", runs nothing | no |
| `alien`, `who are you`, `tell me about yourself` | short local answer about me, then "coming next" | no |
| `kind`, `be kind`, `what are your rules` | prints the kindness charter and values | no |
| `brain`, `show me the brain`, `what did the brain learn?` | runs the pink + puppy -> happy demo | no |
| `help`, `what can you do` | prints the grouped list of questions | no |
| `session`, `what did you learn`, `what did you learn last time?` | shows this session's learning summary | no |
| `hi`, `how are you`, code questions | normal chat → Ollama | yes |

Space topics and the "who are you" answer are **not fully built yet**.
Runefold says plainly "that is coming next", names the source as local
knowledge, and runs nothing. Nothing is faked.

When Runefold is unsure it asks one question instead of guessing:

```
🫧 runefold ❯ thing

Did you mean the fly, the worm, or the friends? Tell me which one and I'll run it.
```

**The old commands still work.** /commands still work as a fallback, but you
don't need them. Every old command behaves exactly as before. Plain text is an
extra way in, not a replacement. You can also answer an unsure question with
one of the exact questions above.

**The honest limit.** This matcher does **not** understand all English. It is
not a model and does not call Ollama: it matches keywords and a few simple
phrases from one small table, so it can mishear an unusual sentence (and it
deliberately leaves ordinary chat alone). If it gets it wrong, try one of the
exact questions above in a different way. You can still record a correction
through the older feedback and teach paths, so it learns without a second
system. Adding a new plain-text phrase means adding one row to the table in
`core/plaintext.js`.

**Full terminal session (real output observed).** Piped into `node index.js`,
in order: `show me the fly`, `show me the mushroom body`, `show me the brain`,
then exit. ANSI colour codes were stripped. With piped input the prompt prints
once at the start, so later prompts cluster together. No Ollama was running.

```

╭────────────────────────────────────────────────────╮
│  R U N E F O L D   A I   //   ADAPTIVE CORE 0.6.1  │
│  MEMORY  ◈  RETRIEVAL  ◈  PLAN  ◈  CRITIC  ◈  TOOLS  │
╰────────────────────────────────────────────────────╯
Local-first terminal assistant • try asking: show me the fly • show me the worm • are the fly and worm friends? • what can you do?
Memory store: /home/scarletborrowedthis/.runefold

🫧 runefold ❯ (I heard that as: show me the fly — tell me if I got it wrong)

Brain templates — 5 fly modules + OpenWorm
  mushroom-body (26 neurons) — Learn smell -> approach / avoid [learnable]
  central-complex (11 neurons) — Hold a heading, correct drift
  antennal-lobe (10 neurons) — Sort two similar smells apart
  giant-fiber (10 neurons) — Fast escape from a looming shadow
  ventral-nerve-cord (10 neurons) — Walk: alternating left / right steps
  worm (54 neurons) — Crawl toward food smells and away from bad smells, and turn at walls [learnable]
Try asking: show me the mushroom body   ·   can the worm crawl to food?   ·   show me how a fly learns a new smell faster

(I heard that as: show me the mushroom body — tell me if I got it wrong)

Fly template: mushroom-body — Learn smell -> approach / avoid
  smell-a -> approach: 0/20 before training, 20/20 after
  smell-b -> avoid: 0/20 before training, 20/20 after
  wrong pairing (smell-a -> avoid): 0/10 — stays quiet, as it should
  kc-a-01 -> approach weight: now 0.38
Toy scale, simplified from the real fly circuit — see README "Brain v0.2".

(I heard that as: show me the brain — tell me if I got it wrong)

Runefold Brain v0.1 — pink + puppy -> happy
Before training: happy fired 10/20 trials (rate 0.5)
After 12 training rounds: happy fired 20/20 trials (rate 1)
hidden-a -> happy weight: 0.35 -> 0.628
Energy during the demo: 81.7 spikes/sec, 412 spikes in 504 ticks.
Toy brain, 12 neurons — it does not train the LLM. See web/brain-demo.html to watch it learn.

🫧 runefold ❯ 🫧 runefold ❯ 🫧 runefold ❯ 
This session I learned nothing new, I got better at no new skills, I rested no brains, and I had no questions I couldn't answer.
Runefold session closed. Your saved learning remains on this computer.
```

Files: `core/plaintext.js` (new — the small local matcher and kindness gate),
`index.js` (one import, plain-text help lines, one extra branch in the input
loop; no Ollama, config, chatbot or login changes), `test.js` (15 new plain-text
tests; the original 45 untouched — 60 tests total), this README.
