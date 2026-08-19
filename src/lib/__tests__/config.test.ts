import { describe, expect, it } from 'vitest';
import { CONFIG_BOUNDS, DEFAULT_CONFIG, loadConfig, saveConfig } from '../config';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

function throwingStorage(): Storage {
  return new Proxy({} as Storage, {
    get() {
      throw new DOMException('blocked');
    },
  });
}

describe('loadConfig', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadConfig(memoryStorage())).toEqual(DEFAULT_CONFIG);
  });

  it('reads back what saveConfig wrote', () => {
    const storage = memoryStorage();
    const config = { delay: 2.5, randomness: 1, target: 0.8, interval: 7 };
    saveConfig(config, storage);
    expect(loadConfig(storage)).toEqual(config);
  });

  it('migrates settings saved by the original app under bare keys', () => {
    const storage = memoryStorage({ delay: '6', target: '2.2' });
    expect(loadConfig(storage)).toEqual({ ...DEFAULT_CONFIG, delay: 6, target: 2.2 });
  });

  it('prefers namespaced keys over the legacy ones', () => {
    const storage = memoryStorage({ delay: '6', 'reactionTrainer.delay': '3' });
    expect(loadConfig(storage).delay).toBe(3);
  });

  it('clamps out-of-range values into the slider bounds', () => {
    const storage = memoryStorage({
      'reactionTrainer.delay': '999',
      'reactionTrainer.target': '-5',
    });
    const config = loadConfig(storage);
    expect(config.delay).toBe(CONFIG_BOUNDS.delay.max);
    expect(config.target).toBe(CONFIG_BOUNDS.target.min);
  });

  it('falls back to defaults for unparseable values', () => {
    const storage = memoryStorage({ 'reactionTrainer.interval': 'not a number' });
    expect(loadConfig(storage).interval).toBe(DEFAULT_CONFIG.interval);
  });

  it('survives storage that throws, as in private-mode Safari', () => {
    expect(loadConfig(throwingStorage())).toEqual(DEFAULT_CONFIG);
    expect(() => saveConfig(DEFAULT_CONFIG, throwingStorage())).not.toThrow();
  });

  it('survives storage being unavailable entirely', () => {
    expect(loadConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(() => saveConfig(DEFAULT_CONFIG, undefined)).not.toThrow();
  });
});

describe('CONFIG_BOUNDS', () => {
  it('keeps every default inside its own bounds', () => {
    for (const [key, bounds] of Object.entries(CONFIG_BOUNDS)) {
      const value = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
      expect(value, key).toBeGreaterThanOrEqual(bounds.min);
      expect(value, key).toBeLessThanOrEqual(bounds.max);
    }
  });
});
