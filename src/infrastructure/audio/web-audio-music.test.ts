import { describe, expect, it, vi } from 'vitest';
import { MUSIC_TRACKS, stepSeconds } from './music-specs';
import { WebAudioMusic, type Ticker } from './web-audio-music';

function fakeContext(state: AudioContextState = 'running') {
  const oscillators: {
    type?: string;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  const buses: { gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const context = {
    state,
    currentTime: 1,
    createGain: vi.fn(() => {
      const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
      buses.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'square',
        frequency: { setValueAtTime: vi.fn() },
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
  };
  return { context, oscillators, buses };
}

/** A ticker the test drives by hand, so no real timers run. */
function manualTicker() {
  const running: (() => void)[] = [];
  const stops = vi.fn();
  const ticker: Ticker = (tick) => {
    running.push(tick);
    return () => {
      running.splice(running.indexOf(tick), 1);
      stops();
    };
  };
  return { ticker, running, stops };
}

const setup = (state: AudioContextState = 'running') => {
  const fake = fakeContext(state);
  const timer = manualTicker();
  const graph = { context: fake.context as unknown as AudioContext, destination: {} as AudioNode };
  let available: typeof graph | undefined = graph;
  const music = new WebAudioMusic(() => available, timer.ticker);
  return {
    music,
    fake,
    timer,
    withoutAudio: () => {
      available = undefined;
    },
  };
};

describe('WebAudioMusic', () => {
  it('does nothing while there is no track', () => {
    const { music, timer } = setup();
    expect(music.playing).toBe(false);
    expect(timer.running).toHaveLength(0);
  });

  it('starts a timer when a track is chosen and schedules notes ahead of the clock', () => {
    const { music, fake, timer } = setup();
    music.setTrack('beach');
    expect(music.playing).toBe(true);
    timer.running[0]?.();
    expect(fake.oscillators.length).toBeGreaterThan(0);
    const starts = fake.oscillators.map((osc) => osc.start.mock.calls[0]?.[0] as number);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(1); // never in the past
    expect(Math.max(...starts)).toBeLessThanOrEqual(1 + 0.2 + stepSeconds(MUSIC_TRACKS.beach));
  });

  it('keeps time on a grid of 16th notes and loops the pattern', () => {
    const { music, fake, timer } = setup();
    music.setTrack('beach');
    for (let i = 0; i < 400; i += 1) {
      fake.context.currentTime += 0.04;
      timer.running[0]?.();
    }
    const track = MUSIC_TRACKS.beach;
    const expectedNotes =
      (track.lead.filter(Boolean).length + track.bass.filter(Boolean).length) / 32;
    // 16 s at 112 bpm is many loops: the number of notes keeps growing with the same density.
    const loops = (16 + 0.2) / (stepSeconds(track) * 32);
    expect(fake.oscillators.length).toBeGreaterThan(expectedNotes * 32 * (loops - 1));
    const leadStarts = fake.oscillators.map((osc) => osc.start.mock.calls[0]?.[0] as number);
    const sorted = [...leadStarts].sort((a, b) => a - b);
    const steps = sorted.map((time) => (time - (sorted[0] ?? 0)) / stepSeconds(track));
    for (const step of steps) expect(Math.abs(step - Math.round(step))).toBeLessThan(1e-6);
  });

  it('plays the pitch of the first notes of the track', () => {
    const { music, fake, timer } = setup();
    music.setTrack('rocks');
    timer.running[0]?.();
    const frequencies = fake.oscillators.map(
      (osc) => osc.frequency.setValueAtTime.mock.calls[0]?.[0] as number,
    );
    expect(frequencies.some((hz) => Math.abs(hz - 440 * 2 ** ((69 - 69) / 12)) < 0.01)).toBe(true);
  });

  it('waits for the audio to exist and to be running before it schedules anything', () => {
    const suspended = setup('suspended');
    suspended.music.setTrack('beach');
    suspended.timer.running[0]?.();
    expect(suspended.fake.oscillators).toHaveLength(0);

    const none = setup();
    none.withoutAudio();
    none.music.setTrack('beach');
    none.timer.running[0]?.();
    expect(none.fake.oscillators).toHaveLength(0);
  });

  it('does not restart when the same track is asked for again', () => {
    const { music, timer } = setup();
    music.setTrack('beach');
    music.setTrack('beach');
    expect(timer.running).toHaveLength(1);
    expect(timer.stops).not.toHaveBeenCalled();
  });

  it('restarts on another track and stops on silence', () => {
    const { music, timer } = setup();
    music.setTrack('beach');
    music.setTrack('night');
    expect(timer.stops).toHaveBeenCalledTimes(1);
    expect(timer.running).toHaveLength(1);
    music.setTrack(undefined);
    expect(timer.running).toHaveLength(0);
    expect(music.playing).toBe(false);
  });

  it('can be switched off and on without losing the chosen track', () => {
    const { music, timer } = setup();
    music.setTrack('beach');
    music.setEnabled(false);
    expect(music.playing).toBe(false);
    expect(timer.running).toHaveLength(0);
    music.setEnabled(true);
    expect(music.playing).toBe(true);
  });

  it('does not start while it is disabled', () => {
    const { music, timer } = setup();
    music.setEnabled(false);
    music.setTrack('beach');
    expect(timer.running).toHaveLength(0);
  });

  it('fades the notes already scheduled out instead of cutting them', () => {
    const { music, fake, timer } = setup();
    vi.useFakeTimers();
    music.setTrack('beach');
    timer.running[0]?.();
    music.setTrack(undefined);
    const bus = fake.buses[0];
    expect(bus?.gain.setValueAtTime).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
