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
import { startSession, trackSessionEvent, closeSession, getSessionSummary, sessionSummaryText } from "./core/autosave.js";
import { parsePlainText, heardAs, plainTextMeaning } from "./core/plaintext.js";

const CONFIG_PATH = new URL("./config.json", import.meta.url);
let config;
try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch { console.error("Could not read config.json"); process.exit(1); }

const cyan = "\x1b[96m", magenta = "\x1b[95m", green = "\x1b[92m", yellow = "\x1b[93m", dim = "\x1b[2m", reset = "\x1b[0m";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: liquidPrompt() });
const agent = new Agent(config);
const ask = q => new Promise(r => rl.question(q, r));

function banner() {
  console.log(`${cyan}\n╭────────────────────────────────────────────────────╮\n│  R U N E F O L D   A I   //   ADAPTIVE CORE 0.6.1  │\n│  ${magenta}MEMORY  ◈  RETRIEVAL  ◈  PLAN  ◈  CRITIC  ◈  TOOLS${cyan}  │\n╰────────────────────────────────────────────────────╯${reset}`);
  console.log(`${dim}Local-first terminal assistant • try asking: show me the fly • show me the worm • are the fly and worm friends? • what can you do?${reset}`);
  console.log(`Memory store: ${dataLocation()}\n`);
}
function help() {
  console.log(`
${magenta}ASK ME A QUESTION — no slash needed${reset}
You can also just type in plain words. Here are specific questions to try:

${magenta}START HERE${reset}
  "what can you do?"                       What Runefold can do right now
  "who are you?"                           A short local answer about me

${magenta}FLY${reset}
  "show me the fly"                        List the fly modules and their jobs
  "show me the mushroom body"              Watch a fly learn one smell means approach
  "can the fly learn a new smell?"         The same learning demo, asked as a question
  "show me how a fly learns a new smell faster"   Watch a fly reuse an old skill

${magenta}WORM${reset}
  "show me the worm"                       Watch the worm learn smells and crawl a grid
  "can the worm crawl to food?"            Watch it crawl toward food and turn at walls
  "show me how a worm learns a new smell faster"   A trained worm reuses an old skill

${magenta}FRIENDS${reset}
  "are the fly and worm friends?"          Two toy brains share honey in a little ASCII world
  "show me the friends"                    The same world, another way to ask
  "make them friends faster"               Compare a pair that trained first

${magenta}BRAIN${reset}
  "show me the brain"                      The pink + puppy -> happy spiking demo
  "what did the brain learn?"              Before and after numbers, same demo

${magenta}KINDNESS${reset}
  "what are your rules?"                   The kindness charter and the core values
  "be kind"                                The same charter, in plain words

${magenta}SESSION${reset}
  "what did you learn last time?"          This session's learning summary
  "what have you learned?"                 The same summary, another way to ask

${magenta}SPACE — coming next${reset}
  "tell me about black holes"              I can name the topic, but there is no live
                                           space reference built here yet — coming next

${magenta}EVERYDAY WORK${reset}
You can ask me to turn auto-learning on or off, show your status, or close
the session. Session learning saves itself every 5 minutes or 10 messages
and on exit — you do not need to do anything. Ordinary chat still uses Ollama.

Old /commands still work if you type them, but you don't need them.
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
    case "/teach": if (!arg) { console.log("Tell me what to teach, for example: I prefer pink terminals."); return true; } { const r = teach(arg, "user-taught", "explicit user teaching"); console.log(r.message); if (r.ok && r.item) trackSessionEvent({ type: "teach", text: arg, id: r.item.id }); } return true;
    case "/memory": { const items = listMemories(); if (!items.length) console.log("No memories yet."); for (const x of items) console.log(`${yellow}[${x.id}]${reset} ${magenta}${x.category}${reset} conf=${(x.confidence ?? 0.6).toFixed(2)} ${x.content}`); return true; }
    case "/forget": if (!arg) { console.log("Tell me which memory to forget, by id or by a few words from it."); return true; } console.log(`Deleted ${forgetMemory(arg)} matching memory item(s).`); return true;
    case "/consolidate": { const r = consolidate(); console.log(`Consolidated: kept ${r.kept}, decayed ${r.decayed}, merged ${r.merged}. Nothing explicit was deleted silently — check what you have taught me.`); return true; }
    case "/feedback": {
      const task = await ask("Task: "); const outcome = await ask("Outcome (success/failure/partial): ");
      const notes = await ask("What happened? "); const correction = await ask("What should it do differently? (Enter to skip): ");
      const rec = addExperienceRecord({ task, outcome, notes, correction });
      const matched = listMemories().find(m => m.content.toLowerCase().includes(String(task).toLowerCase()));
      const outcomeType = outcome === "success" ? "accept" : "reject";
      trackSessionEvent({ type: outcomeType, text: task, id: matched && matched.id });
      trackSessionEvent({ type: outcome === "success" ? "success" : "failure", text: task || notes });
      console.log(`${green}Recorded: ${rec.id}${reset}`); return true;
    }
    case "/experience": { const items = readExperiences(15); if (!items.length) console.log("No experiences."); for (const x of items) console.log(`${yellow}[${x.id}]${reset} ${x.outcome.toUpperCase()} — ${x.task}\n  ${x.notes}${x.correction ? `\n  Correction: ${x.correction}` : ""}`); return true; }
    case "/skill": { const p = arg.split("|").map(x => x.trim()); if (p.length < 2) { console.log("Give a skill name and its steps, separated by a pipe."); return true; } const s = recordSkill(p[0], p[1], p[2] || ""); console.log(`Saved skill "${s.name}" [${s.id}].`); return true; }
    case "/skills": { const items = listSkills(); if (!items.length) console.log("No skills."); for (const s of items) console.log(`${yellow}[${s.id}]${reset} ${s.name}\n  ${s.steps}\n  Use when: ${s.whenToUse}`); return true; }
    case "/goal": { const p = arg.split("|").map(x => x.trim()); if (!p[0]) { console.log("Give a goal and its steps, for example: finish the report | draft; review; send"); return true; } const g = addGoal(p[0], p[1] ? p[1].split(";").map(x => x.trim()) : []); console.log(`Goal [${g.id}]: ${g.text}`); return true; }
    case "/goals": { const items = listGoals(); if (!items.length) console.log("No goals."); for (const g of items) console.log(`${yellow}[${g.id}]${reset} ${g.status} ${g.text} [${g.done.length}/${g.steps.length}]`); return true; }
    case "/search": { if (!arg) { console.log("Tell me what to search for in your memories."); return true; } const r = searchMemory(arg, 5, config); console.log("Memories:"); for (const m of r.memories) console.log(`  ${m.score.toFixed(3)} [${m.category}] ${m.content}`); console.log("Experiences:"); for (const e of r.experiences) console.log(`  ${e.score.toFixed(3)} ${e.task} (${e.outcome})`); return true; }
    case "/journal": { for (const j of readJournal(15)) console.log(`${j.at} ${j.type} ${j.task || j.userText || ""}`); return true; }
    case "/plan": if (!arg) { console.log("Tell me what task to break into steps."); return true; } console.log(await agent.plan(arg)); return true;
    case "/think": if (!arg) { console.log("Tell me what task to think through."); return true; } startLiquidCursor("planning + criticising"); { const r = await agent.chatWithCritic(arg); stopLiquidCursor(); console.log(`\n${green}${r.answer}${reset}\n${dim}${r.critique}${reset}\n`); } return true;
    case "/read": if (!arg) { console.log("Tell me which file in this project to read."); return true; } try { console.log(agent.toolRead(arg)); } catch (e) { console.log(`Cannot read: ${e.message}`); } return true;
    case "/find": if (!arg) { console.log("Tell me what text to find in this project."); return true; } console.log(agent.toolSearch(arg).join("\n") || "No matches."); return true;
    case "/run": if (!arg) { console.log("Tell me which allow-listed check to run, for example: node --test test.js"); return true; } try { console.log(await agent.toolRun(arg)); } catch (e) { console.log(`Blocked / failed: ${e.message}`); } return true;
    case "/write": {
      if (!arg) { console.log("Tell me which file to write."); return true; }
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
      if (p.length < 3) { console.log("Give the file, the exact old text, and the new text, separated by pipes."); return true; }
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
          trackSessionEvent({ type: "brain", name: arg, template: saved.template, action: "used", brain: saved });
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
        console.log(`${dim}Try asking: show me the mushroom body   ·   can the worm crawl to food?   ·   show me how a fly learns a new smell faster${reset}\n`);
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
      if (arg && arg !== "list") { console.log("Ask 'show me the fly' to list the brain templates."); return true; }
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
      if (arg && arg !== "transfer") { console.log("Ask: show me the worm, or show me how a worm learns a new smell faster."); return true; }
      const result = arg === "transfer" ? demoWormTransfer() : demoWorm();
      console.log(`\n${magenta}Worm brain v0.3: ${result.template} — ${result.job}${reset}`);
      for (const line of wormDemoSummary(result)) console.log(`  ${line}`);
      console.log(`${dim}C. elegans, toy scale — not a living worm, not AGI. See README "Brain v0.3".${reset}\n`);
      return true;
    }
    case "/friends": {
      // Small, safe addition: only this command runs the new world.
      if (arg && arg !== "train") { console.log("Ask: are the fly and worm friends?, or make them friends faster."); return true; }
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
      if (parts.length < 2) { console.log("Give a template and a name for the new brain, for example: mushroom-body my-first-fly-brain"); return true; }
      const [templateName, brainName] = parts;
      try {
        const brain = buildBrainFromTemplate(templateName);
        saveBrain(brainName, templateName, brain);
        trackSessionEvent({ type: "brain", name: brainName, template: templateName, action: "trained", brain });
        const summary = brainSummary(brain, brainName);
        console.log(`\n${green}New brain "${brainName}" saved.${reset} Template: ${summary.template} — ${brain.templateJob}`);
        console.log(`Neurons: ${summary.neurons} | Connections: ${summary.connections}`);
        console.log(`Inputs: ${summary.inputs.join(", ")}`);
        console.log(`Outputs: ${summary.outputs.join(", ")}`);
        console.log(`${dim}Saved in your Runefold memory store (brains.json). You can run it by name as ${brainName}, or ask 'show me the fly' to see the templates.${reset}\n`);
      } catch (e) { console.log(`Cannot make that brain: ${e.message}`); }
      return true;
    }
    case "/kind": {
      const parts = arg.split(/\s+/).filter(Boolean);
      if (parts[0] === "rest") {
        if (!parts[1]) { console.log("Name a saved brain to thank and rest it, for example: my-first-fly-brain"); return true; }
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
      if (!saved.length) console.log("  None saved yet — try asking: show me the mushroom body");
      for (const b of saved) {
        console.log(`  ${b.name} (${b.template}) — rested: ${b.rested ? `yes${b.restedAt ? ` (${b.restedAt})` : ""}` : "not yet — ask me to thank and rest " + b.name}`);
      }
      console.log(`${dim}${KINDNESS_RULES.length} kindness rules, in core/kindness.js. A simulated brain does not feel pain like a living animal — Runefold is kind anyway.${reset}\n`);
      return true;
    }
    case "/transfer": {
      const parts = arg.split(/\s+/).filter(Boolean);
      if (parts.length < 3) { console.log("Give a saved brain, a template (mushroom-body or worm), and a name for the new brain, for example: my-worm worm my-new-worm"); return true; }
      const [sourceName, newTemplate, newName] = parts;
      try {
        const r = transferSavedBrain(sourceName, newTemplate, newName);
        trackSessionEvent({ type: "brain", name: newName, template: newTemplate, action: "trained" });
        console.log(`\n${green}Transferred "${sourceName}" -> new brain "${newName}".${reset}`);
        console.log(`Copied approach weight (halved, from the source brain): ${r.copiedApproachWeight}`);
        console.log(`New smell-c -> approach before retraining: rate ${r.beforeRate}`);
        console.log(`Training rounds to reach 80%: ${r.roundsToLearn}`);
        console.log(`New smell-c -> approach after retraining: rate ${r.afterRate}`);
        console.log(`${dim}Saved as "${newName}". The old skill was reused; only the new smell was retrained. Compare with a fresh brain: show me how a fly learns a new smell faster.${reset}\n`);
      } catch (e) { console.log(`Cannot transfer: ${e.message}`); }
      return true;
    }
    case "/autolearn": if (arg === "on") config.autoLearn = true; else if (arg === "off") config.autoLearn = false; else { console.log("Say on or off to turn auto-learning on or off."); return true; } fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); console.log(`Auto-learn ${config.autoLearn ? "ON" : "OFF"}.`); return true;
    case "/status": status(); return true;
    case "/session": console.log(sessionSummaryText(getSessionSummary())); return true;
    case "/exit": case "/quit": rl.close(); return false;
    default: return null;
  }
}

if (process.argv.includes("--doctor")) {
  console.log("Node:", process.version); console.log("Config:", config); console.log("Memory:", dataLocation()); console.log("Paths:", paths());
  console.log("Runefold doctor complete."); process.exit(0);
}
banner();
const started = startSession();
if (started.welcomeLine) console.log(started.welcomeLine);
rl.prompt();

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try { await closeSession({ quiet: true }); } catch { /* still close cleanly */ }
  console.log(`\n${cyan}${sessionSummaryText(getSessionSummary())}${reset}`);
  console.log(`${cyan}Runefold session closed. Your saved learning remains on this computer.${reset}`);
  process.exit(0);
}

rl.on("line", async line => {
  const input = line.trim(); if (!input) return rl.prompt();
  const cmdName = input.startsWith("/") ? input.split(" ")[0] : null;
  try {
    if (cmdName) {
      const result = await command(input);
      if (result === false) return;
      if (result === null) {
        console.log("I didn't recognise that. Ask 'what can you do?' to see what I can do.");
        trackSessionEvent({ type: "command", name: cmdName, outcome: "unknown" });
      } else {
        trackSessionEvent({ type: "command", name: cmdName, outcome: "success" });
      }
    } else {
      // Plain text is an EXTRA way in, tried first. Only when the small local
      // matcher finds no match at all does the line stay normal chat and go
      // to Ollama, exactly as it did before. /commands are untouched.
      const parsed = parsePlainText(input);
      if (parsed.route === "refusal") {
        // The existing checkKindness() already refused this kindly.
        console.log(`\n${yellow}${parsed.refusal}${reset}\n`);
      } else if (parsed.route === "question") {
        // Unsure: ask ONE question and wait. Never run a random command.
        console.log(`\n${yellow}${parsed.question}${reset}\n`);
        trackSessionEvent({ type: "question", text: input });
      } else if (parsed.route === "reply") {
        // The topic maps to a command not built yet (/space, /physics,
        // /alien). Say so, name the local source, run nothing, call no Ollama.
        console.log(`\n${dim}${parsed.note}${reset}\n`);
      } else if (parsed.route === "command") {
        // High / medium match: run the EXISTING command and say what we heard.
        const heard = heardAs(parsed);
        const meaning = plainTextMeaning(parsed);
        console.log(`${dim}(I heard that as: ${meaning} — tell me if I got it wrong)${reset}`);
        const result = await command(heard);
        if (result === false) return;
        if (result === null) console.log("I didn't recognise that. Ask 'what can you do?' to see what I can do.");
        trackSessionEvent({ type: "command", name: heard, outcome: result === null ? "unknown" : "success" });
      } else {
        // No match: normal chat. Ollama is still required here, and only here.
        trackSessionEvent({ type: "userMessage", text: input });
        startLiquidCursor();
        const result = await agent.chat(input, { useTools: true }); stopLiquidCursor();
        if (result.learned) {
          trackSessionEvent({ type: "teach", text: result.learned.content, id: result.learned.id });
          console.log(`${dim}◈ learned a durable ${result.learned.category} detail (conf ${result.learned.confidence})${reset}`);
        }
        if (/\b(don't know|do not know|can't answer|cannot answer|not sure|no answer)\b/i.test(result.answer || "")) {
          trackSessionEvent({ type: "question", text: input });
        }
        console.log(`\n${green}${result.answer}${reset}\n`);
      }
    }
  } catch (err) {
    if (cmdName) trackSessionEvent({ type: "command", name: cmdName, outcome: "failure" });
    else trackSessionEvent({ type: "failure", text: input, detail: err.message });
    console.log(`\n${yellow}Runefold error:${reset} ${err.message}\n`);
  }
  rl.prompt();
});
rl.on("close", shutdown);
process.on("SIGINT", () => { rl.close(); });
process.on("SIGTERM", () => { rl.close(); });
