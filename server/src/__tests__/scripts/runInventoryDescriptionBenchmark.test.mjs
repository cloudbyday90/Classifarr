/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { createInventoryDiscoveryAdmission } from '../../services/inventoryDiscoveryAdmission.mjs';

const seed = 'benchmark-test-seed-2026';

test('CLI reports deferral without snapshot/model work or a misleading completed comparison', async () => {
  const instance = runtime();
  instance.withDiscoveryAdmission = createInventoryDiscoveryAdmission({ withSessionAdvisoryLock: async () => false });
  expect(await runInventoryDescriptionBenchmark({ argv: ['--seed', seed], loadRuntime: async () => instance }))
    .toEqual({ protocol: 'inventory_discovery_admission_v1', status: 'deferred', reason: 'busy', sourceVerified: false, livePromotionAllowed: false });
  expect(instance.repository.read).not.toHaveBeenCalled(); expect(instance.embedder.inspect).not.toHaveBeenCalled();
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(1);
});

test('multi-scale AI CLI validates before config, bounds inference, verifies source drift and closes', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--multi-scale-ai'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--size', '300', '--generate-cases', '101'],
    ...['--multi-scale-context', '--group-semantics', '--evidence-reranker', '--fresh-policy-evaluation', '--learned-profiles'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_multi_scale_ai_v1', status: 'preflight', sourceVerified: true, calls: 0 });
  expect(instance.createClient).not.toHaveBeenCalled();
  instance.client.generate.mockImplementation(async ({ onGenerationCall }) => {
    onGenerationCall(); return { response: '{"candidate":0}', latencyMs: 1, promptTokens: 100, outputTokens: 5 };
  });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv: [...argv, '--generate-cases', '2'], loadRuntime: async () => instance }))
    .toMatchObject({ status: 'complete', sourceVerified: true, changedSourceComponents: [], calls: 8,
      snapshotComponents: { version: 'inventory_multi_scale_ai_inputs_v1' } });
  expect(instance.createClient).toHaveBeenCalledTimes(1); expect(instance.close).toHaveBeenCalledTimes(2);
});

test.each(['documents', 'libraries', 'vectors', 'descriptions'])('paired AI still invalidates consumed %s drift', async component => {
  const instance = runtime(), snapshot = await instance.repository.read(), changed = structuredClone(snapshot);
  if (component === 'documents') changed.corpus.documents[0].libraryIds = [999];
  if (component === 'libraries') changed.libraries[0].media_type = 'changed';
  if (component === 'vectors') changed.vectors.values().next().value[0] += 0.01;
  if (component === 'descriptions') changed.corpus.texts.set(changed.corpus.documents[0].hash, 'changed description');
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce(changed);
  expect(await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '8', '--folds', '2', '--multi-scale-ai'],
    loadRuntime: async () => instance })).toMatchObject({ status: 'invalidated', sourceVerified: false,
    changedSourceComponents: [component], calls: 0 });
  expect(instance.close).toHaveBeenCalledTimes(1);
});

