/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { selectLibraryWithheldProbes, assessLibraryWithheldProbe, buildLibraryWithheldProbeReport } from '../../services/inventoryLibraryWithheldProbes.mjs';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { prepareLeaderChallengeEvidence } from '../../services/inventoryLeaderChallengeEvidence.mjs';
import { prepareMatchCalibrationCorpus } from '../../services/inventoryMatchCalibrationCorpus.mjs';
import { createExactNeighborCalibration } from '../../services/inventoryExactNeighborCalibration.mjs';

test('selection is outcome-free, balanced, bounded, exclusive and uses one fold per library', () => {
  const docs = Array.from({ length: 360 }, (_, index) => ({ id: index + 1, type: index % 2 ? 'tv' : 'movie', hash: String(index), libraryIds: [index % 40 + 1] }));
  const folds = new Map(docs.map((doc, index) => [doc.hash, Math.floor(index / 40) % 3]));
  docs.push({ ...docs[0], id: 999, libraryIds: [2] });
  const probes = selectLibraryWithheldProbes(docs, docs.slice(0, 360), folds);
  expect(probes).toHaveLength(30);
  expect(probes.some(probe => probe.doc.hash === '0')).toBe(false);
  for (const id of new Set(probes.map(probe => probe.omittedLibraryId))) {
    const rows = probes.filter(probe => probe.omittedLibraryId === id);
    expect(rows.length).toBeLessThanOrEqual(3); expect(new Set(rows.map(row => row.fold)).size).toBe(1);
  }
  expect(selectLibraryWithheldProbes([], [], new Map())).toEqual([]);
});

test('reports support, abstention and unavailable evidence separately, without pretending there are semantic labels', () => {
  const contextId = 'a'.repeat(64), calibration = { contextId,
    crossFitMatch: { contextId, candidates: [{ libraryId: 2, status: 'familiar' }, { libraryId: 3, status: 'unusual' }] },
    exactNeighbor: { contextId, status: 'evaluated', candidates: [{ libraryId: 2, status: 'available', referenceComplete: true, calibrated: true },
      { libraryId: 3, status: 'available', referenceComplete: true, calibrated: false }] } };
  expect(assessLibraryWithheldProbe(calibration, 1)).toEqual({ status: 'supported_elsewhere', supported: 1 });
  calibration.exactNeighbor.candidates[0].calibrated = false;
  expect(assessLibraryWithheldProbe(calibration, 1).status).toBe('familiar_not_distinct');
  calibration.crossFitMatch.candidates[0].status = 'unusual';
  expect(assessLibraryWithheldProbe(calibration, 1).status).toBe('no_familiar_library');
  calibration.exactNeighbor.candidates[0].status = 'sparse';
  expect(assessLibraryWithheldProbe(calibration, 1).status).toBe('unavailable');
  expect(() => assessLibraryWithheldProbe(calibration, 2)).toThrow('context_invalid');
  calibration.exactNeighbor.contextId = 'b'.repeat(64);
  expect(() => assessLibraryWithheldProbe(calibration, 1)).toThrow('context_invalid');
  const rows = ['supported_elsewhere', 'unavailable', 'familiar_not_distinct', 'no_familiar_library']
    .map(status => ({ status, omittedLibraryId: 1, mediaType: 'movie' }));
  const report = buildLibraryWithheldProbeReport(rows, [{ id: 1, media_type: 'movie', name: 'Private' }]);
  expect(report).toMatchObject({ sampled: 4, supportedElsewhere: 1, unavailable: 1, familiarNotDistinct: 1, noFamiliarLibrary: 1,
    semanticGroundTruth: false, falseAcceptanceRate: null });
  expect(JSON.stringify(report)).not.toMatch(/Private|libraryId|omittedLibraryId|description/);
});

test('omission refits margin distributions and never uses the withheld library as a reference or candidate', async () => {
  const { source } = freshFixture(360), representation = { provider: 'ollama', model: 'embedding:latest', digest: 'b'.repeat(64), dimensions: 2 };
  source.trainingExclusions = new Set();
  const prepared = await prepareLeaderChallengeEvidence(source, representation, { ...freshSettings, size: 30, generateCases: 0 });
  const { doc, omittedLibraryId } = prepared.withheldLibraryProbes[0], entry = await prepared.forDocument(doc);
  const ordinary = await prepared.calibrate(entry);
  const withheld = await prepared.calibrate(entry, { omittedLibraryId });
  expect(withheld.contextId).not.toBe(ordinary.contextId);
  expect(withheld.exactNeighbor.snapshotId).not.toBe(ordinary.exactNeighbor.snapshotId);
  expect(withheld.crossFitMatch.candidates.some(row => row.libraryId === omittedLibraryId)).toBe(false);
  expect(withheld.exactNeighbor.candidates.some(row => row.libraryId === omittedLibraryId)).toBe(false);
  // Changing only omitted-library vectors cannot change any remaining candidate's outcome.
  const input = { documents: source.corpus.documents, libraries: source.libraries, vectors: new Map(source.vectors), representation };
  for (const item of input.documents.filter(item => item.libraryIds.includes(omittedLibraryId) && item.hash !== doc.hash)) input.vectors.set(item.hash, [0, -1]);
  const independent = createExactNeighborCalibration(prepareMatchCalibrationCorpus(input));
  const held = new Set(entry.heldDescriptionHashes);
  const rechecked = await independent.assess({ ...entry, heldDescriptionHashes: held }, { omittedLibraryId });
  expect(rechecked.candidates).toEqual(withheld.exactNeighbor.candidates);
  expect((await prepared.calibrate(entry)).exactNeighbor.candidates).toEqual(ordinary.exactNeighbor.candidates);
  expect(await prepared.calibrate(entry, { omittedLibraryId })).toMatchObject({ contextId: withheld.contextId });
});
