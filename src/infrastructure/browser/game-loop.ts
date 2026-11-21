export interface FrameScheduler {
  request(callback: (timestampMs: number) => void): number;
  cancel(handle: number): void;
}

const browserScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * Calls `onFrame(dtMs)` once per display frame with the real time since the previous one
 * (0 on the first frame). The simulation decides what to do with it (fixed-step accumulator).
 * Returns a function that stops the loop.
 */
export function startGameLoop(
  onFrame: (dtMs: number) => void,
  scheduler: FrameScheduler = browserScheduler,
): () => void {
  let handle: number | undefined;
  let previous: number | undefined;
  let running = true;

  const tick = (timestampMs: number): void => {
    if (!running) return;
    const dt = previous === undefined ? 0 : Math.max(0, timestampMs - previous);
    previous = timestampMs;
    onFrame(dt);
    if (running) handle = scheduler.request(tick);
  };
  handle = scheduler.request(tick);

  return () => {
    running = false;
    if (handle !== undefined) scheduler.cancel(handle);
  };
}
