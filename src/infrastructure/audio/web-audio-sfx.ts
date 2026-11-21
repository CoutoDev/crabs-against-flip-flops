import type { SfxRequest } from './sfx-for-event';
import { SFX_SPECS, type ToneStep } from './sfx-specs';

const MASTER_VOLUME = 0.35;
/** Upper bound of simultaneous oscillators, so a burst of events cannot saturate the mixer. */
export const MAX_VOICES = 16;
const ATTACK_S = 0.004;
const NOISE_SECONDS = 0.25;

/**
 * Plays the synthesized sounds with the Web Audio API. Browsers keep audio suspended until a user
 * gesture, so `unlock()` must be called from an input handler (the first click, tap or key).
 */
export class WebAudioSfx {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private noiseBuffer: AudioBuffer | undefined;
  private voices = 0;
  private isMuted = false;
  private level = 1;

  constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

  get muted(): boolean {
    return this.isMuted;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.applyVolume();
  }

  /** Master volume for effects and music, 0..1. */
  setVolume(volume: number): void {
    this.level = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  /** The context and master output, once a user gesture has created them (for the music). */
  get graph(): { readonly context: AudioContext; readonly destination: AudioNode } | undefined {
    if (this.context === undefined || this.master === undefined) return undefined;
    return { context: this.context, destination: this.master };
  }

  private applyVolume(): void {
    if (this.master !== undefined) {
      this.master.gain.value = this.isMuted ? 0 : MASTER_VOLUME * this.level;
    }
  }

  /** Creates the context on first use and resumes it. Safe to call on every user gesture. */
  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
  }

  play(request: SfxRequest): void {
    if (this.isMuted) return;
    const context = this.context;
    const master = this.master;
    if (context === undefined || master === undefined || context.state === 'closed') return;

    const spec = SFX_SPECS[request.id];
    if (this.voices + spec.steps.length > MAX_VOICES) return;

    const origin = context.currentTime + spec.delayMs / 1000;
    const ratio = 2 ** (request.semitones / 12);
    for (const step of spec.steps) this.schedule(context, master, step, origin, ratio);
  }

  private ensureContext(): AudioContext {
    if (this.context === undefined) {
      this.context = this.createContext();
      const master = this.context.createGain();
      this.master = master;
      master.connect(this.context.destination);
      this.applyVolume();
    }
    return this.context;
  }

  private noise(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer === undefined) {
      const length = Math.floor(context.sampleRate * NOISE_SECONDS);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) samples[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private schedule(
    context: AudioContext,
    destination: AudioNode,
    step: ToneStep,
    origin: number,
    ratio: number,
  ): void {
    const start = origin + step.startMs / 1000;
    const end = start + step.durationMs / 1000;

    // A short attack and a ramp to zero avoid the clicks of abruptly started/stopped waves.
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(step.gain, start + ATTACK_S);
    envelope.gain.linearRampToValueAtTime(0, end);
    envelope.connect(destination);

    let source: OscillatorNode | AudioBufferSourceNode;
    if (step.wave === 'noise') {
      const noise = context.createBufferSource();
      noise.buffer = this.noise(context);
      noise.loop = true;
      source = noise;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = step.wave;
      const from = (step.freqHz ?? 440) * ratio;
      oscillator.frequency.setValueAtTime(from, start);
      if (step.endFreqHz !== undefined) {
        oscillator.frequency.linearRampToValueAtTime(step.endFreqHz * ratio, end);
      }
      source = oscillator;
    }

    this.voices += 1;
    source.onended = () => {
      this.voices -= 1;
      source.disconnect();
      envelope.disconnect();
    };
    source.connect(envelope);
    source.start(start);
    source.stop(end + 0.02);
  }
}
