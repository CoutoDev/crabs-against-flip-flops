import type { Vec2 } from '../domain/geometry';
import { AIM_FAST_STEP_PX, AIM_STEP_PX, DEFAULT_AIM, moveAim, type AimDirection } from './aim';
import type { GameFlow } from './game-flow';

/** What the player can ask for, regardless of the device (keyboard, mouse, touch). */
export type PlayerCommand =
  | {
      readonly kind: 'aim';
      readonly dx: AimDirection;
      readonly dy: AimDirection;
      readonly fast: boolean;
    }
  | { readonly kind: 'throw' }
  | { readonly kind: 'pause' };

/**
 * Turns player commands into actions on the current screen/round. Input adapters only decode
 * devices into commands; what a command means in each screen lives here, where it is testable.
 */
export class PlayerControls {
  private aimPoint: Vec2 = DEFAULT_AIM;

  constructor(private readonly flow: GameFlow) {}

  /** Where the next flip flop would land (also drives the on-screen reticle). */
  get aim(): Vec2 {
    return this.aimPoint;
  }

  /** The reticle is only meaningful while a round is being played. */
  get aimVisible(): boolean {
    return this.flow.screen === 'playing';
  }

  /** Returns true when the command did something (so the caller can cancel the key's default). */
  handle(command: PlayerCommand): boolean {
    switch (command.kind) {
      case 'pause':
        if (this.flow.screen !== 'playing' && this.flow.screen !== 'paused') return false;
        this.flow.togglePause();
        return true;
      case 'aim':
        if (this.flow.screen !== 'playing') return false;
        this.aimPoint = moveAim(
          this.aimPoint,
          command.dx,
          command.dy,
          command.fast ? AIM_FAST_STEP_PX : AIM_STEP_PX,
        );
        return true;
      case 'throw':
        if (this.flow.screen !== 'playing') return false;
        this.flow.session?.throwAt(this.aimPoint);
        return true;
    }
  }

  pointerMoved(position: Vec2): void {
    if (this.flow.screen === 'playing') this.aimPoint = position;
  }

  /** Click or tap: aim there and throw. */
  pointerPressed(position: Vec2): boolean {
    if (this.flow.screen !== 'playing') return false;
    this.aimPoint = position;
    this.flow.session?.throwAt(position);
    return true;
  }
}
