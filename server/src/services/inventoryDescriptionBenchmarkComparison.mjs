/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildDescriptionBenchmarkPrompt, parseDescriptionBenchmarkProposal } from './inventoryDescriptionBenchmarkPrompt.mjs';

export const isValidDescriptionComparison = result => ['proposed', 'abstained'].includes(result?.status);

/** Private result; callers publish aggregate summaries, never this destination ID. */
export async function compareInventoryDescription(entry, texts,
  { client, identity, context, signal, anonymousLibraries = false, onCall = () => {} }) {
  const packet = buildDescriptionBenchmarkPrompt(entry, texts, 9, { anonymousLibraries });
  if (packet.actualExamples === 0) return { status: 'evidence_unavailable' };
  onCall();
  try {
    const result = await client.generate({ prompt: packet.prompt, count: entry.candidates.length, context, identity, signal });
    const proposal = parseDescriptionBenchmarkProposal(result.response, entry.candidates.length);
    const status = result.outputLimitReached || result.contextLimitSuspected || proposal === null ? 'invalid_or_limited'
      : proposal === 0 ? 'abstained' : 'proposed';
    const destinationId = status === 'proposed' ? entry.candidates[proposal - 1].id : null;
    return { status, destinationId, agreement: destinationId !== null && entry.observedLibraryIds.includes(destinationId),
      latencyMs: result.latencyMs, promptTokens: result.promptTokens };
  } catch (error) { return { status: error?.message === 'description_benchmark_context_budget' ? 'context_budget' : 'failed' }; }
}

const numericSummary = values => ({ count: values.length,
  mean: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null });

export function summarizeDescriptionComparisons(results) {
  const valid = results.filter(isValidDescriptionComparison);
  return { finished: results.length, valid: valid.length, agreed: valid.filter(result => result.agreement).length,
    statuses: Object.fromEntries(['proposed', 'abstained', 'invalid_or_limited', 'failed', 'context_budget', 'evidence_unavailable']
      .map(status => [status, results.filter(result => result.status === status).length])),
    latencyMs: numericSummary(results.flatMap(result => Number.isFinite(result.latencyMs) ? [result.latencyMs] : [])),
    promptTokens: numericSummary(results.flatMap(result => Number.isFinite(result.promptTokens) ? [result.promptTokens] : [])) };
}
