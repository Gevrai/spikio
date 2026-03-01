import type { Vec2 } from '../game/types.ts';

export class Camera {
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;
  screenW = 0;
  screenH = 0;
  private smoothing = 0.1;
  private shakeIntensity = 0;
  private shakeX = 0;
  private shakeY = 0;

  follow(pos: Vec2): void {
    this.targetX = pos.x;
    this.targetY = pos.y;
  }

  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  update(_dt: number): void {
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;

    if (this.shakeIntensity > 0.5) {
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity *= 0.88;
    } else {
      this.shakeIntensity = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    return {
      x: wx - this.x + this.screenW / 2 + this.shakeX,
      y: wy - this.y + this.screenH / 2 + this.shakeY,
    };
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return {
      x: sx + this.x - this.screenW / 2,
      y: sy + this.y - this.screenH / 2,
    };
  }
}

export class CanvasManager {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  logicalW = 0;
  logicalH = 0;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = new Camera();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.logicalW = window.innerWidth;
    this.logicalH = window.innerHeight;
    this.canvas.width = this.logicalW * this.dpr;
    this.canvas.height = this.logicalH * this.dpr;
    this.canvas.style.width = `${this.logicalW}px`;
    this.canvas.style.height = `${this.logicalH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.camera.screenW = this.logicalW;
    this.camera.screenH = this.logicalH;
  }
}
