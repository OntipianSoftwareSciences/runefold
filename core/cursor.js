// Runefold's own animated cursor — cute, flowy, liquid glass.
// Terminal version: a soft pink/blue blob that breathes and
// ripples while the model is thinking, instead of a static
// "thinking..." line. No dependencies, just ANSI + time.
const FRAMES = [
  "🫧  ~  💧",
  " 💧 ~ 🫧 ",
  "  ~ 🫧 💧",
  " 🫧 💧 ~ ",
];
const COLORS = ["\x1b[95m", "\x1b[96m", "\x1b[94m", "\x1b[95m"];
let timer = null;
let frame = 0;
export function startLiquidCursor(label = "runefold is thinking") {
  if (timer) return;
  frame = 0;
  timer = setInterval(() => {
    const c = COLORS[frame % COLORS.length];
    const f = FRAMES[frame % FRAMES.length];
    process.stdout.write(`\r${c}${f}  ${label}…\x1b[0m   `);
    frame++;
  }, 180);
}
export function stopLiquidCursor() {
  if (!timer) return;
  clearInterval(timer); timer = null;
  process.stdout.write("\r\x1b[K");
}
export function liquidPrompt() {
  // The prompt itself: a little glass droplet that sits
  // before the ❯, so the cursor feels alive even at rest.
  return "\x1b[96m🫧\x1b[95m runefold\x1b[96m ❯ \x1b[0m";
}
