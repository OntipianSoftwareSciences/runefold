// Runefold Physics + Space — plain-words knowledge, live Wikipedia and NASA.
//
// What this is, in plain words:
//   A small LOCAL knowledge base about physics and space. Each topic carries
//   a short explanation, a few real numbers, why it matters, and a source
//   named in plain words. Scarlet can ask without an internet connection.
//   When the network is available, Runefold also asks Wikipedia for a short
//   summary and NASA for the daily space picture / near-Earth asteroids.
//
// Reuse — no second knowledge or ethics system:
//   * Numbers and explanations live in plain objects, like the fly/worm
//     templates in core/fly.js and core/worm.js. No database, no embeddings.
//   * Every answer goes through the EXISTING checkKindness() from
//     core/kindness.js, the same gate a fly brain or a plain-text line uses.
//   * Live results are cached in the SAME ~/.runefold store via core/store.js,
//     so the same topic is not fetched twice in one session.
//   * The terminal only prints a URL for NASA's picture — it never downloads
//     an image, and it never touches the Ollama provider, config or login.
//
// Honest limits:
//   This is a hand-written base of 20+ topics, not an encyclopedia. It says
//   "I don't know that number" for numbers it does not keep. Live requests
//   are best-effort: offline it falls back to local knowledge and says so.
//   NASA uses DEMO_KEY unless Scarlet has added her own NASA_API_KEY to
//   config.json herself. This file never writes or changes config.json.

import fs from "node:fs";
import { dataLocation, readJson, writeJson } from "./store.js";
import { checkKindness } from "./kindness.js";

const CONFIG_PATH = new URL("../config.json", import.meta.url);
const NO_NUMBER = "I don't know that number — I only keep the numbers listed above.";
const WIKI_OFFLINE = "I couldn't reach Wikipedia, so here's what I know locally.";
const NASA_OFFLINE = "I couldn't reach NASA, so I have no live result to show right now. I did not download anything.";

// ---------------------------------------------------------------------------
// The local knowledge base. 23 topics, each with a plain-words summary,
// key numbers, why it matters, and a named source.
// ---------------------------------------------------------------------------

