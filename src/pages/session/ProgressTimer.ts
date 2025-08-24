import { sessionChannelManager } from "@/services/BalanceBoardChannelManager.tsx";

let startTime: number | null = null;
let duration = 0;
let rafId: number | null = null;
let playhead: HTMLDivElement | null = null;

export function registerPlayhead(el: HTMLDivElement) {
  playhead = el;
}

export async function startTimeline(totalDurationMs: number) {
  await stopTimeline(); // reset if already running
  startTime = performance.now();
  duration = totalDurationMs;
  loop();
}

export async function stopTimeline() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  startTime = null;
  if (playhead) {
    playhead.style.transform = "translateX(0px)"; // reset to start
  }
}

async function loop() {
  if (!playhead || startTime === null) return;

  const elapsed = performance.now() - startTime;
  const progress = Math.min(elapsed / duration, 1);

  const container = playhead.parentElement!;
  const width = container.clientWidth;
  const x = width * progress;

  playhead.style.transform = `translateX(${x}px)`;

  if (progress < 1) {
    rafId = requestAnimationFrame(loop);
  } else {
    await sessionChannelManager.stop();
    await stopTimeline(); // reset when finished
  }
}
