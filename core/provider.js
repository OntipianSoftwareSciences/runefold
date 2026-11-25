// Provider with retries, timeout, and context budgeting.
// The model is still just a next-token predictor — the "agent"
// is the loop around it, not the weights. This file keeps that
// loop from blowing up on a slow local Ollama or a dropped call.
export async function askModel(messages, config) {
  const body = { model: config.model, messages, stream: false, options: { temperature: 0.35 } };
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      let res;
      if (config.provider === "ollama") {
        res = await fetch(`${config.ollamaUrl.replace(/\/$/, "")}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return data.message?.content || "(empty response)";
      }
      if (config.provider === "compatible") {
        const key = process.env[config.apiKeyEnv || "RUNEFOLD_API_KEY"];
        const headers = { "Content-Type": "application/json" };
        if (key) headers.Authorization = `Bearer ${key}`;
        res = await fetch(`${config.compatibleBaseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers, body: JSON.stringify({ model: config.model, messages, temperature: 0.35 }), signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Endpoint ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "(empty response)";
      }
      throw new Error(`Unknown provider "${config.provider}"`);
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 500 * (attempt + 1))); }
  }
  throw lastErr;
}
// Rough token budget: ~4 chars per token. Keep the prompt
// under config.contextBudgetChars by trimming oldest history
// first, never by dropping the learning context.
export function trimHistory(history, budgetChars = 12000) {
  let total = history.reduce((n, m) => n + m.content.length, 0);
  const out = [...history];
  while (total > budgetChars && out.length > 2) { const m = out.shift(); total -= m.content.length; }
  return out;
}
