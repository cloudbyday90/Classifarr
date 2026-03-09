class MemoryStorage {
  constructor() { this._store = Object.create(null) }
  get length() { return Object.keys(this._store).length }
  key(index) { return Object.keys(this._store)[index] ?? null }
  getItem(key) { return key in this._store ? this._store[key] : null }
  setItem(key, value) { this._store[String(key)] = String(value) }
  removeItem(key) { delete this._store[key] }
  clear() { this._store = Object.create(null) }
}

const defineStorage = (name, impl) => {
  try {
    Object.defineProperty(globalThis, name, { value: impl, configurable: true, writable: true })
  } catch { /* ignore */ }
}

defineStorage('localStorage', new MemoryStorage())
defineStorage('sessionStorage', new MemoryStorage())
