type ProgressCallback = (data: {
  currentLoop: number;
  totalLoops: number;
  currentSeconds: number;
  totalSeconds: number;
}) => void;

export class ProgressTimer {
  private startTime: number | null = null;
  private singleLoopDuration = 0;
  private totalLoops = 1;
  private currentLoop = 0;
  private rafId: number | null = null;
  private playhead: HTMLDivElement | null = null;
  private progressCallback: ProgressCallback | null = null;

  registerPlayhead(el: HTMLDivElement) {
    this.playhead = el;
    // If we have an ongoing session but no animation loop, restart it
    if (this.startTime !== null && this.rafId === null) {
      this.playhead.classList.remove("hidden");
      this.loop(); // Restart the animation loop
    }
  }

  registerProgressCallback(callback: ProgressCallback) {
    this.progressCallback = callback;
  }

  async startTimeline(singleLoopDurationMs: number, loops: number = 1) {
    await this.stopTimeline(); // reset if already running
    this.startTime = performance.now();
    this.singleLoopDuration = singleLoopDurationMs;
    this.totalLoops = loops;
    this.currentLoop = 0;

    if (this.playhead) {
      this.playhead.style.transform = "translateX(0px)";
      this.playhead.classList.remove("hidden");
    }

    this.loop();
  }

  async stopTimeline() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.startTime = null;
    this.currentLoop = 0;
    if (this.playhead) {
      this.playhead.classList.add("hidden");
    }
  }

  private async loop() {
    if (!this.playhead || this.startTime === null || this.playhead.clientWidth === 0) {
      this.rafId = null;
      return;
    }

    const elapsed = performance.now() - this.startTime;

    if (elapsed >= this.singleLoopDuration * this.totalLoops) {
      await this.stopTimeline();
      return;
    }

    // Calculate which loop we should be in based on elapsed time
    const expectedLoop = Math.floor(elapsed / this.singleLoopDuration);

    // Check if we've moved to a new loop
    if (expectedLoop > this.currentLoop && expectedLoop < this.totalLoops) {
      this.currentLoop = expectedLoop;
      this.playhead.style.transform = "translateX(0px)";
      // Small delay to show the reset visually
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Calculate progress within current loop
    const elapsedInCurrentLoop = elapsed - this.currentLoop * this.singleLoopDuration;
    const progressInLoop = Math.min(elapsedInCurrentLoop / this.singleLoopDuration, 1);

    // Update playhead position based on progress in current loop
    const container = this.playhead.parentElement!;
    const width = container.clientWidth;
    const x = width * progressInLoop;
    this.playhead.style.transform = `translateX(${x}px)`;

    // Call progress callback if registered
    if (this.progressCallback) {
      this.progressCallback({
        currentLoop: this.currentLoop + 1, // Display as 1-indexed
        totalLoops: this.totalLoops,
        currentSeconds: Math.floor(elapsed / 1000),
        totalSeconds: Math.floor((this.singleLoopDuration * this.totalLoops) / 1000),
      });
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
