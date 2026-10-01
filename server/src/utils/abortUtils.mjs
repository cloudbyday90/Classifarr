export function checkAbort(signal, operation = 'operation') {
  if (signal?.aborted) {
    const error = Object.assign(new Error(`${operation} aborted`), { name: 'AbortError', code: 'ABORT_ERR' });
    throw error;
  }
}
