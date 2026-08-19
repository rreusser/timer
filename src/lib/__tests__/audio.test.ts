import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBeeper } from '../audio';
import { installFakeAudio } from './fakeAudio';

let audio: ReturnType<typeof installFakeAudio>;

beforeEach(() => {
  audio = installFakeAudio();
});

afterEach(() => {
  audio.restore();
});

describe('createBeeper', () => {
  it('builds no AudioContext until something asks for sound', () => {
    createBeeper();
    expect(audio.contexts).toHaveLength(0);
  });

  it('resumes a suspended context on unlock', async () => {
    const beeper = createBeeper();
    await beeper.unlock();

    expect(audio.contexts).toHaveLength(1);
    expect(audio.live?.state).toBe('running');
    expect(audio.live?.resumeCount).toBe(1);
  });

  it('runs one oscillator for the life of the context', async () => {
    const beeper = createBeeper();
    await beeper.unlock();
    beeper.tone(440, 0.3);
    beeper.blip(880, 1, 100);
    beeper.silence();

    expect(audio.live?.oscillators).toHaveLength(1);
    expect(audio.live?.oscillators[0]?.started).toBe(1);
  });

  it('schedules a blip as a rise and a fall a beat later', async () => {
    const beeper = createBeeper();
    await beeper.unlock();
    audio.live!.currentTime = 2;
    beeper.blip(880, 1, 100);

    expect(audio.live?.events).toEqual([
      { param: 'frequency', method: 'setValueAtTime', value: 880, time: 2 },
      { param: 'gain', method: 'setTargetAtTime', value: 1, time: 2 },
      { param: 'gain', method: 'setTargetAtTime', value: 0, time: 2.1 },
    ]);
  });

  it('holds a tone until told otherwise', async () => {
    const beeper = createBeeper();
    await beeper.unlock();
    beeper.tone(440, 0.3);

    expect(audio.live?.gains[0]?.gain.value).toBe(0.3);
    beeper.silence();
    expect(audio.live?.gains[0]?.gain.value).toBe(0);
  });

  // The regression that silenced the app in development: React StrictMode
  // mounts, unmounts and remounts, so the effect cleanup ran dispose() on a
  // beeper that was then reused for the rest of the session.
  it('still makes sound after being disposed and used again', async () => {
    const beeper = createBeeper();
    await beeper.unlock();
    const first = audio.live;
    expect(first?.state).toBe('running');

    beeper.dispose();
    expect(first?.closed).toBe(true);

    await beeper.unlock();
    beeper.blip(880, 1, 100);

    const second = audio.live;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(second?.state).toBe('running');
    expect(second?.events.some((e) => e.param === 'gain' && e.value === 1)).toBe(true);
  });

  it('survives dispose being called twice', () => {
    const beeper = createBeeper();
    expect(() => {
      beeper.dispose();
      beeper.dispose();
    }).not.toThrow();
  });

  it('degrades to silence where Web Audio is missing', async () => {
    audio.restore();
    // @ts-expect-error deliberately removing the constructor
    delete window.AudioContext;

    const beeper = createBeeper();
    await expect(beeper.unlock()).resolves.toBeUndefined();
    expect(() => {
      beeper.tone(440, 0.3);
      beeper.blip(880, 1, 100);
      beeper.silence();
      beeper.dispose();
    }).not.toThrow();

    audio = installFakeAudio();
  });
});
