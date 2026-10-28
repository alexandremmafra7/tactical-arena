import { describe, expect, it, beforeEach } from 'vitest';
import { soundFx } from './soundEffects.js';

describe('SoundEffectsManager', () => {
  beforeEach(() => {
    soundFx.setMuted(false);
    soundFx.setVolume(0.8);
  });

  it('allows muting and setting volume', () => {
    expect(soundFx.isMuted()).toBe(false);
    soundFx.setMuted(true);
    expect(soundFx.isMuted()).toBe(true);
    soundFx.setMuted(false);
    expect(soundFx.isMuted()).toBe(false);

    soundFx.setVolume(0.5);
    soundFx.setVolume(1.5);
    soundFx.setVolume(-0.2);
  });

  it('safely handles playback methods in headless environment without crashing', () => {
    expect(() => soundFx.playWhistle('start')).not.toThrow();
    expect(() => soundFx.playWhistle('halftime')).not.toThrow();
    expect(() => soundFx.playWhistle('fulltime')).not.toThrow();
    expect(() => soundFx.playWhistle('short')).not.toThrow();
    expect(() => soundFx.playWhistle('event')).not.toThrow();
    expect(() => soundFx.playGoalCheer()).not.toThrow();
    expect(() => soundFx.playBallKick(1.0)).not.toThrow();
    expect(() => soundFx.playCard('yellow')).not.toThrow();
    expect(() => soundFx.playClick()).not.toThrow();
  });
});
