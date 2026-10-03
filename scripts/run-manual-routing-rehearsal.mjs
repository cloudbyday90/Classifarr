/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runManualRoutingRehearsal } from './lib/manualRoutingRehearsal.mjs';

try {
  const [baselineFlag, baseline, candidateFlag, candidate, ...extra] = process.argv.slice(2);
  if (baselineFlag !== '--baseline' || candidateFlag !== '--candidate' || extra.length) throw new Error('routing_arguments_invalid');
  process.stdout.write(`ROUTING_REHEARSAL ${JSON.stringify(await runManualRoutingRehearsal({ baseline, candidate }))}\n`);
} catch (error) {
  // Assertion diffs and subprocess output can contain secrets; only fixed classifications escape.
  const reason = /^routing_[a-z_]+(?::[a-z0-9_-]+)?$/.test(error.message) ? error.message : 'routing_rehearsal_failed';
  process.stderr.write(`${reason}\n`); process.exitCode = 1;
}
