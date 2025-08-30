export function createProgressTimer() {
  let startTime: number | null = null;
  let duration = 0;
  let rafId: number | null = null;
  let playhead: HTMLDivElement | null = null;

  function registerPlayhead(el: HTMLDivElement) {
    console.log("Playhead registered:", el);
    playhead = el;
  }

  async function startTimeline(totalDurationMs: number) {
    await stopTimeline(); // reset if already running
    startTime = performance.now();
    duration = totalDurationMs;

    if (playhead) {
      //playhead.style.display = "block";
      playhead.style.transform = "translateX(0px)";
    }

    loop();
  }

  async function stopTimeline() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    startTime = null;
    if (playhead) {
      //playhead.style.display = "none";
      //playhead.style.transform = "translateX(0px)";
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
      await stopTimeline();
    }
  }

  return { registerPlayhead, startTimeline, stopTimeline };
}
