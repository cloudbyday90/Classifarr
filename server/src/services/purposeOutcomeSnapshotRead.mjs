/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readPurposeOutcomeSnapshotInput } from './purposeOutcomeSnapshotInput.mjs';
import { readPurposePolicyContextInputs } from './purposePolicyContextRepository.mjs';

/** One bounded frozen input for aggregate and private case consumers; projection performs no further reads. */
export async function withPurposeOutcomeSnapshot(runtime, { signal, includePolicyContext = false } = {}, project) {
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, abort);
  try {
    const input = await runtime.withTransaction(async client => {
      const { input, sourceBytes } = await readPurposeOutcomeSnapshotInput(client, controller.signal);
      if (includePolicyContext) input.policyContextInputs = await readPurposePolicyContextInputs(client, input, sourceBytes);
      controller.signal.throwIfAborted(); return input;
    }, { signal: controller.signal, readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 15000 });
    controller.signal.throwIfAborted(); return project(input);
  } finally {
    signal?.removeEventListener('abort', abort);
    for (const name of ['SIGINT', 'SIGTERM']) process.removeListener(name, abort);
  }
}
