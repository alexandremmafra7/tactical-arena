/**
 * The one browser global the offline engine touches.
 *
 * Stubbed rather than pulling in a whole DOM: these tests are about the *shape* of what the engine returns,
 * and a real jsdom would be a dependency and a second of startup bought for nothing.
 */
const store = new Map<string, string>();

(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
};
