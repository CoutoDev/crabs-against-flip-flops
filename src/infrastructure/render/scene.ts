import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from '../../domain/constants';
import type { Biome } from '../../domain/entities/level';
import type { Vec2 } from '../../domain/geometry';
import { lerp } from '../../domain/geometry';
import type { RoundState } from '../../domain/rules/round';
import { slipperPosition } from '../../domain/rules/trajectory';
import { renderBackground } from './background';
import type { Effects } from './effects';
import { drawText, textWidth } from './font';
import { Framebuffer } from './framebuffer';
import { COLOR } from './palette';
import { DEFAULT_SLIPPER_SLOTS, SPRITES } from './sprites';

const CRAB_FRAME_MS = 140;
const SLIPPER_SPIN_MS = 70;
const RETICLE_RADIUS = 7;

export interface SceneOptions {
  readonly state: RoundState;
  readonly effects: Effects;
  /** Where the next flip flop would land; undefined hides the reticle (e.g. while paused). */
  readonly aim: Vec2 | undefined;
  /** Palette indices of the equipped skin: [sole, strap]. */
  readonly slipperSlots?: readonly number[];
}

/** Draws one frame of the round. Pure with respect to its inputs: same options, same pixels. */
export class Scene {
  private readonly backgrounds = new Map<Biome, Framebuffer>();

  private background(biome: Biome): Framebuffer {
    let bg = this.backgrounds.get(biome);
    if (bg === undefined) {
      bg = renderBackground(biome);
      this.backgrounds.set(biome, bg);
    }
    return bg;
  }

  /** Just the scenery, for screens without a round (the main menu). */
  renderBackdrop(fb: Framebuffer, biome: Biome): void {
    fb.copyFrom(this.background(biome));
  }

  render(fb: Framebuffer, { state, effects, aim, slipperSlots }: SceneOptions): void {
    fb.copyFrom(this.background(state.config.level.biome));
    this.drawCrabs(fb, state);
    this.drawFlights(fb, state, slipperSlots ?? DEFAULT_SLIPPER_SLOTS);
    this.drawPuffs(fb, effects);
    if (aim !== undefined) this.drawReticle(fb, aim);
    this.drawFloaters(fb, effects);
  }

  private drawCrabs(fb: Framebuffer, state: RoundState): void {
    // Lower crabs are closer to the camera, so they are painted last.
    const ordered = [...state.crabs].sort((a, b) => a.y - b.y || a.id - b.id);
    for (const crab of ordered) {
      const frames = SPRITES.crabs[crab.type];
      const frame = frames[(Math.floor(state.timeMs / CRAB_FRAME_MS) + crab.id) % 2] ?? frames[0];
      const shadow = SPRITES.shadow;
      fb.blit(shadow, crab.x - shadow.width / 2, crab.y + frame.height / 2 - 2);
      fb.blit(frame, crab.x - frame.width / 2, crab.y - frame.height / 2, {
        flipX: crab.direction === -1,
      });
    }
  }

  private drawFlights(fb: Framebuffer, state: RoundState, slots: readonly number[]): void {
    for (const flight of state.flights) {
      const position = slipperPosition(flight);
      const progress =
        flight.durationMs <= 0 ? 1 : Math.min(1, flight.elapsedMs / flight.durationMs);
      // The shadow stays on the ground line while the flip flop is lifted by the arc.
      const groundX = lerp(flight.origin.x, flight.target.x, progress);
      const groundY = lerp(flight.origin.y, flight.target.y, progress);
      const shadow = SPRITES.shadow;
      fb.blit(shadow, groundX - shadow.width / 2, groundY - 1);

      const spin = Math.floor(flight.elapsedMs / SLIPPER_SPIN_MS) % SPRITES.slipper.length;
      const sprite = SPRITES.slipper[spin] ?? SPRITES.slipper[0];
      fb.blit(sprite, position.x - sprite.width / 2, position.y - sprite.height / 2, { slots });
    }
  }

  private drawPuffs(fb: Framebuffer, effects: Effects): void {
    for (const puff of effects.puffs) {
      const frames = SPRITES.puff;
      const index = Math.min(
        frames.length - 1,
        Math.floor((puff.ageMs / puff.ttlMs) * frames.length),
      );
      const frame = frames[index] ?? frames[0];
      if (frame !== undefined) fb.blit(frame, puff.x - frame.width / 2, puff.y - frame.height / 2);
    }
  }

  /** Four ticks around the landing point, at the same distance as the hit tolerance. */
  private drawReticle(fb: Framebuffer, aim: Vec2): void {
    const x = Math.round(aim.x);
    const y = Math.round(aim.y);
    const r = RETICLE_RADIUS;
    for (const [dx, dy, w, h] of [
      [-r - 2, 0, 3, 1],
      [r, 0, 3, 1],
      [0, -r - 2, 1, 3],
      [0, r, 1, 3],
    ] as const) {
      fb.fillRect(x + dx - 1, y + dy - 1, w + 2, h + 2, COLOR.ink); // outline keeps it visible on any ground
      fb.fillRect(x + dx, y + dy, w, h, COLOR.white);
    }
    fb.setPixel(x, y, COLOR.white);
  }

  private drawFloaters(fb: Framebuffer, effects: Effects): void {
    for (const floater of effects.floaters) {
      const rise = (floater.ageMs / floater.ttlMs) * 14;
      const x = Math.min(
        Math.max(1, floater.x - textWidth(floater.text) / 2),
        FIELD_WIDTH_PX - textWidth(floater.text) - 1,
      );
      const y = Math.min(Math.max(1, floater.y - rise), FIELD_HEIGHT_PX - 7);
      drawText(fb, floater.text, x, y, floater.color, COLOR.ink);
    }
  }
}
