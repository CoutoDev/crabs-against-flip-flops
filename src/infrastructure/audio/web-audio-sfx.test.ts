import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../application/event-bus';
import type { DomainEvent } from '../../domain/events';
import { bindSfx } from './bind-sfx';
import { SFX_SPECS } from './sfx-specs';
import { MAX_VOICES, WebAudioSfx } from './web-audio-sfx';

// A minimal fake of the parts of the Web Audio API that the adapter uses.
function fakeAudio(initialState: AudioContextState = 'running') {
  const log = {
    oscillators: [] as FakeSource[],
    noises: [] as FakeSource[],
    gains: [] as FakeGain[],
  };
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  interface FakeSource {
    type?: string;
    frequency: ReturnType<typeof param>;
    buffer?: unknown;
    loop?: boolean;
    onended: (() => void) | null;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }
  interface FakeGain {
    gain: ReturnType<typeof param>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }
  const source = (): FakeSource => ({
    frequency: param(),
    onended: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const context = {
    state: initialState,
    currentTime: 10,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    createGain: vi.fn(() => {
      const gain: FakeGain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
      log.gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const osc = source();
      log.oscillators.push(osc);
      return osc;
    }),
    createBufferSource: vi.fn(() => {
      const noise = source();
      log.noises.push(noise);
      return noise;
    }),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    })),
  };
  return { context, log, create: () => context as unknown as AudioContext };
}

const hitRequest = { id: 'hit', semitones: 0 } as const;

describe('WebAudioSfx', () => {
  it('stays silent and does not create a context before the first user gesture', () => {
    const fake = fakeAudio();
    const create = vi.fn(fake.create);
    const sfx = new WebAudioSfx(create);
    sfx.play(hitRequest);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the context lazily on unlock and resumes it when suspended', async () => {
    const fake = fakeAudio('suspended');
    const create = vi.fn(fake.create);
    const sfx = new WebAudioSfx(create);
    await sfx.unlock();
    await sfx.unlock();
    expect(create).toHaveBeenCalledTimes(1);
    expect(fake.context.resume).toHaveBeenCalledTimes(1);
  });

  it('schedules every tone of a sound relative to the context clock, honoring the delay', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.play({ id: 'milestone', semitones: 0 });

    const spec = SFX_SPECS.milestone;
    expect(fake.log.oscillators).toHaveLength(spec.steps.length);
    const firstStart = fake.log.oscillators[0]?.start.mock.calls[0]?.[0] as number;
    expect(firstStart).toBeCloseTo(10 + spec.delayMs / 1000, 6);
    const lastStart = fake.log.oscillators.at(-1)?.start.mock.calls[0]?.[0] as number;
    expect(lastStart).toBeCloseTo(10 + (spec.delayMs + 210) / 1000, 6);
    expect(fake.log.oscillators[0]?.type).toBe('square');
  });

  it('shifts the pitch by the requested semitones (an octave doubles the frequency)', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.play({ id: 'rejected', semitones: 0 });
    sfx.play({ id: 'rejected', semitones: 12 });
    const base = fake.log.oscillators[0]?.frequency.setValueAtTime.mock.calls[0]?.[0] as number;
    const octave = fake.log.oscillators[1]?.frequency.setValueAtTime.mock.calls[0]?.[0] as number;
    expect(octave).toBeCloseTo(base * 2, 6);
  });

  it('slides the pitch for tones that define an end frequency', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.play({ id: 'throw', semitones: 0 });
    const ramp = fake.log.oscillators[0]?.frequency.linearRampToValueAtTime;
    expect(ramp).toHaveBeenCalledTimes(1);
    expect(ramp?.mock.calls[0]?.[0]).toBe(180);
  });

  it('uses a looping noise buffer for noise tones, created once and shared', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.play(hitRequest);
    sfx.play(hitRequest);
    expect(fake.log.noises).toHaveLength(2);
    expect(fake.log.noises[0]?.loop).toBe(true);
    expect(fake.context.createBuffer).toHaveBeenCalledTimes(1);
    expect(fake.log.noises[0]?.buffer).toBe(fake.log.noises[1]?.buffer);
  });

  it('fades every tone in and out to avoid clicks', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.play({ id: 'click', semitones: 0 });
    const envelope = fake.log.gains.at(-1);
    expect(envelope?.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    expect(envelope?.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
    expect(envelope?.gain.linearRampToValueAtTime.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it('is silent while muted and audible again afterwards', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.setMuted(true);
    sfx.play(hitRequest);
    expect(fake.log.oscillators).toHaveLength(0);
    expect(sfx.muted).toBe(true);
    sfx.setMuted(false);
    sfx.play(hitRequest);
    expect(fake.log.oscillators.length).toBeGreaterThan(0);
  });

  it('keeps the mute choice made before the context existed', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    sfx.setMuted(true);
    await sfx.unlock();
    const master = fake.log.gains[0];
    expect(master?.gain.value).toBe(0);
  });

  it('caps simultaneous voices and frees them when tones end', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    const perSound = SFX_SPECS.hit.steps.length;
    const fits = Math.floor(MAX_VOICES / perSound);
    for (let i = 0; i < fits + 5; i += 1) sfx.play(hitRequest);
    expect(fake.log.oscillators.length + fake.log.noises.length).toBe(fits * perSound);

    for (const source of [...fake.log.oscillators, ...fake.log.noises]) source.onended?.();
    sfx.play(hitRequest);
    expect(fake.log.oscillators.length + fake.log.noises.length).toBe(fits * perSound + perSound);
  });

  it('releases nodes when a tone ends', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.play({ id: 'click', semitones: 0 });
    const osc = fake.log.oscillators[0];
    osc?.onended?.();
    expect(osc?.disconnect).toHaveBeenCalled();
  });

  it('does not play on a closed context', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    fake.context.state = 'closed';
    sfx.play(hitRequest);
    expect(fake.log.oscillators).toHaveLength(0);
  });
});

