import { describe, expect, it, vi } from 'vitest';
import { startGameLoop, type FrameScheduler } from './game-loop';

function fakeScheduler() {
  let next = 1;
  const pending = new Map<number, (t: number) => void>();
  const scheduler: FrameScheduler = {
    request: (callback) => {
      const handle = next++;
      pending.set(handle, callback);
      return handle;
    },
    cancel: vi.fn((handle: number) => {
      pending.delete(handle);
    }),
  };
  /** Runs the currently scheduled frame at `timestampMs`. */
  const frame = (timestampMs: number): void => {
    const [handle, callback] = [...pending.entries()][0] ?? [];
    if (handle === undefined || callback === undefined) throw new Error('no frame scheduled');
    pending.delete(handle);
    callback(timestampMs);
  };
  return { scheduler, frame, pending };
}

describe('startGameLoop', () => {
  it('passes the real elapsed time, with 0 on the first frame', () => {
    const { scheduler, frame } = fakeScheduler();
    const onFrame = vi.fn();
    startGameLoop(onFrame, scheduler);
    frame(1000);
    frame(1016.7);
    frame(1050);
    expect(onFrame.mock.calls.map(([dt]) => dt)).toEqual([
      0,
      expect.closeTo(16.7, 5),
      expect.closeTo(33.3, 5),
    ]);
  });

  it('never reports a negative delta if the clock steps back', () => {
    const { scheduler, frame } = fakeScheduler();
    const onFrame = vi.fn();
    startGameLoop(onFrame, scheduler);
    frame(1000);
    frame(990);
    expect(onFrame.mock.calls[1]?.[0]).toBe(0);
  });

  it('stops: cancels the pending frame and ignores late callbacks', () => {
    const { scheduler, frame, pending } = fakeScheduler();
    const onFrame = vi.fn();
    const stop = startGameLoop(onFrame, scheduler);
    frame(0);
    stop();
    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(0);
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it('can be stopped from inside a frame without scheduling another one', () => {
    const { scheduler, frame, pending } = fakeScheduler();
    let stop: () => void = () => undefined;
    stop = startGameLoop(() => stop(), scheduler);
    frame(0);
    expect(pending.size).toBe(0);
  });
});
