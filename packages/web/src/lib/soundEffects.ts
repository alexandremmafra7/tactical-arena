/**
 * Tactical Arena FC - High-Fidelity Sound Effects Utility
 * Uses Web Audio API to synthesize smooth, realistic referee whistle, stadium crowd roar,
 * ball kicks, card bookings, and UI sounds with zero external dependencies, 0ms latency,
 * and full cross-platform support (Web, Desktop, Android APK).
 */

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted: boolean = false;
  private volume: number = 0.75;

  constructor() {
    // Lazy init AudioContext on first user interaction to comply with browser autoplay policies
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.ctx && (!this.masterGain || !this.compressor)) {
      // Dynamics compressor prevents clipping, distortion and shrill volume spikes
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(24, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.08, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

      // Lowpass smoothing filter on master to remove digital harshness
      const masterFilter = this.ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.setValueAtTime(12000, this.ctx.currentTime);
      masterFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      this.compressor.connect(masterFilter);
      masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    return this.ctx;
  }

  private getDestination(): AudioNode | null {
    if (!this.getContext()) return null;
    return this.compressor ?? this.ctx!.destination;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /**
   * Plays an authentic, smooth referee whistle sound without harsh shrill highs.
   * @param pattern 'start' (triple blast), 'halftime' (double blast), 'fulltime' (long triple blast), 'short' (single blast), 'event' (sharp double blast)
   */
  public playWhistle(pattern: 'start' | 'halftime' | 'fulltime' | 'short' | 'event' = 'short') {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const blasts: { delay: number; duration: number }[] = [];

    switch (pattern) {
      case 'start':
        blasts.push({ delay: 0, duration: 0.16 }, { delay: 0.22, duration: 0.16 }, { delay: 0.44, duration: 0.55 });
        break;
      case 'halftime':
        blasts.push({ delay: 0, duration: 0.2 }, { delay: 0.28, duration: 0.45 });
        break;
      case 'fulltime':
        blasts.push({ delay: 0, duration: 0.2 }, { delay: 0.28, duration: 0.25 }, { delay: 0.6, duration: 0.75 });
        break;
      case 'event':
        blasts.push({ delay: 0, duration: 0.14 }, { delay: 0.2, duration: 0.32 });
        break;
      case 'short':
      default:
        blasts.push({ delay: 0, duration: 0.28 });
        break;
    }

    const now = ctx.currentTime;

    blasts.forEach(({ delay, duration }) => {
      const startTime = now + delay;
      const stopTime = startTime + duration;

      // Master gain for this blast with smooth exponential-like envelope
      const blastGain = ctx.createGain();
      blastGain.gain.setValueAtTime(0.0001, startTime);
      blastGain.gain.linearRampToValueAtTime(0.18, startTime + 0.025);
      blastGain.gain.setValueAtTime(0.18, stopTime - 0.04);
      blastGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

      // Lowpass filter specifically tailored for whistle body warmth (removes ear-piercing piercing frequencies)
      const whistleFilter = ctx.createBiquadFilter();
      whistleFilter.type = 'lowpass';
      whistleFilter.frequency.setValueAtTime(3200, startTime);
      whistleFilter.Q.setValueAtTime(1.2, startTime);

      // Tremolo / pea rattle LFO (modulates pitch & amplitude around ~24Hz)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(24, startTime);
      lfoGain.gain.setValueAtTime(18, startTime); // ±18 Hz subtle pitch flutter

      // Natural dual-tone whistle acoustic model (warm 2120 Hz & 2240 Hz fundamental harmonic pair)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Subtle natural pitch sag during expiration
      osc1.frequency.setValueAtTime(2120, startTime);
      osc1.frequency.exponentialRampToValueAtTime(2060, stopTime);

      osc2.frequency.setValueAtTime(2240, startTime);
      osc2.frequency.exponentialRampToValueAtTime(2180, stopTime);

      lfo.connect(osc1.frequency);
      lfo.connect(osc2.frequency);

      // Gentle breath air turbulence noise layer
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.04; // subtle breath
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2180, startTime);
      noiseFilter.Q.setValueAtTime(3, startTime);

      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(blastGain);

      osc1.connect(whistleFilter);
      osc2.connect(whistleFilter);
      whistleFilter.connect(blastGain);
      blastGain.connect(dest);

      lfo.start(startTime);
      lfo.stop(stopTime);
      osc1.start(startTime);
      osc1.stop(stopTime);
      osc2.start(startTime);
      osc2.stop(stopTime);
      noiseSrc.start(startTime);
      noiseSrc.stop(stopTime);
    });
  }

  /**
   * Synthesizes a realistic, high-fidelity stadium crowd cheer & goal celebration sound.
   */
  public playGoalCheer() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const duration = 3.6;

    // 1. Ball Impact / Goal Net Thud (Sub punch)
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    const kickFilter = ctx.createBiquadFilter();

    kickFilter.type = 'lowpass';
    kickFilter.frequency.setValueAtTime(140, now);

    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(80, now);
    kickOsc.frequency.exponentialRampToValueAtTime(32, now + 0.28);

    kickGain.gain.setValueAtTime(0.35, now);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    kickOsc.connect(kickFilter);
    kickFilter.connect(kickGain);
    kickGain.connect(dest);

    kickOsc.start(now);
    kickOsc.stop(now + 0.32);

    // 2. Crowd Roar (Warm multi-formant filtered stadium roar)
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const left = noiseBuffer.getChannelData(0);
    const right = noiseBuffer.getChannelData(1);

    // Pink-weighted smoothed noise for natural stadium rumble
    let b0L = 0, b1L = 0, b2L = 0;
    let b0R = 0, b1R = 0, b2R = 0;
    for (let i = 0; i < bufferSize; i++) {
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;
      b0L = 0.99886 * b0L + whiteL * 0.0555179;
      b1L = 0.99332 * b1L + whiteL * 0.0750759;
      b2L = 0.96900 * b2L + whiteL * 0.1538520;
      left[i] = (b0L + b1L + b2L + whiteL * 0.1) * 0.25;

      b0R = 0.99886 * b0R + whiteR * 0.0555179;
      b1R = 0.99332 * b1R + whiteR * 0.0750759;
      b2R = 0.96900 * b2R + whiteR * 0.1538520;
      right[i] = (b0R + b1R + b2R + whiteR * 0.1) * 0.25;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    // Crowd voice formant filters (vocal resonances around 420Hz, 850Hz, and 1250Hz)
    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'bandpass';
    formant1.frequency.setValueAtTime(420, now);
    formant1.frequency.linearRampToValueAtTime(750, now + 0.6);
    formant1.frequency.linearRampToValueAtTime(500, now + duration);
    formant1.Q.setValueAtTime(1.8, now);

    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0.0001, now);
    roarGain.gain.linearRampToValueAtTime(0.25, now + 0.35);
    roarGain.gain.setValueAtTime(0.22, now + 1.6);
    roarGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSrc.connect(formant1);
    formant1.connect(roarGain);
    roarGain.connect(dest);

    noiseSrc.start(now);
    noiseSrc.stop(now + duration);

    // 3. Subtle Warm Ambient Stadium Chords (Gentle triangle harmonic undertone)
    const chordFreqs = [220.0, 277.18, 329.63, 440.0]; // A3, C#4, E4, A4 (A major triumphant)
    chordFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const lp = ctx.createBiquadFilter();

      osc.type = 'triangle'; // Smooth mellow waveform (not harsh sawtooth!)
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.015, now + duration);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(650, now);
      lp.frequency.linearRampToValueAtTime(950, now + 0.5);

      const amp = 0.025 / (idx + 1);
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(amp, now + 0.4);
      oscGain.gain.setValueAtTime(amp, now + 1.4);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      osc.connect(lp);
      lp.connect(oscGain);
      oscGain.connect(dest);

      osc.start(now);
      osc.stop(now + 2.8);
    });
  }

  /**
   * Plays a stadium crowd boo / disappointment groan when the opponent scores,
   * accompanied by a short referee whistle pointing to the center circle.
   */
  public playOpponentGoalBoo() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const duration = 2.8;

    // 1. Referee whistle pointing to kickoff center spot
    this.playWhistle('short');

    // 2. Crowd Disappointment Groan / Booing (Bandpass filtered noise descending from 320Hz to 160Hz)
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const left = noiseBuffer.getChannelData(0);
    const right = noiseBuffer.getChannelData(1);

    for (let i = 0; i < bufferSize; i++) {
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;
      left[i] = whiteL * 0.35;
      right[i] = whiteR * 0.35;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const groanFilter = ctx.createBiquadFilter();
    groanFilter.type = 'bandpass';
    groanFilter.frequency.setValueAtTime(320, now);
    groanFilter.frequency.linearRampToValueAtTime(160, now + duration);
    groanFilter.Q.setValueAtTime(2.2, now);

    const groanGain = ctx.createGain();
    groanGain.gain.setValueAtTime(0.0001, now);
    groanGain.gain.linearRampToValueAtTime(0.26, now + 0.25);
    groanGain.gain.setValueAtTime(0.24, now + 1.2);
    groanGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSrc.connect(groanFilter);
    groanFilter.connect(groanGain);
    groanGain.connect(dest);

    noiseSrc.start(now);
    noiseSrc.stop(now + duration);

    // 3. Low minor drone dissonance (discouraged crowd murmur)
    const droneFreqs = [146.83, 174.61]; // D3, F3 (D minor sad / gloomy)
    droneFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, now);

      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(0.02, now + 0.3);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      osc.connect(lp);
      lp.connect(oscGain);
      oscGain.connect(dest);

      osc.start(now);
      osc.stop(now + 2.0);
    });
  }

  /**
   * Plays a crisp, acoustic ball kick/strike effect.
   */
  public playBallKick(power: number = 1.0) {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const dur = 0.09;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 * Math.min(1.2, power), now);
    osc.frequency.exponentialRampToValueAtTime(38, now + dur);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(0.28 * Math.min(1.0, power), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + dur);
  }

  /**
   * Plays a card / booking alert sound effect.
   */
  public playCard(_type: 'yellow' | 'red' = 'yellow') {
    this.playWhistle('event');
  }

  /**
   * Plays a subtle, pleasant UI tap / button press click.
   */
  public playClick() {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.025);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  /**
   * Tactical pitch adjustment feedback sound.
   */
  public playTacticalClick() {
    this.playClick();
  }
}

export const soundFx = new SoundEffectsManager();