export const SPACE_TOPICS = [
  {
    key: "gravity",
    title: "Gravity",
    aliases: ["gravity", "gravitation", "general relativity gravity"],
    summary: "Gravity is the pull between anything that has mass. It keeps your feet on the ground and the Moon in its path around Earth.",
    numbers: [
      ["Pull at Earth's surface", "about 9.8 metres per second squared"],
      ["Pull at the Moon's surface", "about 1.6 metres per second squared"],
    ],
    why: "It sets the shape of orbits, the height of tides, and whether a body can hold on to an atmosphere.",
    source: "NASA Earth Observatory and NASA Moon facts",
  },
  {
    key: "orbits",
    title: "Orbits",
    aliases: ["orbit", "orbits", "orbital motion", "why planets orbit"],
    summary: "An orbit is a sideways fall around something. Earth keeps missing the Sun as it falls toward it, so it goes around instead of hitting it.",
    numbers: [
      ["Earth's year", "about 365.25 days"],
      ["Earth's average distance from the Sun", "about 150 million kilometres"],
    ],
    why: "Orbits give us years, seasons, tides, and a stable place for life to develop.",
    source: "NASA Earth facts and NASA Solar System exploration",
  },
  {
    key: "black-hole",
    title: "Black holes",
    aliases: ["black hole", "black holes", "event horizon"],
    summary: "A black hole is a place where gravity is so strong that nothing nearby can escape once it passes the point of no return, called the event horizon. It is not a cosmic vacuum cleaner; far away it pulls like any other mass.",
    numbers: [
      ["Point of no return for a Sun-mass black hole", "about 3 kilometres across in radius"],
      ["Black hole at the centre of the Milky Way", "about 4 million times the mass of the Sun"],
    ],
    why: "Black holes test gravity at its most extreme and help explain how galaxies grow.",
    source: "NASA Astrophysics — black holes, and ESO Galactic Centre team",
  },
  {
    key: "stars",
    title: "Stars",
    aliases: ["star", "stars", "what is a star", "stellar"],
    summary: "A star is a huge ball of hot gas that makes its own light by joining small atomic nuclei into bigger ones in its core. The Sun is an ordinary star.",
    numbers: [
      ["Nearest star to the Sun, Proxima Centauri", "about 4.24 light-years away"],
      ["Share of the Solar System's mass held by the Sun", "about 99.8 percent"],
    ],
    why: "Stars make the light we see and build the heavier elements that planets and people are made of.",
    source: "NASA Star facts and NASA Sun facts",
  },
  {
    key: "planets",
    title: "Planets",
    aliases: ["planet", "planets", "what is a planet"],
    summary: "A planet is a large round world that orbits a star and has cleared its path of other large objects. The Solar System has eight planets.",
    numbers: [
      ["Number of planets in our Solar System", "eight"],
      ["Largest planet", "Jupiter"],
    ],
    why: "Comparing planets tells us what makes a world rocky, icy, gas-filled, or able to hold liquid water.",
    source: "NASA Solar System exploration",
  },
  {
    key: "moons",
    title: "Moons",
    aliases: ["moon", "moons", "natural satellite", "satellites"],
    summary: "A moon is a natural object that goes around a planet. Earth has one; Jupiter and Saturn have many more.",
    numbers: [
      ["Earth's natural moons", "one"],
      ["Distance to Earth's Moon", "about 384,400 kilometres"],
    ],
    why: "Moons raise tides, steady a planet's tilt, and are places we can explore close to home.",
    source: "NASA Moon facts and NASA Solar System exploration",
  },
  {
    key: "sun",
    title: "The Sun",
    aliases: ["sun", "the sun", "solar"],
    summary: "The Sun is the star at the centre of the Solar System. Its light and heat reach us in about eight minutes.",
    numbers: [
      ["Surface temperature", "about 5,500 degrees Celsius"],
      ["Core temperature", "about 15 million degrees Celsius"],
      ["Age", "about 4.6 billion years"],
    ],
    why: "It powers almost every living system on Earth and drives the weather in the Solar System.",
    source: "NASA Sun facts",
  },
  {
    key: "light-year",
    title: "Light and light-years",
    aliases: ["light", "light-year", "light year", "light years", "speed of light"],
    summary: "A light-year is a distance, not a time: it is how far light travels in one year. Light moves so fast that it takes only a few minutes to cross the inner Solar System.",
    numbers: [
      ["Speed of light in empty space", "about 300,000 kilometres per second"],
      ["One light-year", "about 9.46 trillion kilometres"],
      ["Sunlight reaching Earth", "about 8 minutes 20 seconds"],
    ],
    why: "Space is so large that light-years are the usual way to say how far away stars and galaxies are.",
    source: "NASA and the International Bureau of Weights and Measures",
  },
  {
    key: "relativity",
    title: "Relativity",
    aliases: ["relativity", "special relativity", "general relativity", "spacetime"],
    summary: "Special relativity says the speed of light is the same for every observer and that energy and mass are two forms of the same thing. General relativity says gravity is the curving of space and time by mass.",
    numbers: [
      ["Speed of light in empty space", "about 300,000 kilometres per second"],
      ["Famous link between mass and energy", "E = m c squared"],
    ],
    why: "It explains why fast clocks tick differently and why satellite navigation has to correct for time.",
    source: "NASA and NIST (National Institute of Standards and Technology)",
  },
  {
    key: "quantum",
    title: "Quantum physics",
    aliases: ["quantum", "quantum physics", "quantum mechanics", "quanta", "atom", "atoms"],
    summary: "Quantum physics says that at very small scales energy comes in packets called quanta, and particles do not have perfectly certain positions and speeds at the same time.",
    numbers: [
      ["Planck constant", "about 6.626 times ten to the minus 34 joule seconds"],
    ],
    why: "It explains atoms, lasers, computer chips, and why stars shine the way they do.",
    source: "NIST (National Institute of Standards and Technology) and NASA",
  },
  {
    key: "big-bang",
    title: "The Big Bang",
    aliases: ["big bang", "the big bang", "big bang theory", "universe age"],
    summary: "The Big Bang is the early hot, dense state the universe expanded from. It was not an explosion into empty space; space itself has been stretching ever since.",
    numbers: [
      ["Age of the universe", "about 13.8 billion years"],
    ],
    why: "It gives a shared history for galaxies, stars, and the leftover glow we can still measure today.",
    source: "NASA Cosmology — the Big Bang",
  },
  {
    key: "galaxies",
    title: "Galaxies",
    aliases: ["galaxy", "galaxies", "milky way", "andromeda"],
    summary: "A galaxy is a huge family of stars, gas, and dust held together by gravity. Our home galaxy is the Milky Way.",
    numbers: [
      ["Stars in the Milky Way", "roughly 100 billion"],
      ["Distance to the Andromeda Galaxy", "about 2.5 million light-years"],
    ],
    why: "Galaxies are the large-scale homes of stars and show how the universe has changed over time.",
    source: "NASA Galaxy facts and Hubble/Webb mission notes",
  },
  {
    key: "nebulae",
    title: "Nebulae",
    aliases: ["nebula", "nebulae", "star nursery"],
    summary: "A nebula is a cloud of gas and dust in space. Some nebulae are nurseries where new stars form; others are the remains of stars that died.",
    numbers: [
      ["Distance to the Orion Nebula", "about 1,344 light-years"],
    ],
    why: "They are where the raw material of new stars and planets is gathered and recycled.",
    source: "NASA Orion Nebula and Webb Space Telescope notes",
  },
  {
    key: "asteroids",
    title: "Asteroids",
    aliases: ["asteroid", "asteroids", "near earth asteroid", "near-earth asteroid"],
    summary: "An asteroid is a rocky leftover from the early Solar System. Most orbit the Sun in the belt between Mars and Jupiter, but some pass near Earth.",
    numbers: [
      ["Width of Ceres, the largest asteroid", "about 940 kilometres"],
    ],
    why: "They are time capsules from planet formation, and tracking the near ones is part of protecting Earth.",
    source: "NASA Solar System exploration — asteroids and Ceres",
  },
  {
    key: "comets",
    title: "Comets",
    aliases: ["comet", "comets", "halley's comet"],
    summary: "A comet is a small icy body that grows a glowing tail when it gets close to the Sun and its ice turns to gas.",
    numbers: [
      ["Return time of Halley's Comet", "about 76 years"],
    ],
    why: "Comets carry ancient ice and dust and help us understand how water and organic material moved in the early Solar System.",
    source: "NASA Solar System exploration — comets",
  },
  {
    key: "iss",
    title: "International Space Station",
    aliases: ["iss", "international space station", "space station"],
    summary: "The International Space Station is a crewed laboratory that falls around Earth again and again, so everything inside it is in near-continuous free fall.",
    numbers: [
      ["Height above Earth", "about 400 kilometres"],
      ["Time for one orbit", "about 90 minutes"],
    ],
    why: "It lets people live and work in microgravity, testing medicine, materials, and long-spaceflight skills.",
    source: "NASA International Space Station facts",
  },
  {
    key: "rockets",
    title: "Rockets",
    aliases: ["rocket", "rockets", "launch", "escape velocity"],
    summary: "A rocket pushes itself forward by throwing gas backwards very fast. It does not need air to push against, which is why it works in space.",
    numbers: [
      ["Speed needed to leave Earth without more thrust", "about 11.2 kilometres per second"],
    ],
    why: "Rockets are the only practical way we have to lift people and instruments off a planet.",
    source: "NASA Rocket and launch basics",
  },
  {
    key: "solar-system",
    title: "The Solar System",
    aliases: ["solar system", "the solar system", "our solar system"],
    summary: "The Solar System is the Sun and everything bound to it: eight planets, their moons, smaller rocky bodies, comets, and dust.",
    numbers: [
      ["Age", "about 4.6 billion years"],
      ["Planets", "eight"],
    ],
    why: "It is the nearest place we can explore in detail and a test case for how planetary systems form.",
    source: "NASA Solar System exploration",
  },
  {
    key: "mars",
    title: "Mars",
    aliases: ["mars", "the red planet", "red planet"],
    summary: "Mars is a cold rocky planet with a thin atmosphere and iron-rich dust that makes it look red. Robots have found signs of ancient water.",
    numbers: [
      ["Length of a Martian day", "about 24.6 hours"],
      ["Length of a Martian year", "about 687 Earth days"],
      ["Moons", "two"],
    ],
    why: "It is the most Earth-like neighbour we can study, and a goal for human exploration.",
    source: "NASA Mars exploration facts",
  },
  {
    key: "jupiter",
    title: "Jupiter",
    aliases: ["jupiter", "great red spot"],
    summary: "Jupiter is the largest planet, a gas giant made mostly of hydrogen and helium. Its Great Red Spot is a storm that has lasted for centuries.",
    numbers: [
      ["Length of a Jovian day", "about 9.9 hours"],
    ],
    why: "Jupiter's gravity shapes the asteroid belt and shields inner planets from some comet impacts.",
    source: "NASA Jupiter facts",
  },
  {
    key: "saturn",
    title: "Saturn",
    aliases: ["saturn", "saturn's rings", "rings of saturn"],
    summary: "Saturn is a gas giant famous for its bright rings, which are made of countless pieces of ice and rock.",
    numbers: [
      ["Average density", "less than liquid water"],
    ],
    why: "Its rings are a nearby example of how gravity sorts debris into structures.",
    source: "NASA Saturn facts",
  },
  {
    key: "earth",
    title: "Earth",
    aliases: ["earth", "our planet", "home planet"],
    summary: "Earth is the only place we know of with liquid surface water and life. Its atmosphere and magnetic field help protect that life.",
    numbers: [
      ["Surface covered by water", "about 71 percent"],
      ["Distance from the Sun", "about 150 million kilometres"],
    ],
    why: "It is the reference point for everything else we learn about planets and habitability.",
    source: "NASA Earth facts and USGS water data",
  },
  {
    key: "the-moon",
    title: "The Moon",
    aliases: ["the moon", "lunar", "moonlight"],
    summary: "The Moon is Earth's natural satellite. It reflects sunlight, and its pull is the main cause of ocean tides.",
    numbers: [
      ["Distance from Earth", "about 384,400 kilometres"],
      ["Time to go around Earth", "about 27.3 days"],
    ],
    why: "The Moon steadies Earth's tilt and gives us a nearby world to explore.",
    source: "NASA Moon facts",
  },
];

