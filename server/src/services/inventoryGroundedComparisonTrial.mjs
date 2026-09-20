/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseSemanticComparisonResponse } from './inventorySemanticComparisonContract.mjs';
import { parseGroundedComparisonResponse } from './inventoryGroundedComparisonContract.mjs';

/** Five fixed calls: preceding control x2, grounded original/repeat/reversal. No repair. */
export async function runGroundedComparisonTrial(row, { client, identity, options, signal, onGenerationCall, usage, checkpoint }) {
  const control = [], grounded = [];
  for (const [index, prompt] of row.prompts.entries()) {
    checkpoint(); signal?.throwIfAborted();
    const result = await client.generate({ prompt, count: row.plan.candidates.length, context: options.context,
      identity, signal, responseContract: index < 2 ? 'library_comparison' : 'grounded_comparison', onGenerationCall });
    signal?.throwIfAborted();
    for (const field of Object.keys(usage)) usage[field] += result[field];
    checkpoint();
    if (result.outputLimitReached || result.contextLimitSuspected) {
      row.status = result.outputLimitReached ? 'output_limit' : 'context_limit'; return false;
    }
    if (index < 2) {
      const selected = parseSemanticComparisonResponse(result.response, row.plan.candidates.length);
      if (selected === null) { row.status = 'invalid_response'; return false; }
      const candidates = index ? [...row.plan.candidates].reverse() : row.plan.candidates;
      control.push(selected === 0 ? null : candidates[selected - 1].id);
    } else {
      const parsed = parseGroundedComparisonResponse(result.response, row.plan, index === 4);
      if (!parsed) { row.status = 'invalid_response'; return false; }
      grounded.push(parsed);
    }
  }
  const [original, repeated, reversed] = grounded;
  const repeatDecisionChanged = original.selected !== repeated.selected;
  const reorderDecisionChanged = original.selected !== reversed.selected;
  const repeatEvidenceChanged = JSON.stringify(original.grades) !== JSON.stringify(repeated.grades);
  const reorderEvidenceChanged = JSON.stringify(original.grades) !== JSON.stringify(reversed.grades);
  const unstable = repeatDecisionChanged || reorderDecisionChanged || repeatEvidenceChanged || reorderEvidenceChanged;
  row.status = unstable ? 'unstable_assessment' : original.selected === null ? 'abstained' : 'supported';
  row.before = row.observed.includes(row.baselineId); row.after = row.observed.includes(original.selected);
  row.grounding = { repeatDecisionChanged, reorderDecisionChanged, repeatEvidenceChanged, reorderEvidenceChanged,
    controlStatus: control[0] !== control[1] ? 'order_sensitive' : control[0] === null ? 'abstained' : 'supported',
    controlAgrees: row.observed.includes(control[0]), abstentionReason: row.status === 'abstained' ? original.reason : null,
    candidateAssessments: grounded.reduce((sum, pass) => sum + pass.grades.length, 0),
    insufficientAssessments: grounded.flatMap(pass => pass.grades).filter(grade => grade.fit === 0).length,
    contradictedAssessments: grounded.flatMap(pass => pass.grades).filter(grade => grade.fit === 1).length,
    supportedAssessments: grounded.flatMap(pass => pass.grades).filter(grade => grade.fit === 2).length };
  return true;
}
