/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUpgradeReceipt } from './publishedUpgradeCompose.mjs';
import { resourceStudyProfile, assertResourceStudyReceipt, assertResourceStudyStartupReceipt, STUDY_FINISH_BUDGET_MS } from '../../server/src/scripts/resourceStudyProfiles.mjs';
import { resourceStudyBudget, assertDockerStudyBudget, assertStudyBudgetContinuity } from '../../server/src/scripts/resourceStudyBudget.mjs';
import { formatResourceStudySummary } from './resourceStudySummary.mjs';
import { parseStudyBudgetDiagnostic } from '../../server/src/scripts/resourceStudyBudgetDiagnostic.mjs';
import { IMAGE_INDEX_STUDY_PROFILE, assertImageIndexStudyReceipt } from '../../server/src/scripts/imageIndexStudyContract.mjs';
import { assertImageIndexMixedReceipt } from '../../server/src/scripts/imageIndexMixedContract.mjs';
import { COMPARISON_CONCURRENT_PROFILE, assertComparisonConcurrentReceipt } from '../../server/src/scripts/comparisonMemoryStudy/contract.mjs';
import { collectComparisonStudyTrace } from './comparisonStudyTrace.mjs';
import { collectComparisonGcTrace } from './comparisonGcTrace.mjs';
import { COMPARISON_RECOVERY_PROFILE, assertComparisonRecoveryReceipt } from '../../server/src/scripts/comparisonMemoryStudy/recoveryContract.mjs';
import { assertComparisonCatalogReceipt } from '../../server/src/scripts/comparisonMemoryStudy/catalogContract.mjs';
import { POST_STOP_GC_WAIT_MS } from '../../server/src/scripts/comparisonMemoryStudy/naturalMajorGc.mjs';
import { QUIESCENT_RESIDENCY_MS } from '../../server/src/scripts/comparisonMemoryStudy/quiescentResidency.mjs';
import { correlateComparisonGcResidency } from './comparisonGcResidency.mjs';

const root = resolve(import.meta.dirname, '../..');

