import type { AimDirection } from '../../application/aim';
import type { PlayerCommand } from '../../application/player-controls';

export interface KeyInfo {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
}

const AIM_KEYS: Readonly<Record<string, readonly [AimDirection, AimDirection]>> = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};

/**
 * Keyboard scheme (also the accessible alternative to the pointer): arrows / WASD aim, Shift
 * moves faster, Space / Enter throw, P / Esc pause. Browser shortcuts (Ctrl/Cmd/Alt) are left alone.
 * Holding a key keeps aiming but never repeats a throw or a pause.
 */
export function commandForKey(event: KeyInfo): PlayerCommand | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  const key = event.key.toLowerCase();

  const direction = AIM_KEYS[key];
  if (direction !== undefined) {
    return { kind: 'aim', dx: direction[0], dy: direction[1], fast: event.shiftKey };
  }
  if (event.repeat) return undefined;
  if (key === ' ' || key === 'enter') return { kind: 'throw' };
  if (key === 'p' || key === 'escape') return { kind: 'pause' };
  return undefined;
}
