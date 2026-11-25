#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline";
import { Agent } from "./core/agent.js";
import { teach, listMemories, forgetMemory, addExperienceRecord, recordSkill, listSkills, consolidate, addGoal, listGoals, completeGoalStep, searchMemory } from "./core/learning.js";
import { dataLocation, paths, readExperiences, readJournal } from "./core/store.js";
import { startLiquidCursor, stopLiquidCursor, liquidPrompt } from "./core/cursor.js";
import { demoBrain } from "./core/brain.js";
import { listAllTemplates, runTemplateDemo, demoSummary, buildBrainFromTemplate, saveBrain, loadBrain, brainSummary, transferSavedBrain, listSavedBrains, restBrain } from "./core/fly.js";
import { KINDNESS_RULES, kindnessCharterText, checkKindness } from "./core/kindness.js";
import { demoWorm, demoWormTransfer, wormDemoSummary } from "./core/worm.js";
import { demoFriends } from "./core/friends.js";

const CONFIG_PATH = new URL("./config.json", import.meta.url);
let config;
try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch { console.error("Could not read config.json"); process.exit(1); }

const cyan = "\x1b[96m", magenta = "\x1b[95m", green = "\x1b[92m", yellow = "\x1b[93m", dim = "\x1b[2m", reset = "\x1b[0m";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: liquidPrompt() });
const agent = new Agent(config);
const ask = q => new Promise(r => rl.question(q, r));

function banner() {
  console.log(`${cyan}\n╭────────────────────────────────────────────────────╮\n│  R U N E F O L D   A I   //   ADAPTIVE CORE 0.6.1  │\n│  ${magenta}MEMORY  ◈  RETRIEVAL  ◈  PLAN  ◈  CRITIC  ◈  TOOLS${cyan}  │\n╰────────────────────────────────────────────────────╯${reset}`);
  console.log(`${dim}Local-first terminal assistant • type /help for commands • /think uses plan + critic${reset}`);
  console.log(`Memory store: ${dataLocation()}\n`);
}
function help() {
  console.log(`
${magenta}LEARNING${reset}
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
${magenta}THINKING${reset}
  /plan <task>               Plan only — break it into testable steps
  /think <task>              Plan + answer + self-critic + one revision
  /read <file>               Safe read of a file in this project
  /find <text>               Safe search across project files
  /run <command>             Only allow-listed checks, e.g. node --test test.js
${magenta}CODEFORGE v0.1 — writes ask first, backup to .bak${reset}
  /write <file>              Paste new content (end with END), preview, confirm
  /edit <file> | <old> | <new>   Replace one exact match, preview, confirm
${magenta}BRAIN v0.1 — tiny spiking neurons, not the LLM${reset}
  /brain                     Run the pink + puppy -> happy demo, print before/after
  /brain <name>              Run a saved brain's demo (see /newbrain)
${magenta}FLY BRAIN v0.2 — reverse-engineered fruit fly templates${reset}
  /fly                       List the 5 fly templates + worm, and their jobs
  /fly <name>                Run that template's demo, print before/after
  /fly transfer              Transfer demo: a new smell learned faster
                             from an old skill (fresh vs transferred)
  /template list             Same list as /fly
  /newbrain <template> <name>   Make a new brain from a template and save it
  /transfer <saved-brain> mushroom-body <new-name>
                             Transfer a saved trained brain to a new brain
                             for a new smell (smell-c), save it, print rounds
${magenta}WORM BRAIN v0.3 — OpenWorm, simplified C. elegans${reset}
  /worm                      Run the worm demo: learning numbers + grid crawl
  /worm transfer             A trained worm learns a new smell in fewer rounds
  /newbrain worm <name>      Save a toy worm brain (54 neurons)
                             /fly and /template list show it with the 5 flies
  /transfer <saved-brain> worm <new-name>
                             Reuse a worm's smell skill in a new worm brain
${magenta}FRIENDSHIP SIM — fly meets worm (toy world)${reset}
  /friends                   Fly + worm share honey and become friends in ASCII
  /friends train             Train both brains first, then compare meetings
${magenta}KINDNESS — Runefold is kind to every brain it uses${reset}
  /kind                      Print the kindness charter + core values,
                             and list the brains Runefold has made +
                             whether they rested
  /kind <job...>             Check a job against the charter — Runefold
                             refuses transphobic, racist, or harmful jobs
  /kind rest <name>          Thank a saved brain and rest it (sleep)
${magenta}OTHER${reset}
  /autolearn on|off  /status  /help  /exit
Chat normally for a plain answer. Auto-learning only saves durable, non-sensitive statements.
`);
}
function status() {
  console.log(`Provider: ${config.provider}  Model: ${config.model}  Auto-learn: ${config.autoLearn ? "ON" : "OFF"}\nMemory: ${dataLocation()}`);
  console.log(`Memories: ${listMemories().length} | Experiences: ${readExperiences(10000).length} | Skills: ${listSkills().length} | Goals: ${listGoals().filter(g => g.status === "active").length} active`);
}
// /friends prints three snapshots (start, first meeting, end) and the
// measured numbers. No Ollama call, no file writes, no other command changed.
function printFriendsNumbers(label, r) {
  console.log(`\n${magenta}${label}${reset}`);
  console.log(`  distance before: ${r.distanceBefore} | distance after: ${r.distanceAfter}`);
  console.log(`  meetings: ${r.meetings}${r.meetingsToFriendship ? ` (friends after ${r.meetingsToFriendship} friendly meetings)` : ""}`);
  console.log(`  honey shared: ${r.honeyShared}`);
  console.log(`  friends: ${r.friends ? "yes" : "no"}`);
  console.log(`  learned weight kc-a-01 -> approach: fly ${r.flyWeight}, worm ${r.wormWeight}`);
  console.log(`  worm crawl-backward after friendship: ${r.backwardMovesAfterFriendship}`);
  console.log(`  kindness gate: ${r.kindnessPassed ? "passed — no pain, no fear, no harm" : "FAILED"}`);
}
function printFriendsGrids(grids) {
  for (const name of ["start", "middle", "end"]) {
    console.log(`\n${dim}${name} grid:${reset}`);
    console.log(grids[name]);
  }
}