/** Reuses the isolated installation topology, never the user's compose project. */
export async function runResourceStudyCompose({ mode = 'soak', budget = 'baseline', candidateImageId, traceGc = false, profileAllocations = false, observePostStopGc = false, run = spawnSync, random = randomBytes,
  saveGcTrace = (project, trace) => {
    const directory = resolve(root, '.tmp/resource-study', project);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(resolve(directory, 'comparison-gc-trace.json'), JSON.stringify(trace, null, 2), { mode: 0o600 });
  },
  saveTrace = (project, trace) => {
    const directory = resolve(root, '.tmp/resource-study', project);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(resolve(directory, 'comparison-trace.json'), JSON.stringify(trace, null, 2), { mode: 0o600 });
  },
  report = message => process.stdout.write(`${message}\n`), save = (project, result) => {
    const directory = resolve(root, '.tmp/resource-study', project);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(resolve(directory, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    writeFileSync(resolve(directory, 'result.md'), formatResourceStudySummary(result), { mode: 0o600 });
  } } = {}) {
  const mixed = ['image-index-mixed', 'classification-retrieval'].includes(mode);
  const catalog = mode === 'comparison-catalog';
  if (typeof profileAllocations !== 'boolean' || (profileAllocations && !catalog)) throw new Error('resource_study_allocation_scope_invalid');
  if (typeof traceGc !== 'boolean' || (traceGc && !catalog)) throw new Error('resource_study_gc_scope_invalid');
  if (typeof observePostStopGc !== 'boolean' || (observePostStopGc && (!catalog || profileAllocations))) throw new Error('resource_study_post_stop_scope_invalid');
  const recovery = catalog || mode === 'comparison-recovery';
  const comparison = recovery || ['comparison-control', 'comparison-concurrent'].includes(mode);
  const profile = recovery ? COMPARISON_RECOVERY_PROFILE : comparison ? COMPARISON_CONCURRENT_PROFILE
    : mode === 'image-index' || mixed ? IMAGE_INDEX_STUDY_PROFILE : resourceStudyProfile(mode);
  const limits = resourceStudyBudget(budget);
  if (comparison && budget !== 'bounded') throw new Error('resource_study_budget_invalid');
  if ((budget === 'image-capacity' && mode !== 'image-index' && !mixed)
    || (mixed && budget !== 'image-capacity')) throw new Error('resource_study_budget_invalid');
  if (candidateImageId !== undefined && !/^sha256:[a-f0-9]{64}$/.test(candidateImageId)) throw new Error('resource_study_image_invalid');
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('invalid_study_identity');
  const project = `classifarr-resource-study-${suffix}`, image = `${project}-candidate`;
  const label = `label=com.docker.compose.project=${project}`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^COMPOSE_/i.test(key)));
  Object.assign(env, { COMPOSE_DISABLE_ENV_FILE: '1', CLASSIFARR_UPGRADE_IMAGE: candidateImageId ?? image,
    CLASSIFARR_UPGRADE_CANDIDATE: image, CLASSIFARR_UPGRADE_MODE: 'normal',
    CLASSIFARR_RESOURCE_STUDY_CPUS: String(limits.cpus), CLASSIFARR_RESOURCE_STUDY_PIDS: String(limits.pids),
    CLASSIFARR_RESOURCE_STUDY_MEMORY: String(limits.memoryBytes ?? 2 * 1024 ** 3) });
  const base = ['compose', '--project-name', project, '--file', resolve(root, 'docker-compose.published-upgrade-drill.yml'),
    '--project-directory', root];
  if (budget !== 'baseline') base.push('--file', resolve(root, 'docker-compose.resource-study-budget.yml'));
  let gcEvidence;
  const docker = (args, timeout = 120000, allowFailure = false) => {
    let result;
    try { result = run('docker', args, { cwd: root, env: { ...env }, shell: false, windowsHide: true,
      encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 }); } catch { /* Fixed error only. */ }
    if (comparison && args.includes('src/scripts/runResourceStudy.mjs') && args.at(-1) === mode) {
      const trace = collectComparisonStudyTrace(result?.stdout);
      if (trace.length) {
        saveTrace(project, trace);
        report(`RESOURCE_STUDY_TRACE .tmp/resource-study/${project}/comparison-trace.json`);
      }
      if (traceGc) {
        gcEvidence = collectComparisonGcTrace(result?.stdout);
        saveGcTrace(project, gcEvidence);
        report(`RESOURCE_STUDY_GC_TRACE .tmp/resource-study/${project}/comparison-gc-trace.json`);
      }
    }
    if (!result || result.error || (!allowFailure && result.status !== 0) || typeof result.stdout !== 'string') {
      // The study CLI emits fixed classifications and source locations, not payloads.
      if (args.includes('src/scripts/runResourceStudy.mjs')) {
        const budgetDiagnostic = String(result?.stderr ?? '').split(/\r?\n/)
          .map(parseStudyBudgetDiagnostic).find(Boolean);
        if (budgetDiagnostic) report(budgetDiagnostic);
        const diagnostic = String(result?.stderr ?? '').split(/\r?\n/).filter(line =>
          /^resource_study_failed (assertion|execution)$/.test(line) ||
          /^\s+at [\w. ]*\(?file:\/\/\/app\/src\/[\w/.-]+\.mjs:\d+:\d+\)?$/.test(line)).slice(0, 9);
        diagnostic.forEach(report);
      }
      throw new Error('resource_study_command_failed');
    }
    return result;
  };
  const compose = (args, ...options) => docker([...base, ...args], ...options);
  const inventory = [['ps', '-aq', '--filter', label], ['volume', 'ls', '-q', '--filter', label],
    ['network', 'ls', '-q', '--filter', label], ['image', 'ls', '-q', image]];
  for (const args of inventory) if (docker(args).stdout.trim()) throw new Error('resource_study_project_not_empty');
  compose(['config', '--quiet']);
  const probe = mode => parseUpgradeReceipt(compose(['exec', '-T', '-e', 'CLASSIFARR_RESOURCE_STUDY=isolated-synthetic-v1',
    '-e', `CLASSIFARR_RESOURCE_STUDY_BUDGET=${budget}`,
    '-e', `CLASSIFARR_STUDY_ALLOCATIONS=${profileAllocations && mode === 'comparison-catalog' ? '1' : '0'}`,
    '-e', `CLASSIFARR_STUDY_POST_STOP_GC=${observePostStopGc && mode === 'comparison-catalog' ? '1' : '0'}`,
    'app', 'node', ...(traceGc && mode === 'comparison-catalog' ? ['--trace-gc', '--trace-gc-ignore-scavenger'] : []),
    'src/scripts/runResourceStudy.mjs', mode], mode === 'seed' ? 120000 : profile.durationMs + profile.idleMs + STUDY_FINISH_BUDGET_MS +
      (observePostStopGc && mode === 'comparison-catalog' ? POST_STOP_GC_WAIT_MS + QUIESCENT_RESIDENCY_MS + 30000 : 0)).stdout, 'RESOURCE_STUDY');
  const containerId = () => {
    const id = compose(['ps', '--quiet', 'app']).stdout.trim();
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('resource_study_container_invalid');
    return id;
  };
  let imageId;
  const start = () => {
    compose(['up', '--no-build', '--detach', '--force-recreate', '--wait', '--wait-timeout', '180', 'app'], 240000);
    const format = '{"nanoCpus":{{json .HostConfig.NanoCpus}},"pids":{{json .HostConfig.PidsLimit}},' +
      '"memoryBytes":{{json .HostConfig.Memory}},"cpuQuota":{{json .HostConfig.CpuQuota}},"imageId":{{json .Image}}}';
    let config;
    try { config = JSON.parse(docker(['inspect', '--format', format, containerId()]).stdout); }
    catch { throw new Error('resource_study_docker_budget_unavailable'); }
    assertDockerStudyBudget(config, budget);
    if (config.imageId !== imageId) throw new Error('resource_study_container_image_mismatch');
    const receipt = probe(`budget-${env.CLASSIFARR_UPGRADE_MODE}`);
    assertResourceStudyStartupReceipt(receipt, budget);
    return receipt;
  };
  let result, failure;
  report(`RESOURCE_STUDY_PROJECT ${project}`);
  try {
    if (!candidateImageId) compose(['build', 'candidate'], 1200000);
    imageId = docker(['image', 'inspect', '--format', '{{.Id}}', candidateImageId ?? image]).stdout.trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('resource_study_image_invalid');
    if (candidateImageId && imageId !== candidateImageId) throw new Error('resource_study_image_mismatch');
    const freshStartup = start();
    const fresh = parseUpgradeReceipt(compose(['exec', '-T', 'app', 'node', 'src/scripts/publishedUpgradeProbe.mjs', 'fresh']).stdout, 'UPGRADE_PROBE');
    if (fresh.status !== 'passed' || probe('seed').seeded !== true) throw new Error('resource_study_seed_invalid');
    compose(['stop', '--timeout', '30', 'app']);
    env.CLASSIFARR_UPGRADE_MODE = 'restore'; const maintenanceStartup = start();
    assertStudyBudgetContinuity(freshStartup.metrics, maintenanceStartup.metrics);
    report(`RESOURCE_STUDY_RUNNING ${mode} ${budget}`);
    result = { mode, budget, imageId, startup: { fresh: freshStartup, maintenance: maintenanceStartup }, study: probe(mode) };
    if (Boolean(result.study.allocations) !== profileAllocations) throw new Error('resource_study_allocation_evidence_missing');
    if (Boolean(result.study.postStopGc) !== observePostStopGc) throw new Error('resource_study_post_stop_evidence_missing');
    if (result.study.postStopGc?.status === 'observed' && !result.study.postStopResidency) throw new Error('resource_study_residency_evidence_missing');
    if (traceGc) {
      if (gcEvidence?.status !== 'complete') throw new Error('resource_study_gc_evidence_incomplete');
      result.gcTrace = { version: 1, status: gcEvidence.status, events: gcEvidence.events.length,
        scope: 'major_collections_per_source_local_pool', roundedMiB: true };
    }
    if (comparison) {
      if (result.study.profile !== mode) throw new Error('resource_study_profile_mismatch');
      if (catalog) assertComparisonCatalogReceipt(result.study, budget);
      else if (recovery) assertComparisonRecoveryReceipt(result.study, budget);
      else assertComparisonConcurrentReceipt(result.study, budget);
    }
    else if (mixed) {
      if (result.study.profile !== mode) throw new Error('resource_study_profile_mismatch');
      assertImageIndexMixedReceipt(result.study, budget);
    }
    else if (mode === 'image-index') assertImageIndexStudyReceipt(result.study, budget);
    else assertResourceStudyReceipt(result.study, mode, budget);
    assertStudyBudgetContinuity(maintenanceStartup.metrics, result.study.initial, result.study.final);
    if (traceGc && observePostStopGc) {
      result.gcResidency = correlateComparisonGcResidency(result.study.postStopResidency, gcEvidence);
    }
    const id = containerId();
    if (!/^[a-f0-9]{12,64}$/.test(id) || docker(['inspect', '--format', '{{.State.OOMKilled}} {{.State.Health.Status}}', id]).stdout.trim() !== 'false healthy') {
      throw new Error('resource_study_container_unhealthy');
    }
  } catch (error) { failure = error; }
  finally {
    // Fixed owned project validated empty before build; no arbitrary paths or prune.
    compose(['--profile', 'tools', 'down', '--volumes', '--timeout', '10']);
    if (!candidateImageId) docker(['image', 'rm', image], 30000, true);
    for (const args of inventory) if (docker(args).stdout.trim()) throw new Error('resource_study_cleanup_failed');
  }
  if (failure) throw failure;
  result.cleanup = 'passed'; save(project, result);
  report(`RESOURCE_STUDY_RESULT .tmp/resource-study/${project}/result.json`);
  return result;
}
