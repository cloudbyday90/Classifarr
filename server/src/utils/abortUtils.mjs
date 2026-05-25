export function checkAbort(signal, operation = 'operation') {
  if (signal?.aborted) {
    const error = new Error(`${operation} aborted`);
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    throw error;
  }
}
