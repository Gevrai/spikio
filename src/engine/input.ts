import type { AimState, Vec2 } from '../game/types.ts';
import { vec2Len, vec2Norm, vec2Sub } from '../game/types.ts';

export interface TouchRing {
  x: number;
  y: number;
  age: number;
}

const MAX_DRAG = 150;
const MAX_POWER = 1;

export class InputManager {
  private canvas: HTMLCanvasElement;
  private dragging = false;
  private dragStart: Vec2 = { x: 0, y: 0 };
  private dragCurrent: Vec2 = { x: 0, y: 0 };
  private _aimState: AimState = { aiming: false, direction: { x: 0, y: 0 }, power: 0 };
  private launched = false;
  private launchDir: Vec2 = { x: 0, y: 0 };
  private launchPower = 0;
  private boundHandlers: { type: string; handler: EventListener; options?: AddEventListenerOptions }[] = [];
  touchRings: TouchRing[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  private addListener(type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    this.canvas.addEventListener(type, handler, options);
    this.boundHandlers.push({ type, handler, options });
  }

  private bindEvents(): void {
    this.addListener('mousedown', ((e: MouseEvent) => this.onStart(e.clientX, e.clientY)) as EventListener);
    this.addListener('mousemove', ((e: MouseEvent) => this.onMove(e.clientX, e.clientY)) as EventListener);
    this.addListener('mouseup', (() => this.onEnd()) as EventListener);

    this.addListener('touchstart', ((e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      this.onStart(t.clientX, t.clientY);
    }) as EventListener, { passive: false });

    this.addListener('touchmove', ((e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      this.onMove(t.clientX, t.clientY);
    }) as EventListener, { passive: false });

    this.addListener('touchend', ((e: TouchEvent) => {
      e.preventDefault();
      this.onEnd();
    }) as EventListener, { passive: false });
  }

  destroy(): void {
    for (const { type, handler, options } of this.boundHandlers) {
      this.canvas.removeEventListener(type, handler, options);
    }
    this.boundHandlers = [];
  }

  private onStart(sx: number, sy: number): void {
    this.dragging = true;
    this.launched = false;
    this.dragStart = { x: sx, y: sy };
    this.dragCurrent = { x: sx, y: sy };
    this.touchRings.push({ x: sx, y: sy, age: 0 });
  }

  private onMove(sx: number, sy: number): void {
    if (!this.dragging) return;
    this.dragCurrent = { x: sx, y: sy };
    this.updateAim();
  }

  private onEnd(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this._aimState.power > 0.05) {
      this.launched = true;
      this.launchDir = { ...this._aimState.direction };
      this.launchPower = this._aimState.power;
    }
    this._aimState = { aiming: false, direction: { x: 0, y: 0 }, power: 0 };
  }

  private updateAim(): void {
    // Drag vector in screen space (from start to current)
    const dragVec = vec2Sub(this.dragCurrent, this.dragStart);
    const dragLen = vec2Len(dragVec);

    if (dragLen < 5) {
      this._aimState = { aiming: false, direction: { x: 0, y: 0 }, power: 0 };
      return;
    }

    // Direction opposite to drag
    const norm = vec2Norm(dragVec);
    const direction: Vec2 = { x: -norm.x, y: -norm.y };
    const power = Math.min(dragLen / MAX_DRAG, MAX_POWER);

    this._aimState = { aiming: true, direction, power };
  }

  get aimState(): AimState {
    return this._aimState;
  }

  get dragStartScreen(): Vec2 {
    return this.dragStart;
  }

  get dragCurrentScreen(): Vec2 {
    return this.dragCurrent;
  }

  updateTouchRings(dt: number): void {
    for (let i = this.touchRings.length - 1; i >= 0; i--) {
      this.touchRings[i].age += dt;
      if (this.touchRings[i].age > 0.4) this.touchRings.splice(i, 1);
    }
  }

  consumeLaunch(): { direction: Vec2; power: number } | null {
    if (!this.launched) return null;
    this.launched = false;
    return { direction: this.launchDir, power: this.launchPower };
  }
}
