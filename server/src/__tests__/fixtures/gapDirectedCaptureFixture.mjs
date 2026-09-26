/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { adjudicationDigest } from '../../services/cachedAdjudicationContract.mjs';
import { replayCachedAdjudication } from '../../services/cachedAdjudicationReplay.mjs';

export const syntheticCaptureIdentity = { model: 'test:latest', digest: 'b'.repeat(64), contextLength: 8192 };
export const syntheticCaptureResponse = (response = 'valid') => ({ response, latencyMs: 1, promptTokens: 100, outputTokens: 10,
  outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' });

/** Scheduling benchmark only: synthetic policy outcomes and reducer, not classifier accuracy. */
export function gapDirectedCaptureFixture(count = 300) {
  const libraries = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name: `PRIVATE ${i}`, media_type: i % 2 ? 'tv' : 'movie' }));
  const source = { libraries, adjudicationConfig: { fingerprint: 'a'.repeat(64), promptConfig: {} },
    corpus: { documents: [] }, adjudicationSelectionOffset: 0 };
  const outcomes = [new Map(), new Map()];
  for (let index = 0; index < count; index++) {
    const mediaType = index % 2 ? 'tv' : 'movie', key = `${mediaType}:${index}`, library = libraries[index % 4];
    source.corpus.documents.push({ key, libraryIds: [library.id] });
    for (const [arm, rows] of outcomes.entries()) {
      const automatic = arm === 0 && index % 25 >= 10 && index % 25 < 20;
      rows.set(String(index).padStart(3, '0'), { key, mediaType, runtime: { metadata: { index, arm, mediaType } },
        outcome: automatic ? { kind: 'automatic', action: 'auto_classify', destination: String(library.id) } : { kind: 'review' },
        common: automatic ? { mode: 'skip', policyResult: { action: 'auto_classify', library } }
          : { mode: arm === 0 && index % 25 >= 20 && index % 25 < 23 ? 'none' : 'adjudicate', policyResult: {} } });
    }
  }
  const batch = records => ({ version: 'cached_adjudication.v1', configuration: source.adjudicationConfig.fingerprint,
    identity: syntheticCaptureIdentity, records });
  async function replay(records = [], corrections = new Map()) {
    let plan, captureAdmission;
    source.adjudicationBatch = batch(records);
    const report = await replayCachedAdjudication(outcomes, corrections, source, {
      prepare: async ({ metadata }) => ({ status: 'ready', arms: { protected: {
        prompt: `PRIVATE request ${metadata.index} ${metadata.arm}`,
        contract: { candidates: libraries.filter(library => library.media_type === metadata.mediaType).map(library => ({ libraryId: library.id })) },
      } } }),
      reduce: (_entry, _arm, generated) => ({ status: generated.response === 'valid' ? 'abstained' : 'invalid' }),
      onPlan: value => { plan = value; }, onAdmission: value => { captureAdmission = value; },
    });
    return { plan, captureAdmission, report };
  }
  return { source, outcomes, replay, batch, digest: adjudicationDigest };
}
