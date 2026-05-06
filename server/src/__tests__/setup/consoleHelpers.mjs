/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

function createConsoleSpy(method, options = {}) {
  const { suppress = false } = options;
  const spy = jest.spyOn(console, method);
  if (suppress) {
    spy.mockImplementation(() => {});
  }
  return {
    spy,
    getMessages() {
      return spy.mock.calls.flat().join(' ');
    },
    restore() {
      spy.mockRestore();
    },
  };
}

function withConsoleSpy(method, options, fn) {
  const hasOptions = typeof options === 'object' && options !== null && !Array.isArray(options);
  const callback = typeof options === 'function' ? options : fn;
  const handle = createConsoleSpy(method, hasOptions ? options : {});
  return Promise.resolve()
    .then(() => callback(handle))
    .finally(() => handle.restore());
}

const consoleHelpers = {
  createConsoleSpy,
  withConsoleSpy,
};

export {
  createConsoleSpy,
  withConsoleSpy,
};

export default consoleHelpers;