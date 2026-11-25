import { askModel, trimHistory } from "./provider.js";
import { buildLearningContext, autoLearnFromUser, addExperienceRecord } from "./learning.js";
import { listFiles, readFile, searchFiles, runAllowed, writeFile, editFile } from "./tools.js";
import { addJournal } from "./store.js";

const SYSTEM = `You are Runefold AI, a practical coding and problem-solving assistant.
Be accurate, direct, and transparent about uncertainty.
Use the persistent learning context to adapt to the user's preferences and ongoing projects.
A correction from the user overrides an older assumption.
Do not claim you executed code, inspected files, or changed a computer unless a tool actually did so.
When you are unsure, say what would settle it and what you would check next.
This prototype has safe read-only tools and an allow-list for running checks. It never deletes files or runs arbitrary shell commands.`;

// The cognitive loop, in miniature:
// 1. PLAN — break the task into 2-5 small steps.
// 2. ACT — answer, optionally using a tool result.
// 3. CRITIC — re-read your own answer for errors, missing steps, and over-claims.
// 4. LEARN — record the outcome only after the user confirms it.
// That loop, not a bigger model, is what makes an agent improve.
export class Agent {
  constructor(config) { this.config = config; this.history = []; }
  async plan(userText) {
    const messages = [
      { role: "system", content: "You are a planner. Break the user's task into 2-5 concrete, testable steps. Reply as a numbered list only, no extra prose." },
      { role: "user", content: userText }
    ];
    try { return await askModel(messages, this.config); } catch { return "1. Understand the request\n2. Do the smallest useful step\n3. Check the result"; }
  }
  async critic(draft, userText) {
    const messages = [
      { role: "system", content: "You are a critic. Read the draft answer, list any factual errors, missing steps, or claims that go beyond the evidence, in 3 bullets or fewer. If it is sound, say 'OK'." },
      { role: "user", content: `Task: ${userText}\n\nDraft:\n${draft}` }
    ];
    try { return await askModel(messages, this.config); } catch { return "OK (critic unavailable)"; }
  }
  async chat(userText, { useTools = false } = {}) {
    const learned = autoLearnFromUser(userText, this.config.autoLearn !== false);
    const learningContext = buildLearningContext(userText, this.config);
    let toolContext = "";
    if (useTools && this.config.tools?.enabled) {
      try {
        const files = listFiles(this.config.tools.projectRoot || ".");
        toolContext = `\nPROJECT FILES (top level):\n${files.slice(0, 30).join(", ")}`;
      } catch (e) { toolContext = `\nTool check failed: ${e.message}`; }
    }
    const messages = [
      { role: "system", content: `${SYSTEM}\n\n${learningContext}${toolContext}` },
      ...trimHistory(this.history, this.config.contextBudgetChars || 12000).slice(-(this.config.maxHistoryTurns || 6) * 2),
      { role: "user", content: userText }
    ];
    const answer = await askModel(messages, this.config);
    this.history.push({ role: "user", content: userText });
    this.history.push({ role: "assistant", content: answer });
    addJournal({ type: "chat", userText: userText.slice(0, 200), answerLength: answer.length });
    return { answer, learned };
  }
  async chatWithCritic(userText) {
    const first = await this.chat(userText);
    const critique = await this.critic(first.answer, userText);
    if (/^ok/i.test(critique.trim())) return { ...first, critique: "Critic: OK" };
    // One revision pass, with the critique in context.
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Revise this answer using the critique. Task: ${userText}\n\nDraft:\n${first.answer}\n\nCritique:\n${critique}` }
    ];
    const revised = await askModel(messages, this.config);
    return { answer: revised, learned: first.learned, critique };
  }
  toolRead(rel) { return readFile(this.config.tools?.projectRoot || ".", rel); }
  toolSearch(needle) { return searchFiles(this.config.tools?.projectRoot || ".", needle); }
  async toolRun(cmd) { return runAllowed(cmd, this.config.tools?.allowRun || []); }
  // CodeForge v0.1 — writes go through here, and only here.
  // The terminal layer (index.js) must confirm with the user
  // before calling these on an existing file.
  toolWrite(rel, content, opts) { return writeFile(this.config.tools?.projectRoot || ".", rel, content, opts); }
  toolEdit(rel, oldText, newText) { return editFile(this.config.tools?.projectRoot || ".", rel, oldText, newText); }
  logExperience(task, outcome, notes, correction) { return addExperienceRecord({ task, outcome, notes, correction }); }
}
