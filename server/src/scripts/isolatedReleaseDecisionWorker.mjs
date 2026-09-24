/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fileURLToPath } from 'node:url';
import { createIsolatedFrozenPolicyScorer } from '../services/isolatedFrozenPolicyScoring.mjs';
import { validateFrozenPolicyWorkerInput } from '../services/operatorCorrectionFrozenPolicyInput.mjs';
import { validateFrozenInventoryWorkerInput } from '../services/operatorCorrectionFrozenInventoryInput.mjs';

const modules = Object.freeze({
  baseline: 'file:///app/release/server/src/services/policyEngineEvaluation.mjs',
  candidate: 'file:///app/current/src/services/policyEngineEvaluation.mjs',
});

function readInput() {
  return new Promise((resolve, reject) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      text += chunk;
      if (text.length > 8_000_000) reject(new Error('worker_input_too_large'));
    });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(text)); } catch { reject(new Error('worker_input_invalid')); }
    });
    process.stdin.on('error', reject);
  });
}

function disposition(result, index) {
  const id = result.topCandidate?.library_id ?? result.library?.library_id;
  if (result.action === 'auto_classify' && Number.isSafeInteger(id) && id > 0) {
    return { index, statusId: 'destination', destinationLibraryId: id };
  }
  if (['prompt_confirm', 'prompt_select'].includes(result.action)) {
    return { index, statusId: 'safety_blocked', destinationLibraryId: null };
  }
  return { index, statusId: 'abstained', destinationLibraryId: null };
}

async function runScoreOnlyWorker({ role, input, loadEvaluator }) {
  if (input?.version !== 1 || !Array.isArray(input.cases) ||
      input.cases.length < 1 || input.cases.length > 300) throw new Error('worker_contract_invalid');
  const { evaluateItem } = await loadEvaluator(modules[role]);
  const cases = [];
  for (const [index, row] of input.cases.entries()) {
    if (!['movie', 'tv'].includes(row.mediaType) || !Array.isArray(row.candidates)) {
      throw new Error('worker_case_invalid');
    }
    const policies = row.candidates.map(candidate => ({ id: candidate.policyId,
      name: `Policy ${candidate.policyId}`, library_id: candidate.libraryId,
      library_name: `Library ${candidate.libraryId}`, library_media_type: row.mediaType,
      auto_classify_threshold: candidate.autoThreshold, prompt_threshold: candidate.promptThreshold,
      trust_rag: false, trust_patterns: false, trust_history: false, presets: [] }));
    const evaluations = row.candidates.map(candidate => ({ policy_id: candidate.policyId,
      policy_name: `Policy ${candidate.policyId}`, library_id: candidate.libraryId,
      library_name: `Library ${candidate.libraryId}`, score: candidate.score,
      candidate_diagnostics: { primary_viability: candidate.viability, evidence_class: candidate.viability },
      auto_classify_threshold: candidate.autoThreshold, prompt_threshold: candidate.promptThreshold }));
    try {
      const result = await evaluateItem({ title: 'Private case', media_type: row.mediaType },
        { ragCache: { matches: [], timestamp: 1 }, relatedEvidence: [] }, {
          checkAuthoritativeSignals: async () => null,
          getActivePolicies: async () => policies,
          evaluatePolicy: async policy => evaluations.find(value => value.policy_id === policy.id),
          ...(role === 'candidate' ? { applyInventoryEvidence: ({ evaluations: values }) => values } : {}),
        });
      cases.push(disposition(result, index));
    } catch {
      cases.push({ index, statusId: 'failed', destinationLibraryId: null });
    }
  }
  return { version: 1, role, cases };
}

async function runFrozenEvidenceWorker({ role, input, loadScorer }) {
  if (input.version === 3) validateFrozenInventoryWorkerInput(input);
  else validateFrozenPolicyWorkerInput(input);
  const score = await loadScorer(role);
  const folds = new Map(input.folds.map(fold => [`${fold.foldIndex}:${fold.mediaType}`, fold]));
  const cases = [];
  for (const [index, row] of input.cases.entries()) {
    const fold = folds.get(`${row.foldIndex}:${row.mediaType}`);
    if (!fold || row.metadata?.media_type !== row.mediaType || Object.hasOwn(row, 'labelLibraryId')) {
      throw new Error('worker_case_invalid');
    }
    try {
      let inventoryStatusId = role === 'baseline' ? 'not_applicable' : 'not_requested';
      const outcome = disposition(await score({ metadata: row.metadata, policies: input.policies,
        profiles: fold.profiles, ...(input.version === 3 ? { inventory: row.inventory,
          onInventoryStatus: value => { inventoryStatusId = value; } } : {}) }), index);
      cases.push(input.version === 3 ? { ...outcome, inventoryStatusId } : outcome);
    } catch {
      const failed = { index, statusId: 'failed', destinationLibraryId: null };
      cases.push(input.version === 3 ? { ...failed, inventoryStatusId: 'failed' } : failed);
    }
  }
  return { version: 1, role, cases };
}

export async function runIsolatedReleaseDecisionWorker({ role, input, loadEvaluator = path => import(path),
  loadScorer = createIsolatedFrozenPolicyScorer }) {
  if (!Object.hasOwn(modules, role)) throw new Error('worker_role_invalid');
  return [2, 3].includes(input?.version) ? runFrozenEvidenceWorker({ role, input, loadScorer })
    : runScoreOnlyWorker({ role, input, loadEvaluator });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const role = process.argv[2];
  readInput().then(input => runIsolatedReleaseDecisionWorker({ role, input }))
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => { process.stderr.write('Isolated decision worker failed.\n'); process.exitCode = 1; });
}
