/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createRequestCancellation } from '../utils/requestCancellation.mjs';

afterEach(() => jest.restoreAllMocks());

test.each([undefined, null])('retains timeout-only behavior for signal %s', callerSignal => {
  const deadline = new AbortController();
  jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  const request = createRequestCancellation(100, callerSignal);
  expect(() => request.throwIfAborted()).not.toThrow();
  deadline.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  expect(request.signal.aborted).toBe(true);
  expect(request.throwIfAborted).toThrow(expect.objectContaining({ code: 'ETIMEDOUT' }));
});

test.each([true, false])('keeps the first abort source when both abort; deadline first: %s', deadlineFirst => {
  const deadline = new AbortController();
  const caller = new AbortController();
  jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  const request = createRequestCancellation(100, caller.signal);
  // Fetch observes the composed signal while a request is active.
  request.signal.addEventListener('abort', () => {}, { once: true });
  const expire = () => deadline.abort(new DOMException('deadline expired', 'TimeoutError'));
  const cancel = () => caller.abort(new DOMException('private timeout reason', 'TimeoutError'));
  if (deadlineFirst) { expire(); cancel(); } else { cancel(); expire(); }
  expect(request.throwIfAborted).toThrow(expect.objectContaining({
    code: deadlineFirst ? 'ETIMEDOUT' : 'ABORT_ERR',
  }));
  if (!deadlineFirst) {
    try { request.throwIfAborted(); } catch (error) {
      expect(error.message).toBe('Request cancelled');
      expect(error.cause).toBeUndefined();
    }
  }
});

test.each([undefined, null, 'private reason', new Error('private error'),
  { token: 'private token' }, new DOMException('private timeout', 'TimeoutError')])(
  'normalizes pre-aborted custom reasons without retaining them: %p', reason => {
    const caller = new AbortController();
    caller.abort(reason);
    expect(() => createRequestCancellation(100, caller.signal)).toThrow(expect.objectContaining({
      name: 'AbortError', code: 'ABORT_ERR', message: 'Request cancelled',
    }));
  },
);

test.each([{}, false, 'signal'])('rejects an invalid non-null signal: %p', signal => {
  expect(() => createRequestCancellation(100, signal)).toThrow(expect.objectContaining({ name: 'TypeError' }));
});