// The physics topics are the same knowledge objects, just grouped for the
// plain-text matcher. No second table or second source of truth.
export const PHYSICS_KEYS = new Set(["gravity", "orbits", "light-year", "relativity", "quantum"]);

function normalize(text) {
  return String(text ?? "").toLowerCase().replace(/[?!.,]+$/g, "").replace(/\s+/g, " ").trim();
}

function findTopic(text) {
  const q = normalize(text);
  if (!q) return null;
  const direct = SPACE_TOPICS.find(t => t.key === q || t.title.toLowerCase() === q);
  if (direct) return direct;
  const alias = SPACE_TOPICS.find(t => t.aliases.some(a => normalize(a) === q));
  if (alias) return alias;
  // A longer phrase still containing a clear topic name is a safe local hit.
  return SPACE_TOPICS.find(t => t.aliases.some(a => {
    const n = normalize(a);
    return n.length > 3 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q);
  })) || null;
}

function formatLocal(topic) {
  const lines = [
    `${topic.title} — plain-words answer`,
    `In plain words: ${topic.summary}`,
    "Key numbers:",
    ...topic.numbers.map(([label, value]) => `  - ${label}: ${value}`),
    `Why it matters: ${topic.why}`,
    `Source: ${topic.source}`,
    `Numbers I don't keep: ${NO_NUMBER}`,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Cache + small JSON fetch helpers. No npm packages, no image downloads.
// ---------------------------------------------------------------------------

let cache = null;

function getCache() {
  if (!cache) cache = readJson(pathForCache(), {});
  return cache;
}

function pathForCache() {
  return `${dataLocation()}/space-cache.json`;
}

function remember(bucket, key, value) {
  const c = getCache();
  if (!c[bucket]) c[bucket] = {};
  c[bucket][key] = { ...value, at: new Date().toISOString() };
  writeJson(pathForCache(), c);
}

function cached(bucket, key) {
  return getCache()[bucket]?.[key] || null;
}

function offlineMode() {
  return process.env.RUNEFOLD_OFFLINE === "1";
}

async function fetchJson(url) {
  if (offlineMode()) throw new Error("offline mode");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Runefold/0.6 plain-words space answers" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function nasaKey() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const candidate = cfg.NASA_API_KEY || cfg.nasaApiKey;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  } catch { /* config is never created or changed here */ }
  return "DEMO_KEY";
}

function dateUTC() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUTC(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function wikipediaNote(topic) {
  const key = normalize(topic);
  if (!key) return WIKI_OFFLINE;
  const hit = cached("wikipedia", key);
  if (hit) {
    return `Wikipedia (cached from earlier in the store): ${hit.extract}\nWikipedia page: ${hit.url}`;
  }
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
    const data = await fetchJson(url);
    const extract = String(data.extract || "").replace(/\s+/g, " ").trim();
    if (!extract) throw new Error("empty Wikipedia summary");
    const page = data.content_urls?.desktop?.page || url;
    remember("wikipedia", key, { title: data.title || topic, extract, url: page });
    return `Wikipedia live: ${extract}\nWikipedia page: ${page}`;
  } catch {
    return WIKI_OFFLINE;
  }
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

async function explain(topic, category) {
  const gate = checkKindness(`Explain ${topic} (${category})`);
  if (!gate.ok) return gate.reason;
  const found = findTopic(topic);
  const local = found
    ? formatLocal(found)
    : `I don't know that topic from my local ${category} base. I don't know that number. ${NO_NUMBER}`;
  // Ask Wikipedia for the NAME of the topic, not the whole question.
  const wikiTopic = found
    ? found.title
    : String(topic).replace(/^(tell me about|what is|what are)\s+/i, "").replace(/[?.,]+$/, "").trim();
  const wiki = await wikipediaNote(wikiTopic);
  return `${local}\n\n${wiki}`;
}

export async function getSpaceTopic(topic) {
  return explain(topic, "space");
}

export async function getPhysicsTopic(topic) {
  return explain(topic, "physics");
}

export async function getApod() {
  const gate = checkKindness("Show today's astronomy picture");
  if (!gate.ok) return gate.reason;
  const today = dateUTC();
  const key = `apod:${today}`;
  const hit = cached("nasa", key);
  if (hit) {
    return [
      "Today's space picture — NASA APOD",
      `Title: ${hit.title}`,
      `Date: ${hit.date}`,
      `Image URL: ${hit.url}`,
      hit.mediaType === "video" ? "NASA lists this one as a video, not a still image." : "",
      "I only print the URL — I did not download the image.",
      `Source: NASA APOD (${hit.keySource}).`,
    ].filter(Boolean).join("\n");
  }
  try {
    const url = `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(nasaKey())}`;
    const data = await fetchJson(url);
    if (!data.title || !data.url) throw new Error("NASA APOD did not return a title and URL");
    const result = {
      title: String(data.title),
      date: String(data.date || today),
      url: String(data.url),
      mediaType: String(data.media_type || "image"),
      keySource: nasaKey() === "DEMO_KEY" ? "DEMO_KEY" : "your own NASA_API_KEY from config.json",
    };
    remember("nasa", key, result);
    return [
      "Today's space picture — NASA APOD",
      `Title: ${result.title}`,
      `Date: ${result.date}`,
      `Image URL: ${result.url}`,
      result.mediaType === "video" ? "NASA lists this one as a video, not a still image." : "",
      "I only print the URL — I did not download the image.",
      `Source: NASA APOD (${result.keySource}).`,
    ].filter(Boolean).join("\n");
  } catch {
    return `${NASA_OFFLINE}\nSource: NASA APOD uses DEMO_KEY by default; Scarlet adds her own NASA_API_KEY to config.json herself. Nothing was downloaded.`;
  }
}

export async function getAsteroids() {
  const gate = checkKindness("List near-Earth asteroids for the next seven days");
  if (!gate.ok) return gate.reason;
  const start = dateUTC();
  const end = addDaysUTC(start, 6);
  const key = `asteroids:${start}`;
  const hit = cached("nasa", key);
  if (hit) return formatAsteroids(hit.rows, start, end, true);
  try {
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${encodeURIComponent(nasaKey())}`;
    const data = await fetchJson(url);
    const days = data.near_earth_objects || {};
    const rows = [];
    for (const [date, objects] of Object.entries(days)) {
      for (const obj of objects || []) {
        const meters = obj.estimated_diameter?.meters || {};
        const min = Math.round(Number(meters.estimated_diameter_min || 0));
        const max = Math.round(Number(meters.estimated_diameter_max || 0));
        const approach = obj.close_approach_data?.[0] || {};
        const km = Number(approach.miss_distance?.kilometers || 0);
        const distance = km > 0 ? `about ${Math.round(km).toLocaleString("en-US")} kilometres` : "a distance NASA did not give";
        rows.push(`${date}: ${obj.name || "unnamed asteroid"} — about ${min}–${max} metres wide, passes ${distance} from Earth.`);
      }
    }
    remember("nasa", key, { rows });
    return formatAsteroids(rows, start, end, false);
  } catch {
    return `${NASA_OFFLINE}\nSource: NASA NeoWs uses DEMO_KEY by default; Scarlet adds her own NASA_API_KEY to config.json herself.`;
  }
}

function formatAsteroids(rows, start, end, wasCached) {
  const head = [
    `Near-Earth asteroids — NASA NeoWs, ${start} to ${end}${wasCached ? " (cached from earlier in the store)" : ""}`,
  ];
  if (!rows.length) return `${head[0]}\nNASA lists no near-Earth approaches in that seven-day window.`;
  const shown = rows.slice(0, 10);
  const extra = rows.length > shown.length ? `\n...and ${rows.length - shown.length} more. I kept the list short.` : "";
  return `${head[0]}\n${shown.join("\n")}${extra}\nSource: NASA Near Earth Object Web Service (NeoWs). No image or file was downloaded.`;
}

export function searchSpace(keyword) {
  const gate = checkKindness(`Search space knowledge for ${keyword}`);
  if (!gate.ok) return [];
  const q = normalize(keyword);
  if (!q) return [];
  return SPACE_TOPICS.filter(t =>
    [t.title, t.key, ...t.aliases, t.summary, t.why, t.source, ...t.numbers.flat()]
      .some(field => normalize(field).includes(q))
  );
}