describe('bindSfx', () => {
  it('plays the sound of each event, ignores silent events and can be unsubscribed', () => {
    const bus = new EventBus<DomainEvent>();
    const play = vi.fn();
    const unbind = bindSfx(bus, { play });

    bus.publish({ type: 'ThrowRejected', reason: 'round_over' });
    expect(play).not.toHaveBeenCalled();

    bus.publish({ type: 'RoundLost', score: 0 });
    expect(play).toHaveBeenCalledWith({ id: 'lose', semitones: 0 });

    unbind();
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe('WebAudioSfx volume', () => {
  it('scales the master gain by the volume and silences it when muted', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    const master = fake.log.gains[0];
    const full = master?.gain.value as number;
    sfx.setVolume(0.5);
    expect(master?.gain.value).toBeCloseTo(full / 2);
    sfx.setMuted(true);
    expect(master?.gain.value).toBe(0);
    sfx.setMuted(false);
    expect(master?.gain.value).toBeCloseTo(full / 2);
  });

  it('applies a volume chosen before the audio exists once it is created', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    sfx.setVolume(0.25);
    await sfx.unlock();
    expect(fake.log.gains[0]?.gain.value).toBeCloseTo(0.35 * 0.25);
  });

  it('clamps the volume to 0..1', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    await sfx.unlock();
    sfx.setVolume(5);
    expect(fake.log.gains[0]?.gain.value).toBeCloseTo(0.35);
    sfx.setVolume(-1);
    expect(fake.log.gains[0]?.gain.value).toBe(0);
  });

  it('exposes the audio graph only after the first gesture, for the music', async () => {
    const fake = fakeAudio();
    const sfx = new WebAudioSfx(fake.create);
    expect(sfx.graph).toBeUndefined();
    await sfx.unlock();
    expect(sfx.graph?.context).toBe(fake.context);
  });
});
