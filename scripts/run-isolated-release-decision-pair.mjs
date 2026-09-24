/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, resolveProjectJsonFile } from './lib/project-json-input.mjs';
import { BASELINE_COMMIT, assertPinnedReleaseCommit } from '../server/src/scripts/pinnedReleaseSchema.mjs';
import { validateReleaseDecisionInput, projectReleaseDecisionWorkerInput } from
  '../server/src/services/operatorCorrectionReleaseDecisionInput.mjs';
import { buildReleaseDecisionPair } from '../server/src/services/operatorCorrectionReleaseDecisionPair.mjs';

const TMP_ROOT = join(PROJECT_ROOT, '.tmp');
const SERVER_SOURCE = join(PROJECT_ROOT, 'server', 'src');
const IMAGE = 'classifarr:test';

async function privateTemporaryDirectory(prefix) {
  await mkdir(TMP_ROOT, { recursive: true });
  const realRoot = await realpath(PROJECT_ROOT);
  const realTmp = await realpath(TMP_ROOT);
  if (relative(realRoot, realTmp) !== '.tmp') throw new Error('release_decision_tmp_boundary_invalid');
  return mkdtemp(join(realTmp, prefix));
}

function verifyCheckout() {
  assertPinnedReleaseCommit();
  const options = { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 };
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], options).trim()) {
    throw new Error('release_decision_checkout_dirty');
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
  if (!/^[a-f0-9]{40}$/.test(commit) || commit === BASELINE_COMMIT) throw new Error('release_decision_commit_invalid');
  return commit;
}

async function stageReleaseSource(stage) {
  const archive = join(stage, 'release.tar');
  execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, BASELINE_COMMIT, 'server/src'],
    { cwd: PROJECT_ROOT, maxBuffer: 64 * 1024 });
  execFileSync('tar', ['-xf', archive, '-C', stage], { cwd: PROJECT_ROOT, maxBuffer: 64 * 1024 });
  const source = join(stage, 'server', 'src');
  await stat(join(source, 'services', 'policyEngineEvaluation.mjs'));
  return source;
}

function captureDocker(args, input, timeoutMs = 90_000) {
  return new Promise((resolveRun, reject) => {
    const child = spawn('docker', args, { cwd: PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DOCKER_HOST: process.env.DOCKER_HOST,
        DOCKER_CONTEXT: process.env.DOCKER_CONTEXT } });
    let output = '', stderrBytes = 0, settled = false;
    const fail = () => { if (!settled) { settled = true; reject(new Error('release_decision_container_failed')); } };
    const timer = setTimeout(() => { child.kill(); fail(); }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 1_000_000) { child.kill(); fail(); } });
    child.stderr.on('data', chunk => { stderrBytes += chunk.length; if (stderrBytes > 64_000) { child.kill(); fail(); } });
    child.on('error', fail);
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return fail();
      if (!settled) { settled = true; try { resolveRun(JSON.parse(output)); } catch { reject(new Error('release_decision_container_output_invalid')); } }
    });
    child.stdin.on('error', fail);
    child.stdin.end(JSON.stringify(input));
  });
}

export function buildIsolatedDecisionDockerArgs({ role, stageSource, imageId }) {
  if (!['baseline', 'candidate'].includes(role) || !/^sha256:[a-f0-9]{64}$/.test(imageId) ||
      typeof stageSource !== 'string' || !stageSource) throw new Error('release_decision_container_arguments_invalid');
  return ['run', '--rm', '--pull=never', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '64', '--memory', '512m', '--cpus', '1',
    '--user', '65534:65534', '--tmpfs', '/tmp:rw,noexec,nosuid,size=8m', '-i',
    '--mount', `type=bind,source=${stageSource},target=/app/release/server/src,readonly`,
    '--mount', `type=bind,source=${SERVER_SOURCE},target=/app/current/src,readonly`,
    '--env', 'NODE_ENV=test', '--env', 'LOG_LEVEL=fatal', '--env', 'FILE_LOGGING_ENABLED=false',
    '--entrypoint', 'node', imageId, '/app/current/src/scripts/isolatedReleaseDecisionWorker.mjs', role];
}

async function runRole({ role, stageSource, input, imageId }) {
  return captureDocker(buildIsolatedDecisionDockerArgs({ role, stageSource, imageId }), input);
}

async function loadPrivateInput(inputFile) {
  const path = await resolveProjectJsonFile(inputFile);
  const details = await stat(path);
  if (!details.isFile() || details.size > 2_000_000) throw new Error('release_decision_input_size_invalid');
  return validateReleaseDecisionInput(JSON.parse(await readFile(path, 'utf8')));
}

/** No live database, provider endpoint, or writable host mount is passed to either run. */
export async function runIsolatedReleaseDecisionPair({ inputFile, check = verifyCheckout,
  loadInput = loadPrivateInput, stage = stageReleaseSource, execute = runRole,
  image = () => execFileSync('docker', ['image', 'inspect', '--format', '{{.Id}}', IMAGE],
    { encoding: 'utf8', maxBuffer: 1024 }).trim() } = {}) {
  if (typeof inputFile !== 'string') throw new Error('release_decision_input_required');
  const candidateCommit = check();
  const input = await loadInput(inputFile);
  const imageId = image();
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('release_decision_image_invalid');
  const stageDirectory = await privateTemporaryDirectory('release-code-');
  try {
    const stageSource = await stage(stageDirectory);
    const workerInput = projectReleaseDecisionWorkerInput(input);
    const baselineResult = await execute({ role: 'baseline', stageSource, input: workerInput, imageId });
    const candidateResult = await execute({ role: 'candidate', stageSource, input: workerInput, imageId });
    const { baselineBundle, candidateBundle, report } = buildReleaseDecisionPair({ input, baselineResult,
      candidateResult, candidateCommit });
    const artifactDirectory = await privateTemporaryDirectory('release-pair-');
    await writeFile(join(artifactDirectory, 'baseline.json'), JSON.stringify(baselineBundle), { flag: 'wx', mode: 0o600 });
    await writeFile(join(artifactDirectory, 'candidate.json'), JSON.stringify(candidateBundle), { flag: 'wx', mode: 0o600 });
    return { ...report, decisionSubpathExecutionVerified: true, containerImageId: imageId,
      privateArtifacts: [relative(PROJECT_ROOT, join(artifactDirectory, 'baseline.json')).split(sep).join('/'),
        relative(PROJECT_ROOT, join(artifactDirectory, 'candidate.json')).split(sep).join('/')],
      dependencyProvenanceVerified: false };
  } finally {
    const path = relative(TMP_ROOT, stageDirectory);
    if (!path.startsWith('release-code-') || path.includes(sep)) throw new Error('release_decision_stage_boundary_invalid');
    await rm(stageDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { 'input-file': { type: 'string' } }, strict: true });
    runIsolatedReleaseDecisionPair({ inputFile: values['input-file'] }).then(report => {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }).catch(() => {
      process.stderr.write('Isolated release decision replay failed; no routing or learning changes were made.\n');
      process.exitCode = 1;
    });
  } catch {
    process.stderr.write('A project-relative private input JSON file is required.\n');
    process.exitCode = 1;
  }
}