test('multi-scale context is exclusive, zero-generation, source-verified and closes after drift', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--multi-scale-context'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--generate-cases', '1'],
    ...['--local-communities', '--adaptive-groups', '--evidence-reranker', '--fresh-policy-evaluation'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_multi_scale_context_v1', status: 'complete', sourceVerified: true, calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false, changedSourceComponents: ['metadata'] });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('local communities require exclusive zero-generation folds and invalidate source drift', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--local-communities'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--generate-cases', '1'],
    ...['--adaptive-groups', '--group-semantics', '--semantic-pairs', '--evidence-reranker', '--fresh-policy-evaluation'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_local_communities_v1', status: 'complete', sourceVerified: true, changedSourceComponents: [], calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false, changedSourceComponents: ['metadata'] });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('adaptive groups require exclusive zero-generation folds and verify source drift without inference', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--adaptive-groups'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--generate-cases', '1'],
    ...['--candidate-local-evidence', '--group-contrast', '--group-semantics', '--semantic-pairs', '--evidence-reranker', '--fresh-policy-evaluation'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_adaptive_groups_v1', status: 'complete', sourceVerified: true, changedSourceComponents: [], calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false, changedSourceComponents: ['metadata'] });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('group-semantics CLI enforces grouped exclusive budgets, opt-in inference and source verification', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--group-semantics'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--size', '300', '--generate-cases', '101'],
    ...['--candidate-local-evidence', '--group-contrast', '--semantic-pairs', '--evidence-reranker', '--fresh-policy-evaluation'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_group_semantics_v1', status: 'preflight', sourceVerified: true, changedSourceComponents: [], calls: 0 });
  expect(instance.createClient).not.toHaveBeenCalled();
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv: [...argv, '--generate-cases', '1'], loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false, changedSourceComponents: ['metadata'] });
  expect(instance.createClient).toHaveBeenCalledTimes(1); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('group-contrast CLI requires exclusive zero-generation folds and verifies source freshness', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--group-contrast'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--generate-cases', '1'],
    ...['--candidate-local-evidence', '--candidate-stability', '--coverage-robustness', '--semantic-pairs', '--evidence-reranker'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow('exclusive_grouped_zero_generation');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_group_contrast_v1', status: 'complete', sourceVerified: true, calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('candidate-local CLI is exclusive, zero-generation and invalidates changed metadata', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--candidate-local-evidence'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--generate-cases', '1'],
    ...['--coverage-robustness', '--candidate-stability', '--semantic-pairs', '--evidence-reranker', '--fresh-policy-evaluation', '--investigate'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow('exclusive_grouped_zero_generation');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_candidate_local_evidence_v1', status: 'complete', sourceVerified: true, calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('independent candidate CLI is exclusive, zero-generation and source-verified after fitting', async () => {
  const argv = ['--seed', seed, '--size', '8', '--folds', '2', '--candidate-stability'], loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--generate-cases', '1'],
    ...['--coverage-robustness', '--semantic-pairs', '--evidence-reranker', '--fresh-policy-evaluation', '--investigate'].map(mode => [...argv, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow('candidate_stability_requires');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_candidate_stability_v1', status: 'complete', sourceVerified: true, calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot,
    libraries: snapshot.libraries.map(row => ({ ...row, name: 'Changed source' })) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('coverage robustness requires exclusive grouped zero-generation mode and verifies sources', async () => {
  const base = ['--seed', seed, '--size', '8', '--folds', '2', '--coverage-robustness'], loadRuntime = jest.fn();
  for (const argv of [base.filter(value => !['--folds', '2'].includes(value)), [...base, '--generate-cases', '1'],
    ...['--evidence-reranker', '--semantic-pairs', '--fresh-policy-evaluation', '--investigate'].map(mode => [...base, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow('coverage_benchmark_requires');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv: base, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_coverage_robustness_v2', status: 'complete', sourceVerified: true, calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot,
    libraries: snapshot.libraries.map(row => ({ ...row, name: 'Changed source' })) });
  expect(await runInventoryDescriptionBenchmark({ argv: base, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('stability CLI rejects missing groups before runtime, uses no generation and invalidates source drift', async () => {
  const base = ['--seed', seed, '--size', '10', '--folds', '5', '--representative-stability'], loadRuntime = jest.fn();
  for (const argv of [base, [...base, '--representative-groups'], [...base, '--representative-groups', '--evidence-reranker', '--generate-cases', '1']]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime(), argv = [...base, '--representative-groups', '--evidence-reranker'];
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_representative_stability_v1', status: 'complete', sourceVerified: true, calls: 0 });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance })).toMatchObject({ status: 'invalidated', sourceVerified: false });
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(2);
});

test('representative CLI rejects mixed/generation modes and retains source verification without a generation client', async () => {
  const base = ['--seed', seed, '--size', '10', '--folds', '5', '--representative-groups'], loadRuntime = jest.fn();
  for (const argv of [base, [...base, '--evidence-reranker', '--neighborhood-profiles'],
    [...base, '--evidence-reranker', '--generate-cases', '1'], [...base, '--evidence-reranker', '--semantic-pairs']]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime(), argv = [...base, '--evidence-reranker'];
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_representative_groups_v1', status: 'complete', sourceVerified: true, calls: 0 });
  expect(instance.createClient).not.toHaveBeenCalled();
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance })).toMatchObject({ status: 'invalidated', sourceVerified: false });
  expect(instance.close).toHaveBeenCalledTimes(2);
});

test('semantic pair CLI requires exclusive grouped mode and source verification, with explicit generation only', async () => {
  const args = ['--seed', seed, '--size', '10', '--folds', '5', '--semantic-pairs'], loadRuntime = jest.fn();
  for (const argv of [args.filter(value => !['--folds', '5'].includes(value)),
    ...['--evidence-reranker', '--neighborhood-profiles', '--fresh-policy-evaluation', '--learned-profiles', '--investigate'].map(mode => [...args, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow('exclusive_grouped');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  expect(await runInventoryDescriptionBenchmark({ argv: args, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_semantic_pairs_v1', status: 'preflight', sourceVerified: true, calls: 0 });
  expect(instance.createClient).not.toHaveBeenCalled();
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv: [...args, '--generate-cases', '1'], loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false });
  expect(instance.createClient).toHaveBeenCalledTimes(1);
  expect(instance.client.generate).not.toHaveBeenCalled();
  expect(instance.close).toHaveBeenCalledTimes(2);
});

test('neighborhood CLI requires grouped reranker mode and retains source verification and zero generation', async () => {
  const base = ['--seed', seed, '--size', '10', '--folds', '5', '--neighborhood-profiles'], loadRuntime = jest.fn();
  await expect(runInventoryDescriptionBenchmark({ argv: base, loadRuntime })).rejects.toThrow('requires_evidence_reranker');
  await expect(runInventoryDescriptionBenchmark({ argv: [...base, '--evidence-reranker', '--generate-cases', '1'], loadRuntime }))
    .rejects.toThrow('zero_generation');
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime(), argv = [...base, '--evidence-reranker'];
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ protocol: 'inventory_neighborhood_profile_v1', sourceVerified: true, calls: 0, selections: [] });
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, candidateMetadata: new Map([['movie:1', null]]) });
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false, livePromotionAllowed: false });
  expect(instance.close).toHaveBeenCalledTimes(2);
  expect(instance.createClient).not.toHaveBeenCalled();
});

test('learned evidence CLI rejects incompatible work before loading and checks source freshness afterwards', async () => {
  const args = ['--seed', seed, '--size', '10', '--folds', '5', '--evidence-reranker'];
  const loadRuntime = jest.fn();
  for (const argv of [args.filter(value => !['--folds', '5'].includes(value)), [...args, '--generate-cases', '1'],
    ...['--fresh-policy-evaluation', '--neighbor-calibration', '--learned-profiles', '--policy-shortlist-replay',
      '--neighbor-cross-fit', '--neighbor-fallback', '--investigate', '--contrastive-investigation',
      '--content-first-comparison', '--selective-recheck', '--preserve-description-candidate', '--metadata-candidates'].map(mode => [...args, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow('reranker_requires');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: args, loadRuntime: async () => instance });
  expect(report).toMatchObject({ protocol: 'inventory_evidence_reranker_v1', status: 'complete', sourceVerified: true, calls: 0 });
  expect(instance.repository.read).toHaveBeenCalledTimes(2);
  expect(instance.embedder.inspect).toHaveBeenCalledTimes(3);
  expect(instance.createClient).not.toHaveBeenCalled();
  expect(instance.close).toHaveBeenCalledTimes(1);
  const snapshot = await instance.repository.read();
  instance.repository.read.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot,
    libraries: snapshot.libraries.map(row => ({ ...row, name: 'Changed' })) });
  expect(await runInventoryDescriptionBenchmark({ argv: args, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false, livePromotionAllowed: false });
});

test('cross-fit CLI requires neighbor mode, rejects generation, and uses cached vectors without model generation', async () => {
  const base = ['--seed', seed, '--size', '10', '--folds', '5', '--neighbor-cross-fit'];
  const loadRuntime = jest.fn();
  await expect(runInventoryDescriptionBenchmark({ argv: base, loadRuntime })).rejects.toThrow('requires_neighbor_calibration');
  await expect(runInventoryDescriptionBenchmark({ argv: [...base, '--neighbor-calibration', '--generate-cases', '1'], loadRuntime })).rejects.toThrow('requires_exclusive');
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: [...base, '--neighbor-calibration'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ protocol: 'inventory_neighbor_comparison_v2', status: 'complete', calls: 0, evaluated: 10 });
  expect(report.arms).toHaveLength(7);
  expect(instance.embedder.inspect).toHaveBeenCalledTimes(2);
  expect(instance.createClient).not.toHaveBeenCalled();
  expect(instance.close).toHaveBeenCalledTimes(1);
});

test('neighbor calibration is an exclusive grouped zero-generation evaluation with redacted output', async () => {
  const args = ['--seed', seed, '--size', '10', '--folds', '5', '--neighbor-calibration'];
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: args, loadRuntime: async () => instance });
  expect(report).toMatchObject({ protocol: 'inventory_neighbor_comparison_v1', status: 'complete', calls: 0,
    sampledTitles: 10, evaluated: 10, noUniqueProposal: 10, independentLabels: 0, accuracy: null, livePromotionAllowed: false });
  expect(report.arms).toHaveLength(4);
  expect(JSON.stringify(report)).not.toMatch(/Private|libraryId|descriptionHash|tmdb|overview/);
  expect(instance.createClient).not.toHaveBeenCalled();
  expect(instance.embedder.inspect).toHaveBeenCalledTimes(2);
  expect(instance.close).toHaveBeenCalledTimes(1);
  const loadRuntime = jest.fn();
  for (const argv of [args.filter(value => !['--folds', '5'].includes(value)), [...args, '--generate-cases', '1'],
    ...['--fresh-policy-evaluation', '--policy-shortlist-replay', '--investigate', '--contrastive-investigation',
      '--content-first-comparison', '--selective-recheck', '--preserve-description-candidate', '--metadata-candidates', '--learned-profiles']
      .map(mode => [...args, mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow('neighbor_comparison_requires');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('content-first CLI preflights the frozen cohort, rejects mixed modes, and pairs every requested title', async () => {
  const instance = runtime();
  const args = ['--seed', seed, '--size', '10', '--folds', '5', '--content-first-comparison', '--learned-profiles'];
  const preflight = await runInventoryDescriptionBenchmark({ argv: args, loadRuntime: async () => instance });
  expect(preflight).toMatchObject({ protocol: 'content_first_library_comparison_v1', status: 'preflight', calls: 0,
    snapshotComponents: { counts: { documents: 20, vectors: 20 } } });
  expect(instance.createClient).not.toHaveBeenCalled();
  const report = await runInventoryDescriptionBenchmark({ argv: [...args, '--generate-cases', '10'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'complete', calls: 20, paired: { validPairs: 10 } });
  expect(instance.repository.read).toHaveBeenCalledTimes(2);
  expect(instance.close).toHaveBeenCalledTimes(2);
  const loadRuntime = jest.fn();
  for (const argv of [args.filter(value => !['--folds', '5'].includes(value)), [...args, '--investigate'], [...args, '--contrastive-investigation']]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow('requires_folds_and_exclusive_mode');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('contrastive mode uses grouped snapshots without calling the model during preflight', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--folds', '5', '--contrastive-investigation'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'preflight', protocol: 'contrastive_library_investigation_v1', calls: 0 });
  expect(instance.createClient).not.toHaveBeenCalled();
  const loadRuntime = jest.fn();
  for (const argv of [['--seed', seed, '--contrastive-investigation'],
    ['--seed', seed, '--folds', '5', '--contrastive-investigation', '--investigate']]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow('requires_folds_and_exclusive_mode');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('CLI grouped mode excludes successive cohorts only from test selection and keeps training coverage', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '5', '--exclude-prior-sizes', '5,5', '--folds', '5', '--learned-profiles'],
    loadRuntime: async () => instance });
  expect(report).toMatchObject({ excludedPriorDescriptions: 10, sampledTitles: 5,
    evaluation: { folds: 5, priorCohortSizes: [5, 5], previousSampleOverlap: 0, priorItemsAvailableForTraining: true } });
  expect(report.profileLearning.folds.every(fold => fold.missingOrConflictingMetadata === 19)).toBe(true);
  expect(instance.createClient).not.toHaveBeenCalled();
});

test('CLI can exclude a previous seeded sample before selection and training', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '5', '--exclude-prior-size', '10', '--learned-profiles'],
    loadRuntime: async () => instance });
  expect(report).toMatchObject({ excludedPriorDescriptions: 10, sampledTitles: 5, profileLearning: { missingOrConflictingMetadata: 5 } });
  expect(instance.createClient).not.toHaveBeenCalled();
});

test('learned profiles train automatically without names or declarations and report only coverage', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--learned-profiles'], loadRuntime: async () => instance });
  expect(report.profileLearning).toMatchObject({ version: 'contrastive_profile_v1', trainingDescriptions: 0, missingOrConflictingMetadata: 10 });
  expect(report.metadataSelection.version).toBe('contrastive_profile_v1');
  expect(JSON.stringify(report)).not.toMatch(/Private|counts|studio|rating/);
  const loadRuntime = jest.fn();
  await expect(runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--learned-profiles', '--metadata-candidates'], loadRuntime })).rejects.toThrow('mode_conflict');
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('metadata selection is explicit and reports aggregate coverage without exposing observations', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--metadata-candidates'], loadRuntime: async () => instance });
  expect(report.metadataSelection).toMatchObject({ version: 'metadata_rrf_v1', missingQueryMetadata: 10, changedShortlists: 0 });
  expect(JSON.stringify(report)).not.toMatch(/Private|genres|studio|rating/);
  expect(instance.createClient).not.toHaveBeenCalled();
});
function runtime() {
  const identity = { provider: 'ollama', model: 'local:latest', digest: 'a'.repeat(64), dimensions: 2 };
  const corpus = prepareInventoryDescriptionCorpus(Array.from({ length: 20 }, (_, index) => ({ tmdb_id: index + 1,
    media_type: 'movie', library_id: index % 2 + 1, overview: `Private text ${index}` })));
  const snapshot = { corpus, vectors: new Map([...corpus.texts.keys()].map(hash => [hash, [1, 0]])),
    libraries: [1, 2].map(id => ({ id, name: `Private library ${id}`, media_type: 'movie' })) };
  const client = { inspect: jest.fn(async () => ({ model: 'local:latest', digest: 'b'.repeat(64), contextLength: 32768 })),
    generate: jest.fn(async () => ({ response: '{"candidate":1}', latencyMs: 1, promptTokens: 100, outputTokens: 5 })) };
  return { embedder: { ...identity, inspect: jest.fn(async () => identity) }, repository: { read: jest.fn(async () => snapshot) },
    withDiscoveryAdmission: jest.fn((callback, { signal }) => callback(signal)),
    createClient: jest.fn(() => client), close: jest.fn(), client };
}

test('description-preserving CLI validates grouped profiles before loading and supports a no-inference comparison', async () => {
  const loadRuntime = jest.fn(), base = ['--seed', seed, '--preserve-description-candidate'];
  for (const args of [[], ['--folds', '5'], ['--learned-profiles']]) {
    await expect(runInventoryDescriptionBenchmark({ argv: [...base, ...args], loadRuntime })).rejects.toThrow('description_anchor_requires');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({
    argv: [...base, '--size', '10', '--folds', '5', '--learned-profiles', '--content-first-comparison'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'preflight', calls: 0,
    metadataSelection: { descriptionAnchor: { requested: 10, changedShortlists: 0 } }, snapshotComponents: { counts: { documents: 20 } } });
  expect(instance.createClient).not.toHaveBeenCalled();
  expect(instance.close).toHaveBeenCalledTimes(1);
});

test('selective CLI requires exclusive grouped learned profiles and reports actual calls separately', async () => {
  const base = ['--seed', seed, '--selective-recheck'];
  const loadRuntime = jest.fn();
  for (const args of [[], ['--folds', '5'], ['--learned-profiles'],
    ...['--content-first-comparison', '--contrastive-investigation', '--investigate']
      .map(mode => ['--folds', '5', '--learned-profiles', mode])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: [...base, ...args], loadRuntime })).rejects.toThrow('selective_recheck_requires');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const instance = runtime();
  const argv = [...base, '--folds', '5', '--learned-profiles', '--size', '10'];
  const preflight = await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance });
  expect(preflight).toMatchObject({ status: 'preflight', calls: 0, selection: { evaluated: 0, triggered: 0 } });
  expect(instance.createClient).not.toHaveBeenCalled();
  const report = await runInventoryDescriptionBenchmark({ argv: [...argv, '--generate-cases', '2'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ protocol: 'selective_inventory_recheck_v1', status: 'complete', calls: 2,
    selection: { evaluated: 2, triggered: 0, accepted: 0, reasons: { evidence_incomplete: 2 } } });
  expect(instance.client.generate).toHaveBeenCalledTimes(2);
  expect(instance.close).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(report)).not.toMatch(/Private|observedLibraryIds|conflictEvidence/);
});

test('preflight loads one snapshot, verifies representation, closes, and never generates', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'preflight', sampledTitles: 10, embedding: { dimensions: 2 } });
  expect(instance.embedder.inspect).toHaveBeenCalledTimes(2);
  expect(instance.repository.read).toHaveBeenCalledTimes(1);
  expect(instance.createClient).not.toHaveBeenCalled();
  expect(instance.close).toHaveBeenCalledTimes(1);
});

test('generation is explicit and separate from sampled/held-out title count', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--generate-cases', '2', '--context', '16384', '--max-minutes', '1'],
    loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'complete', sampledTitles: 10, requestedGenerationCases: 2, generation: { context: 16384 } });
  expect(instance.client.generate).toHaveBeenCalledTimes(6);
  expect(instance.close).toHaveBeenCalledTimes(1);
});

test('rejects malformed/unknown arguments before loading configuration', async () => {
  const loadRuntime = jest.fn();
  for (const argv of [[], ['--seed', seed, '--size', '301'], ['--seed', seed, '--context', 'NaN'], ['--seed', seed, '--url', 'https://example.com'],
    ['--seed', seed, '--folds', '1'], ['--seed', seed, '--exclude-prior-sizes', '100,,200'],
    ['--seed', seed, '--exclude-prior-size', '100', '--exclude-prior-sizes', '200']]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('investigation is opt-in, runs after benchmark arms, and keeps private evidence out of output', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--generate-cases', '2', '--investigate'], loadRuntime: async () => instance });
  expect(report.investigation).toMatchObject({ comparisonsNotRun: 8, verifiedLabelsCreated: 0, userQuestionsCreated: 0 });
  expect(report.arms.every(arm => arm.finished === 2)).toBe(true);
  expect(JSON.stringify(report)).not.toContain('Private');
});

test('snapshot failures and model replacement close the runtime and do not send query text', async () => {
  const instance = runtime();
  instance.repository.read.mockRejectedValueOnce(new Error('private failure'));
  await expect(runInventoryDescriptionBenchmark({ argv: ['--seed', seed], loadRuntime: async () => instance })).rejects.toThrow();
  instance.embedder.inspect.mockResolvedValueOnce({ ...instance.embedder, digest: 'a'.repeat(64) })
    .mockResolvedValueOnce({ ...instance.embedder, digest: 'b'.repeat(64) });
  await expect(runInventoryDescriptionBenchmark({ argv: ['--seed', seed], loadRuntime: async () => instance })).rejects.toThrow('model_changed');
  expect(instance.close).toHaveBeenCalledTimes(2);
  expect(instance.createClient).not.toHaveBeenCalled();
});
