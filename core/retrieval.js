// Retrieval that actually ranks, instead of v0.5's "does this word
// appear at all?" check.
// TF-IDF + cosine similarity, plus recency decay and a confidence
// weight. No dependencies, no embeddings server needed — this is
// the best ranking you can get with plain JavaScript, and it is
// honest about its limits: it matches words, not meaning.
// The upgrade path later is real embeddings (e.g. Ollama
// nomic-embed-text), which would plug in here behind the same
// `search()` interface.
const STOP = new Set("a an the and or but if then else when at by for with about into through after over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just don should now i you he she it we they me him her us them my your his its our their this that these those am is are was were be been being have has had do does did".split(" "));
export function tokenize(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
}
function tf(tokens) {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  for (const [k, v] of m) m.set(k, 1 + Math.log(v));
  return m;
}
function idf(docs) {
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const out = new Map();
  for (const [t, n] of df) out.set(t, Math.log((docs.length + 1) / (n + 0.5)) + 1);
  return out;
}
function cosine(a, b, idfMap) {
  let dot = 0, na = 0, nb = 0;
  for (const [t, v] of a) { const w = v * (idfMap.get(t) ?? 1); na += w * w; if (b.has(t)) dot += w * b.get(t) * (idfMap.get(t) ?? 1); }
  for (const v of b.values()) nb += v * v;
  return dot / (Math.sqrt(na || 1) * Math.sqrt(nb || 1));
}
export function recencyBoost(iso, halfLifeDays = 30) {
  const ageDays = (Date.now() - new Date(iso || 0).getTime()) / 86400000;
  if (!isFinite(ageDays) || ageDays < 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}
// docs: [{ text, weight, createdAt, ...rest }]
export function search(query, docs, { limit = 10, minScore = 0.08, halfLifeDays = 30 } = {}) {
  const qTokens = tokenize(query);
  if (!qTokens.length || !docs.length) return [];
  const docTokens = docs.map(d => tokenize(d.text));
  const idfMap = idf(docTokens);
  const q = tf(qTokens);
  return docs.map((d, i) => {
    const sim = cosine(q, tf(docTokens[i]), idfMap);
    const score = sim * (d.weight ?? 1) * recencyBoost(d.createdAt, halfLifeDays);
    return { ...d, score, similarity: sim };
  }).filter(x => x.score >= minScore).sort((a, b) => b.score - a.score).slice(0, limit);
}
