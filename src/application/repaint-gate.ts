import type { Vec2 } from '../domain/geometry';

export interface RepaintInputs {
  /** The round state; it is a new object on every simulation step and every throw. */
  readonly state: object | undefined;
  /** True while effects (particles, score pops, shake) are moving and need frames of their own. */
  readonly animating: boolean;
  /** Where the reticle is drawn, or `undefined` when it is hidden. */
  readonly aim: Vec2 | undefined;
  /** Anything else that changes the picture when it changes (screen, level, biome). */
  readonly view: string;
}

/** An effect looks fine at 60 frames per second: asking for more would only burn battery. */
export const MIN_ANIMATION_INTERVAL_MS = 15;

const sameAim = (a: Vec2 | undefined, b: Vec2 | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.x === b.x && a.y === b.y);

/**
 * Decides, once per display frame, whether the picture has to be redrawn. The simulation runs at
 * 60 Hz and nothing is interpolated, so redrawing every display frame repeats identical pictures:
 * twice as many on a 120 Hz phone, and all of them on the menu or the pause screen. It repaints
 * when something visible changed, and keeps a steady pace while effects are animating.
 */
export class RepaintGate {
  private first = true;
  private lastState: object | undefined;
  private lastAim: Vec2 | undefined;
  private lastView = '';
  private elapsedMs = 0;

  /**
   * Feed it every frame. Returns the time (ms) that has passed since the last repaint when the
   * picture must be redrawn now, or `undefined` when the last one is still correct. The caller
   * uses that time to age its effects.
   */
  shouldRepaint(dtMs: number, inputs: RepaintInputs): number | undefined {
    this.elapsedMs += Math.max(0, dtMs);
    const changed =
      this.first ||
      inputs.state !== this.lastState ||
      inputs.view !== this.lastView ||
      !sameAim(inputs.aim, this.lastAim);
    const animationDue = inputs.animating && this.elapsedMs >= MIN_ANIMATION_INTERVAL_MS;
    if (!changed && !animationDue) return undefined;

    const elapsed = this.elapsedMs;
    this.first = false;
    this.lastState = inputs.state;
    this.lastAim = inputs.aim;
    this.lastView = inputs.view;
    this.elapsedMs = 0;
    return elapsed;
  }

  /** Forces the next frame to repaint (the tab came back, the canvas may have been dropped). */
  invalidate(): void {
    this.first = true;
  }
}
