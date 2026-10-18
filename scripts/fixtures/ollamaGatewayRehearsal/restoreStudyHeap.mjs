/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Session } from 'node:inspector/promises';

function component({ url = '' } = {}) {
  if (typeof url !== 'string') return null;
  if (url.includes('/node_modules/pg-protocol/')) return 'database_transport';
  if (url.includes('/node_modules/pg/')) return 'database_client';
  const groups = {
    catalog_hash: ['catalogContent','catalogRowReader'], archive_hash: ['archiveContent'],
    dependencies: ['catalogDependencies','catalogRecoveryFiles','archiveRetentionVerification'],
    private_copy: ['archiveRestoreInput'], file_validation: ['archiveFiles','archiveManagedFiles'],
    restore_control: ['archiveVerifier','catalogRestore','catalogAdmissionRestore','catalogRelationships'],
  };
  for (const [label, files] of Object.entries(groups)) if (files.some(file => url.endsWith(`/ollamaGateway/${file}.mjs`))) return label;
  return url.includes('/fixtures/restoreStudy') ? 'diagnostic' : null;
}
export function requireRestoreHeapSummary(value) {
  const labels = ['other','database_transport','database_client','catalog_hash','archive_hash','dependencies',
    'private_copy','file_validation','restore_control','diagnostic'];
  if (!value || value.samplingInterval !== 524288 || !Number.isSafeInteger(value.sampledEstimatedBytes) || value.sampledEstimatedBytes <= 0 ||
      !Number.isInteger(value.samples) || value.samples < 1 || value.samples > 200000 ||
      !Number.isInteger(value.nodes) || value.nodes < 1 || value.nodes > 50000 || !value.components ||
      Object.keys(value.components).some(key => !labels.includes(key)) || Object.values(value.components).some(value =>
        !Number.isSafeInteger(value) || value < 0) ||
      Object.values(value.components).reduce((sum, value) => sum + value, 0) !== value.sampledEstimatedBytes) {
    throw new Error('restore_study_profile_invalid');
  }
  return value;
}
export function summarizeRestoreHeap(profile) {
  const invalid = () => { throw new Error('restore_study_profile_invalid'); };
  if (!profile?.head || !Array.isArray(profile.samples) || profile.samples.length > 200000) invalid();
  const pending = [{ node: profile.head, label: 'other', depth: 0 }], seen = new Set(), components = {};
  let sampledEstimatedBytes = 0;
  while (pending.length) {
    const { node, label, depth } = pending.pop();
    if (!node || seen.has(node) || seen.size >= 50000 || depth > 64 ||
        !Number.isSafeInteger(node.selfSize) || node.selfSize < 0 || !Array.isArray(node.children) ||
        node.children.length + pending.length + seen.size > 50000) invalid();
    seen.add(node); const current = component(node.callFrame) ?? label;
    sampledEstimatedBytes += node.selfSize;
    if (!Number.isSafeInteger(sampledEstimatedBytes)) invalid();
    if (node.selfSize) components[current] = (components[current] ?? 0) + node.selfSize;
    for (const child of node.children) pending.push({ node: child, label: current, depth: depth + 1 });
  }
  return { samplingInterval: 524288, sampledEstimatedBytes, nodes: seen.size, samples: profile.samples.length, components };
}
/** Local synthetic inspector session only. Never start a listener or emit a raw profile. */
export async function sampleRestoreAllocations(work, { session = new Session() } = {}) {
  let sampling = false;
  try {
    session.connect();
    await session.post('HeapProfiler.startSampling', { samplingInterval: 524288, stackDepth: 64,
      includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    sampling = true; const value = await work();
    const { profile } = await session.post('HeapProfiler.stopSampling'); sampling = false;
    return { value, profile: summarizeRestoreHeap(profile) };
  } finally {
    try { if (sampling) await session.post('HeapProfiler.stopSampling'); }
    finally { session.disconnect(); }
  }
}