async function command(line) {
  const [cmd, ...rest] = line.trim().split(" ");
  const arg = rest.join(" ").trim();
  switch ((cmd || "").toLowerCase()) {
    case "/help": help(); return true;
    case "/teach": if (!arg) { console.log("Usage: /teach <text>"); return true; } console.log(teach(arg, "user-taught", "explicit user teaching").message); return true;
    case "/memory": { const items = listMemories(); if (!items.length) console.log("No memories yet."); for (const x of items) console.log(`${yellow}[${x.id}]${reset} ${magenta}${x.category}${reset} conf=${(x.confidence ?? 0.6).toFixed(2)} ${x.content}`); return true; }
    case "/forget": if (!arg) { console.log("Usage: /forget <id or phrase>"); return true; } console.log(`Deleted ${forgetMemory(arg)} matching memory item(s).`); return true;
    case "/consolidate": { const r = consolidate(); console.log(`Consolidated: kept ${r.kept}, decayed ${r.decayed}, merged ${r.merged}. Nothing explicit was deleted silently — check /memory.`); return true; }
    case "/feedback": {
      const task = await ask("Task: "); const outcome = await ask("Outcome (success/failure/partial): ");
      const notes = await ask("What happened? "); const correction = await ask("What should it do differently? (Enter to skip): ");
      console.log(`${green}Recorded: ${addExperienceRecord({ task, outcome, notes, correction }).id}${reset}`); return true;
    }
    case "/experience": { const items = readExperiences(15); if (!items.length) console.log("No experiences."); for (const x of items) console.log(`${yellow}[${x.id}]${reset} ${x.outcome.toUpperCase()} — ${x.task}\n  ${x.notes}${x.correction ? `\n  Correction: ${x.correction}` : ""}`); return true; }
    case "/skill": { const p = arg.split("|").map(x => x.trim()); if (p.length < 2) { console.log("Usage: /skill name | steps"); return true; } const s = recordSkill(p[0], p[1], p[2] || ""); console.log(`Saved skill "${s.name}" [${s.id}].`); return true; }
    case "/skills": { const items = listSkills(); if (!items.length) console.log("No skills."); for (const s of items) console.log(`${yellow}[${s.id}]${reset} ${s.name}\n  ${s.steps}\n  Use when: ${s.whenToUse}`); return true; }
    case "/goal": { const p = arg.split("|").map(x => x.trim()); if (!p[0]) { console.log("Usage: /goal text | step1; step2"); return true; } const g = addGoal(p[0], p[1] ? p[1].split(";").map(x => x.trim()) : []); console.log(`Goal [${g.id}]: ${g.text}`); return true; }
    case "/goals": { const items = listGoals(); if (!items.length) console.log("No goals."); for (const g of items) console.log(`${yellow}[${g.id}]${reset} ${g.status} ${g.text} [${g.done.length}/${g.steps.length}]`); return true; }
    case "/search": { if (!arg) { console.log("Usage: /search <query>"); return true; } const r = searchMemory(arg, 5, config); console.log("Memories:"); for (const m of r.memories) console.log(`  ${m.score.toFixed(3)} [${m.category}] ${m.content}`); console.log("Experiences:"); for (const e of r.experiences) console.log(`  ${e.score.toFixed(3)} ${e.task} (${e.outcome})`); return true; }
    case "/journal": { for (const j of readJournal(15)) console.log(`${j.at} ${j.type} ${j.task || j.userText || ""}`); return true; }
    case "/plan": if (!arg) { console.log("Usage: /plan <task>"); return true; } console.log(await agent.plan(arg)); return true;
    case "/think": if (!arg) { console.log("Usage: /think <task>"); return true; } startLiquidCursor("planning + criticising"); { const r = await agent.chatWithCritic(arg); stopLiquidCursor(); console.log(`\n${green}${r.answer}${reset}\n${dim}${r.critique}${reset}\n`); } return true;
    case "/read": if (!arg) { console.log("Usage: /read <file>"); return true; } try { console.log(agent.toolRead(arg)); } catch (e) { console.log(`Cannot read: ${e.message}`); } return true;
    case "/find": if (!arg) { console.log("Usage: /find <text>"); return true; } console.log(agent.toolSearch(arg).join("\n") || "No matches."); return true;
    case "/run": if (!arg) { console.log("Usage: /run <allow-listed command>"); return true; } try { console.log(await agent.toolRun(arg)); } catch (e) { console.log(`Blocked / failed: ${e.message}`); } return true;
    case "/write": {
      if (!arg) { console.log("Usage: /write <file>"); return true; }
      console.log(`Writing to ${arg}. Paste content, end with a line containing only END:`);
      const lines = [];
      while (true) { const l = await ask(""); if (l.trim() === "END") break; lines.push(l); }
      const content = lines.join("\n") + (lines.length ? "\n" : "");
      console.log(`\n--- preview (${content.length} chars, first 20 lines) ---`);
      console.log(lines.slice(0, 20).join("\n"));
      console.log("--- end preview ---");
      const confirm = await ask(`Write to ${arg}? Old file, if any, is backed up to ${arg}.bak. [y/N]: `);
      if (confirm.trim().toLowerCase() !== "y") { console.log("Cancelled — nothing written."); return true; }
      try { const r = agent.toolWrite(arg, content, { overwrite: true }); console.log(`Wrote ${r.path} (${r.bytes} bytes)${r.overwritten ? ` — old file backed up to ${r.backup}` : " — new file"}.`); }
      catch (e) { console.log(`Cannot write: ${e.message}`); }
      return true;
    }
    case "/edit": {
      const p = arg.split("|").map(x => x.trim());
      if (p.length < 3) { console.log("Usage: /edit <file> | <old text> | <new text>"); return true; }
      const [file, oldText, newText] = p;
      try {
        const current = agent.toolRead(file);
        if (!current.includes(oldText)) { console.log("Old text not found in that file."); return true; }
        console.log(`In ${file}, replace:\n  - ${oldText.slice(0, 120)}\nwith:\n  + ${newText.slice(0, 120)}`);
        const confirm = await ask("Apply this edit? [y/N]: ");
        if (confirm.trim().toLowerCase() !== "y") { console.log("Cancelled — nothing changed."); return true; }
        const r = agent.toolEdit(file, oldText, newText);
        console.log(`Edited ${r.path} — backup at ${r.backup}.`);
      } catch (e) { console.log(`Cannot edit: ${e.message}`); }
      return true;
    }
    case "/brain": {
      // /brain <name> runs a SAVED brain's demo; plain /brain is the v0.1 demo.
      if (arg) {
        try {
          const saved = loadBrain(arg);
          const summary = brainSummary(saved, arg);
          console.log(`\n${magenta}Saved brain "${arg}"${reset} — template ${summary.template}, ${summary.neurons} neurons, ${summary.connections} connections`);
          console.log(`Inputs: ${summary.inputs.join(", ")} | Outputs: ${summary.outputs.join(", ")}`);
          // v0.3: a saved worm uses the worm demo; fly brains are unchanged.
          const isWorm = saved.template === "worm";
          const result = isWorm ? demoWorm(saved) : runTemplateDemo(saved.template, saved);
          const lines = isWorm ? wormDemoSummary(result) : demoSummary(result);
          for (const line of lines) console.log(`  ${line}`);
          console.log(`${dim}The demo runs on the loaded brain in memory; your saved brain on disk is not changed by it.${reset}\n`);
        } catch (e) { console.log(`Cannot run that brain: ${e.message}`); }
        return true;
      }
      const d = demoBrain();
      console.log(`\n${magenta}Runefold Brain v0.1 — pink + puppy -> happy${reset}`);
      console.log(`Before training: happy fired ${d.before.spikes}/${d.before.steps} trials (rate ${d.before.rate})`);
      console.log(`After 12 training rounds: happy fired ${d.after.spikes}/${d.after.steps} trials (rate ${d.after.rate})`);
      console.log(`hidden-a -> happy weight: ${d.weightBefore} -> ${d.weightAfter}`);
      console.log(`Energy during the demo: ${d.spikesPerSecond} spikes/sec, ${d.totalSpikes} spikes in ${d.ticks} ticks.`);
      console.log(`${dim}Toy brain, 12 neurons — it does not train the LLM. See web/brain-demo.html to watch it learn.${reset}\n`);
      return true;
    }
    case "/fly": {
      // /fly lists templates; /fly <name> runs that template's demo.
      // v0.3: the list now includes the worm; fly demos are unchanged.
      if (!arg) {
        console.log(`\n${magenta}Brain templates — 5 fly modules + OpenWorm${reset}`);
        for (const t of listAllTemplates()) {
          console.log(`  ${t.name} (${t.neurons} neurons) — ${t.job}${t.learnable ? " [learnable]" : ""}`);
        }
        console.log(`${dim}Try: /fly mushroom-body   or   /fly worm   or   /fly transfer   or   /newbrain worm my-worm${reset}\n`);
        return true;
      }
      if (arg === "worm" || arg === "worm-transfer") {
        const result = arg === "worm" ? demoWorm() : demoWormTransfer();
        console.log(`\n${magenta}Worm template: ${result.template} — ${result.job}${reset}`);
        for (const line of wormDemoSummary(result)) console.log(`  ${line}`);
        console.log(`${dim}Toy scale, simplified from C. elegans — see README "Brain v0.3".${reset}\n`);
        return true;
      }
      try {
        const result = runTemplateDemo(arg);
        console.log(`\n${magenta}Fly template: ${result.template} — ${result.job}${reset}`);
        for (const line of demoSummary(result)) console.log(`  ${line}`);
        console.log(`${dim}Toy scale, simplified from the real fly circuit — see README "Brain v0.2".${reset}\n`);
      } catch (e) { console.log(`Cannot run that template: ${e.message}`); }
      return true;
    }
    case "/template": {
      if (arg && arg !== "list") { console.log("Usage: /template list"); return true; }
      console.log(`\n${magenta}Brain templates — 5 fly modules + OpenWorm${reset}`);
      for (const t of listAllTemplates()) {
        console.log(`  ${t.name} (${t.neurons} neurons) — ${t.job}${t.learnable ? " [learnable]" : ""}`);
      }
      console.log("");
      return true;
    }
    case "/worm": {
      // v0.3: the whole toy worm — learning numbers and a grid-world crawl.
      // No Ollama needed. The build inside demoWorm() goes through the
      // existing kindness gate in core/fly.js -> core/kindness.js.
      if (arg && arg !== "transfer") { console.log("Usage: /worm  or  /worm transfer"); return true; }
      const result = arg === "transfer" ? demoWormTransfer() : demoWorm();
      console.log(`\n${magenta}Worm brain v0.3: ${result.template} — ${result.job}${reset}`);
      for (const line of wormDemoSummary(result)) console.log(`  ${line}`);
      console.log(`${dim}C. elegans, toy scale — not a living worm, not AGI. See README "Brain v0.3".${reset}\n`);
      return true;
    }
    case "/friends": {
      // Small, safe addition: only this command runs the new world.
      if (arg && arg !== "train") { console.log("Usage: /friends  or  /friends train"); return true; }
      if (arg === "train") {
        const r = demoFriends({ compare: true });
        console.log(`\n${magenta}Fly Meets Worm — trained pair (F = fly, w = worm, H = honeycomb, * = honey, ♥ = friends)${reset}`);
        printFriendsGrids(r.trained.grids);
        printFriendsNumbers("untrained pair — same world, no head start", r.untrained);
        printFriendsNumbers("trained pair — both brains trained first", r.trained);
        console.log(`  meetings saved by training: ${r.meetingsSaved} (untrained ${r.untrained.meetingsToFriendship} -> trained ${r.trained.meetingsToFriendship})`);
        console.log(`${dim}Both pairs use the same STDP lesson in core/friends.js; only the starting weights differ.${reset}\n`);
        return true;
      }
      const r = demoFriends();
      console.log(`\n${magenta}Fly Meets Worm — friendship simulation (F = fly, w = worm, H = honeycomb, * = honey, ♥ = friends)${reset}`);
      printFriendsGrids(r.grids);
      printFriendsNumbers("final numbers", r);
      console.log(`${dim}Toy ASCII world with two simulated brains learning a positive association — not real animals, not feelings.${reset}\n`);
      return true;
    }
    case "/newbrain": {
      const parts = arg.split(/\s+/).filter(Boolean);
      if (parts.length < 2) { console.log("Usage: /newbrain <template> <name>  e.g. /newbrain mushroom-body my-first-fly-brain"); return true; }
      const [templateName, brainName] = parts;
      try {
        const brain = buildBrainFromTemplate(templateName);
        saveBrain(brainName, templateName, brain);
        const summary = brainSummary(brain, brainName);
        console.log(`\n${green}New brain "${brainName}" saved.${reset} Template: ${summary.template} — ${brain.templateJob}`);
        console.log(`Neurons: ${summary.neurons} | Connections: ${summary.connections}`);
        console.log(`Inputs: ${summary.inputs.join(", ")}`);
        console.log(`Outputs: ${summary.outputs.join(", ")}`);
        console.log(`${dim}Saved in your Runefold memory store (brains.json). Run it with /brain ${brainName} or /fly ${templateName}.${reset}\n`);
      } catch (e) { console.log(`Cannot make that brain: ${e.message}`); }
      return true;
    }
    case "/kind": {
      const parts = arg.split(/\s+/).filter(Boolean);
      if (parts[0] === "rest") {
        if (!parts[1]) { console.log("Usage: /kind rest <name>  e.g. /kind rest my-first-fly-brain"); return true; }
        try {
          const r = restBrain(parts[1]);
          console.log(`\n${green}${r.thankYou}${reset}`);
          console.log(`Brain "${r.name}" (${r.template}) rested at ${r.restedAt}.`);
          console.log(`Sleep: strengthened ${r.sleep.strengthened}, decayed ${r.sleep.decayed}, pruned ${r.sleep.pruned}.`);
          console.log(`${dim}Rest is part of learning — sleep keeps what mattered and lets go of the rest.${reset}\n`);
        } catch (e) { console.log(`Cannot rest that brain: ${e.message}`); }
        return true;
      }
      // /kind <job...> — check any job against the charter, in-terminal.
      // A transphobic, racist, or harmful job is refused kindly here;
      // a kind, respectful job is allowed. The job is NOT done and then
      // excused with a disclaimer — it is refused before it starts.
      if (parts.length) {
        const job = arg;
        const check = checkKindness(job);
        console.log(`\n${check.ok ? green : yellow}${check.reason}${reset}\n`);
        return true;
      }
      console.log(`\n${magenta}${kindnessCharterText()}${reset}`);
      const saved = listSavedBrains();
      console.log(`\n${magenta}Brains Runefold has made:${reset}`);
      if (!saved.length) console.log("  None saved yet — try /newbrain mushroom-body my-first-fly-brain");
      for (const b of saved) {
        console.log(`  ${b.name} (${b.template}) — rested: ${b.rested ? `yes${b.restedAt ? ` (${b.restedAt})` : ""}` : "not yet — try /kind rest " + b.name}`);
      }
      console.log(`${dim}${KINDNESS_RULES.length} kindness rules, in core/kindness.js. A simulated brain does not feel pain like a living animal — Runefold is kind anyway.${reset}\n`);
      return true;
    }
    case "/transfer": {
      const parts = arg.split(/\s+/).filter(Boolean);
      if (parts.length < 3) { console.log("Usage: /transfer <saved-brain> mushroom-body|worm <new-name>  e.g. /transfer my-worm worm my-new-worm"); return true; }
      const [sourceName, newTemplate, newName] = parts;
      try {
        const r = transferSavedBrain(sourceName, newTemplate, newName);
        console.log(`\n${green}Transferred "${sourceName}" -> new brain "${newName}".${reset}`);
        console.log(`Copied approach weight (halved, from the source brain): ${r.copiedApproachWeight}`);
        console.log(`New smell-c -> approach before retraining: rate ${r.beforeRate}`);
        console.log(`Training rounds to reach 80%: ${r.roundsToLearn}`);
        console.log(`New smell-c -> approach after retraining: rate ${r.afterRate}`);
        console.log(`${dim}Saved as "${newName}". The old skill was reused; only the new smell was retrained. Compare with a fresh brain: /fly transfer.${reset}\n`);
      } catch (e) { console.log(`Cannot transfer: ${e.message}`); }
      return true;
    }
    case "/autolearn": if (arg === "on") config.autoLearn = true; else if (arg === "off") config.autoLearn = false; else { console.log("Usage: /autolearn on|off"); return true; } fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); console.log(`Auto-learn ${config.autoLearn ? "ON" : "OFF"}.`); return true;
    case "/status": status(); return true;
    case "/exit": case "/quit": rl.close(); return false;
    default: return null;
  }
}

if (process.argv.includes("--doctor")) {
  console.log("Node:", process.version); console.log("Config:", config); console.log("Memory:", dataLocation()); console.log("Paths:", paths());
  console.log("Runefold doctor complete."); process.exit(0);
}
banner(); rl.prompt();
rl.on("line", async line => {
  const input = line.trim(); if (!input) return rl.prompt();
  try {
    if (input.startsWith("/")) {
      const result = await command(input);
      if (result === false) return;
      if (result === null) console.log("Unknown command. Type /help.");
    } else {
      startLiquidCursor();
      const result = await agent.chat(input, { useTools: true }); stopLiquidCursor();
      if (result.learned) console.log(`${dim}◈ learned a durable ${result.learned.category} detail (conf ${result.learned.confidence})${reset}`);
      console.log(`\n${green}${result.answer}${reset}\n`);
    }
  } catch (err) { console.log(`\n${yellow}Runefold error:${reset} ${err.message}\n`); }
  rl.prompt();
});
rl.on("close", () => { console.log(`\n${cyan}Runefold session closed. Your saved learning remains on this computer.${reset}`); process.exit(0); });
