/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';

/** Drain bounded output without retaining secrets; completion includes stream closure. */
export function observeEmbeddedMaintenance(child, request = null) {
  const observed = observeEmbeddedChild(child);
  const closed = new Promise(resolve => { child.once('close', resolve); });
  let rejected = false;
  let bytes = 0;
  const reject = () => { rejected = true; observed.signal('SIGKILL'); };
  const discard = chunk => { bytes += chunk.length; if (bytes > 64 * 1024) reject(); };
  child.stdout.on('data', discard);
  child.stderr.on('data', discard);
  child.stdout.on('error', reject);
  child.stderr.on('error', reject);
  child.stdin.on('error', reject);
  child.stdin.end(request);
  return { ...observed, done: Promise.all([observed.done, closed])
    .then(([result]) => rejected ? { code: 1, signal: result.signal } : result) };
}
