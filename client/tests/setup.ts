import "@testing-library/jest-dom";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.has(key) ? this.values.get(key)! : null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(String(key), String(value)); }
}

const stableLocalStorage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: stableLocalStorage });
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", { configurable: true, value: stableLocalStorage });
}
