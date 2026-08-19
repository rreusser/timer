import { vi } from 'vitest';

/**
 * A minimal Web Audio stand-in. jsdom ships no AudioContext at all, which is
 * how a bug that silenced the real beeper slipped past a green test suite.
 */
export interface AudioEvent {
  param: 'gain' | 'frequency';
  method: 'setTargetAtTime' | 'setValueAtTime';
  value: number;
  time: number;
}

class FakeParam {
  value = 0;
  private readonly log: AudioEvent[];
  private readonly name: 'gain' | 'frequency';

  constructor(log: AudioEvent[], name: 'gain' | 'frequency') {
    this.log = log;
    this.name = name;
  }
  setTargetAtTime(value: number, time: number) {
    this.value = value;
    this.log.push({ param: this.name, method: 'setTargetAtTime', value, time });
  }
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.log.push({ param: this.name, method: 'setValueAtTime', value, time });
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  destination = { kind: 'destination' };
  events: AudioEvent[] = [];
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  resumeCount = 0;
  closed = false;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  async resume() {
    this.resumeCount += 1;
    if (this.state !== 'closed') this.state = 'running';
  }

  async close() {
    this.closed = true;
    this.state = 'closed';
  }

  createGain() {
    const node = new FakeGain(this.events);
    this.gains.push(node);
    return node;
  }

  createOscillator() {
    const node = new FakeOscillator(this.events);
    this.oscillators.push(node);
    return node;
  }
}

class FakeGain {
  gain: FakeParam;
  connected: unknown[] = [];
  disconnected = false;
  constructor(log: AudioEvent[]) {
    this.gain = new FakeParam(log, 'gain');
  }
  connect(target: unknown) {
    this.connected.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeOscillator {
  type = 'sine';
  frequency: FakeParam;
  started = 0;
  stopped = 0;
  constructor(log: AudioEvent[]) {
    this.frequency = new FakeParam(log, 'frequency');
  }
  connect() {}
  disconnect() {}
  start() {
    if (this.started > 0) throw new Error('cannot start twice');
    this.started += 1;
  }
  stop() {
    this.stopped += 1;
  }
}

/** Install the fake for the duration of a test. Returns a teardown function. */
export function installFakeAudio() {
  FakeAudioContext.instances = [];
  const original = Object.getOwnPropertyDescriptor(window, 'AudioContext');
  vi.stubGlobal('AudioContext', FakeAudioContext);

  return {
    get contexts() {
      return FakeAudioContext.instances;
    },
    /** The context the app is actually using: the newest live one. */
    get live() {
      return FakeAudioContext.instances.filter((c) => !c.closed).at(-1);
    },
    restore() {
      vi.unstubAllGlobals();
      if (original) Object.defineProperty(window, 'AudioContext', original);
      FakeAudioContext.instances = [];
    },
  };
}
