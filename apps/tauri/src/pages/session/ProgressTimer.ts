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
  private rafId: number | null = null;
  private playhead: HTMLDivElement | null = null;
  private progressCallback: ProgressCallback | null = null;
  private lastSecond = -1;

  registerPlayhead(element: HTMLDivElement | null) {
    this.playhead = element;
  }
  registerProgressCallback(callback: ProgressCallback) {
    this.progressCallback = callback;
  }

  startTimeline(singleLoopDurationMs: number, loops = 1) {
    this.stopTimeline();
    this.singleLoopDuration = Math.max(singleLoopDurationMs, 0);
    this.totalLoops = Math.max(loops, 0);
    this.lastSecond = -1;
    // Publish a clean readout first: a zero-length activity never ticks, and would otherwise
    // leave whatever the previous run last reported on screen.
    this.progressCallback?.({
      currentLoop: 1,
      totalLoops: this.totalLoops,
      currentSeconds: 0,
      totalSeconds: (this.singleLoopDuration * this.totalLoops) / 1000,
    });
    if (this.singleLoopDuration <= 0 || this.totalLoops <= 0) return;
    this.startTime = performance.now();
    this.loop();
  }
  stopTimeline() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.startTime = null;
  }
  dispose() {
    this.stopTimeline();
    this.playhead = null;
    this.progressCallback = null;
  }

  private loop() {
    if (this.startTime === null) return;
    const total = this.singleLoopDuration * this.totalLoops;
    const elapsed = Math.min(performance.now() - this.startTime, total);
    const loop = Math.min(Math.floor(elapsed / this.singleLoopDuration), this.totalLoops - 1);
    const progress = Math.min((elapsed - loop * this.singleLoopDuration) / this.singleLoopDuration, 1);
    if (this.playhead?.parentElement) {
      this.playhead.style.transform = `translateX(${this.playhead.parentElement.clientWidth * progress}px)`;
    }
    const second = Math.floor(elapsed / 1000);
    if (second !== this.lastSecond) {
      this.lastSecond = second;
      this.progressCallback?.({
        currentLoop: loop + 1,
        totalLoops: this.totalLoops,
        currentSeconds: second,
        totalSeconds: total / 1000,
      });
    }
    if (elapsed >= total) this.stopTimeline();
    else this.rafId = requestAnimationFrame(() => this.loop());
  }
}
