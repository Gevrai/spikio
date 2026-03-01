const TICK_RATE = 60;
const DT = 1 / TICK_RATE;
const MAX_FRAME_TIME = 0.25;

export class GameLoop {
  private updateFn: (dt: number) => void;
  private renderFn: (ctx: CanvasRenderingContext2D, alpha: number) => void;
  private ctx: CanvasRenderingContext2D;
  private running = false;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;

  constructor(
    ctx: CanvasRenderingContext2D,
    updateFn: (dt: number) => void,
    renderFn: (ctx: CanvasRenderingContext2D, alpha: number) => void,
  ) {
    this.ctx = ctx;
    this.updateFn = updateFn;
    this.renderFn = renderFn;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = (_timestamp: number): void => {
    if (!this.running) return;

    const now = performance.now() / 1000;
    let frameTime = now - this.lastTime;
    this.lastTime = now;
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    this.accumulator += frameTime;
    while (this.accumulator >= DT) {
      this.updateFn(DT);
      this.accumulator -= DT;
    }

    const alpha = this.accumulator / DT;
    this.renderFn(this.ctx, alpha);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
