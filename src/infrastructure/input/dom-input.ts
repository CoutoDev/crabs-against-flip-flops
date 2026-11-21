import { clientToField, type ScreenRect } from '../../application/viewport';
import type { PlayerCommand } from '../../application/player-controls';
import type { Vec2 } from '../../domain/geometry';
import { commandForKey } from './keyboard-commands';

export interface PointerHandlers {
  onMove(position: Vec2): void;
  onPress(position: Vec2): void;
}

/** Mouse, touch and pen through Pointer Events. Returns a function that removes the listeners. */
export function bindPointer(
  canvas: HTMLElement,
  getRect: () => ScreenRect,
  handlers: PointerHandlers,
): () => void {
  const toField = (event: PointerEvent): Vec2 | undefined =>
    clientToField(event.clientX, event.clientY, getRect());

  const onMove = (event: PointerEvent): void => {
    const position = toField(event);
    if (position !== undefined) handlers.onMove(position);
  };
  const onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const position = toField(event);
    if (position === undefined) return;
    event.preventDefault();
    handlers.onPress(position);
  };

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  return () => {
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onDown);
  };
}

/**
 * Keyboard on the whole document. `onCommand` returns whether the command did something; only then
 * the browser default (scrolling, activating a button) is cancelled. Space/Enter on a focused
 * button are never taken from it, so overlays stay operable by keyboard.
 */
export function bindKeyboard(
  target: Document,
  onCommand: (command: PlayerCommand) => boolean,
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const command = commandForKey(event);
    if (command === undefined) return;
    if (command.kind === 'throw' && event.target instanceof HTMLButtonElement) return;
    if (onCommand(command)) event.preventDefault();
  };
  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
