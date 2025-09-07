type ProgressCallback = (data: {
  currentLoop: number;
  totalLoops: number;
  currentSeconds: number;
  totalSeconds: number;
}) => void;

export function createProgressTimer() {
  let startTime: number | null = null;
  let singleLoopDuration = 0;
  let totalLoops = 1;
  let currentLoop = 0;
  let rafId: number | null = null;
  let playhead: HTMLDivElement | null = null;
  let progressCallback: ProgressCallback | null = null;

  function registerPlayhead(el: HTMLDivElement) {
    playhead = el;
  }

  function registerProgressCallback(callback: ProgressCallback) {
    progressCallback = callback;
  }

  async function startTimeline(singleLoopDurationMs: number, loops: number = 1) {
    await stopTimeline(); // reset if already running
    startTime = performance.now();
    singleLoopDuration = singleLoopDurationMs;
    totalLoops = loops;
    currentLoop = 0;

    if (playhead) {
      playhead.style.transform = "translateX(0px)";
    }

    loop();
  }

  async function stopTimeline() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    startTime = null;
    currentLoop = 0;
    if (playhead) {
      // Keep the playhead visible but reset position if needed
      // playhead.style.transform = "translateX(0px)";
    }
  }

  async function loop() {
    if (!playhead || startTime === null) return;

    const elapsed = performance.now() - startTime;

    // Calculate which loop we should be in based on elapsed time
    const expectedLoop = Math.floor(elapsed / singleLoopDuration);

    // Check if we've moved to a new loop
    if (expectedLoop > currentLoop && expectedLoop < totalLoops) {
      currentLoop = expectedLoop;
      playhead.style.transform = "translateX(0px)";
      // Small delay to show the reset visually
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Calculate progress within current loop
    const elapsedInCurrentLoop = elapsed - currentLoop * singleLoopDuration;
    const progressInLoop = Math.min(elapsedInCurrentLoop / singleLoopDuration, 1);

    // Update playhead position based on progress in current loop
    const container = playhead.parentElement!;
    const width = container.clientWidth;
    const x = width * progressInLoop;
    playhead.style.transform = `translateX(${x}px)`;

    // Call progress callback if registered
    if (progressCallback) {
      progressCallback({
        currentLoop: currentLoop + 1, // Display as 1-indexed
        totalLoops,
        currentSeconds: Math.floor(elapsed / 1000),
        totalSeconds: Math.floor((singleLoopDuration * totalLoops) / 1000),
      });
    }

    // Check if we've completed all loops
    if (elapsed >= singleLoopDuration * totalLoops) {
      await stopTimeline();
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  return { registerPlayhead, registerProgressCallback, startTimeline, stopTimeline };
}
