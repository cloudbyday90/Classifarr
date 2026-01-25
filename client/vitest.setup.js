const setGlobalStorage = (key, value) => {
  try {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    })
  } catch {
    /* ignore setup errors */
  }
}

if (typeof window !== 'undefined') {
  setGlobalStorage('localStorage', window.localStorage)
  setGlobalStorage('sessionStorage', window.sessionStorage)
}
