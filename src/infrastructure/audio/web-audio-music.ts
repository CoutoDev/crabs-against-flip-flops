import type { Biome } from '../../domain/entities/level';
import {
  BASS_GAIN,
  BASS_NOTE_STEPS,
  LEAD_GAIN,
  LEAD_NOTE_STEPS,
  midiToHz,
  MUSIC_TRACKS,
  stepSeconds,
  type MusicTrack,
} from './music-specs';

/** Where music is played: the same context and master volume as the sound effects. */
export interface AudioGraph {
  readonly context: AudioContext;
  readonly destination: AudioNode;
}

/** Calls `tick` repeatedly; returns the function that stops it. Injectable for tests. */
export type Ticker = (tick: () => void, everyMs: number) => () => void;

const defaultTicker: Ticker = (tick, everyMs) => {
  const id = setInterval(tick, everyMs);
  return () => clearInterval(id);
};

const TICK_MS = 40;
/** How far ahead of the clock notes are scheduled: long enough to survive a busy frame. */
const LOOKAHEAD_S = 0.2;
const FADE_OUT_S = 0.08;
const ATTACK_S = 0.006;

/**
 * Loops one biome's track through Web Audio. Notes are scheduled a little ahead of the audio
 * clock by a timer (the standard way to keep time steady), never played "live". It stays silent
 * until the sound effects have created the audio context (first user gesture).
 */
export class WebAudioMusic {
  private track: Biome | undefined;
  private enabled = true;
  private stopTicker: (() => void) | undefined;
  private bus: GainNode | undefined;
  private busContext: AudioContext | undefined;
  private step = 0;
  private nextTime = 0;

  constructor(
    private readonly getGraph: () => AudioGraph | undefined,
    private readonly ticker: Ticker = defaultTicker,
  ) {}

  /** Which biome's music should be playing; `undefined` for silence. Same biome again = no restart. */
  setTrack(track: Biome | undefined): void {
    if (track === this.track) return;
    this.track = track;
    this.restart();
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.restart();
  }

  get playing(): boolean {
    return this.stopTicker !== undefined;
  }

  private restart(): void {
    this.stopLoop();
    if (this.track !== undefined && this.enabled) this.startLoop();
  }

  private startLoop(): void {
    this.step = 0;
    this.nextTime = 0;
    this.stopTicker = this.ticker(() => this.tick(), TICK_MS);
  }

  private stopLoop(): void {
    this.stopTicker?.();
    this.stopTicker = undefined;
    const { bus, busContext } = this;
    if (bus !== undefined && busContext !== undefined) {
      // Cut the notes already scheduled with a quick fade instead of a click.
      const now = busContext.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
      setTimeout(() => bus.disconnect(), (FADE_OUT_S + 0.05) * 1000);
    }
    this.bus = undefined;
    this.busContext = undefined;
  }

  /** Schedules every step that falls inside the look-ahead window. */
  tick(): void {
    const graph = this.getGraph();
    const biome = this.track;
    if (graph === undefined || biome === undefined || graph.context.state !== 'running') return;
    const { context } = graph;
    const track = MUSIC_TRACKS[biome];

    if (this.nextTime === 0) this.nextTime = context.currentTime + 0.05;
    const bus = this.ensureBus(graph);
    const length = track.lead.length;
    while (this.nextTime < context.currentTime + LOOKAHEAD_S) {
      this.scheduleStep(context, bus, track, this.step % length, this.nextTime);
      this.nextTime += stepSeconds(track);
      this.step += 1;
    }
  }

  private ensureBus({ context, destination }: AudioGraph): GainNode {
    if (this.bus === undefined || this.busContext !== context) {
      this.bus = context.createGain();
      this.bus.gain.value = 1;
      this.bus.connect(destination);
      this.busContext = context;
    }
    return this.bus;
  }

  private scheduleStep(
    context: AudioContext,
    bus: GainNode,
    track: MusicTrack,
    index: number,
    at: number,
  ): void {
    const unit = stepSeconds(track);
    const lead = track.lead[index] ?? 0;
    const bass = track.bass[index] ?? 0;
    if (lead > 0)
      this.note(context, bus, track.leadWave, lead, at, LEAD_NOTE_STEPS * unit, LEAD_GAIN);
    if (bass > 0) this.note(context, bus, 'triangle', bass, at, BASS_NOTE_STEPS * unit, BASS_GAIN);
  }

  private note(
    context: AudioContext,
    bus: GainNode,
    wave: OscillatorType,
    midi: number,
    start: number,
    seconds: number,
    gain: number,
  ): void {
    const end = start + seconds;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + ATTACK_S);
    envelope.gain.linearRampToValueAtTime(0, end);
    envelope.connect(bus);

    const oscillator = context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(midiToHz(midi), start);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.connect(envelope);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}
