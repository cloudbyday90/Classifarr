/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const expression = text => '${{ ' + text + ' }}';
const checkout = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const node = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const download = 'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c';
const upload = 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';

export function validatePublishedRoutingWorkflow(workflow) {
  const job = workflow.jobs['published-routing-acceptance'];
  assert.equal(job.if, "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')");
  assert.deepEqual(job.needs, ['docker-release']);
  assert.equal(job['runs-on'], expression('matrix.runner'));
  assert.equal(job['timeout-minutes'], 40);
  assert.deepEqual(job.permissions, { contents: 'read', attestations: 'read' });
  assert.deepEqual(job.strategy, { 'fail-fast': false, 'max-parallel': 2, matrix: { include: [
    { arch: 'amd64', platform: 'linux/amd64', runner: 'ubuntu-24.04' },
    { arch: 'arm64', platform: 'linux/arm64', runner: 'ubuntu-24.04-arm' },
  ] } });
  assert.equal(job['continue-on-error'], undefined);
  assert.equal(job.env, undefined);
  assert.equal(job.steps.length, 5);
  const [checkoutStep, nodeStep, buildx, run, artifact] = job.steps;
  assert.deepEqual(checkoutStep, { name: 'Checkout routing fixture and historical baseline', uses: checkout,
    with: { 'fetch-depth': 0, 'persist-credentials': false } });
  assert.deepEqual(nodeStep, { name: 'Setup Node.js', uses: node, with: { 'node-version-file': '.nvmrc' } });
  assert.deepEqual(buildx, { name: 'Setup Buildx', uses: 'docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069' });
  assert.deepEqual(Object.keys(run).sort(), ['env', 'name', 'run']);
  assert.equal(run.name, 'Verify and rehearse published routing');
  assert.deepEqual(run.env, { GH_TOKEN: expression('github.token'), IMAGE_DIGEST: expression('needs.docker-release.outputs.image_digest'),
    SOURCE_REVISION: expression('github.sha'), ROUTING_PLATFORM: expression('matrix.platform') });
  assert.equal(run.run.trim(), [
    'set -euo pipefail',
    'npm run release:test:published-routing -- \\',
    '  --image "ghcr.io/cloudbyday90/classifarr@$' + '{IMAGE_DIGEST}" \\',
    '  --source-revision "$SOURCE_REVISION" --platform "$ROUTING_PLATFORM"',
  ].join('\n'));
  assert.deepEqual(artifact, { name: 'Upload published routing receipt', if: 'always()', uses: upload,
    with: { name: `published-routing-${expression('matrix.arch')}`, path: `.tmp/published-routing/${expression('matrix.arch')}.json`,
      'if-no-files-found': 'error', 'include-hidden-files': true, 'retention-days': 90 } });
  const publication = workflow.jobs['release-candidate-publication'];
  assert.ok(publication.needs.includes('published-routing-acceptance'));
  assert.equal(publication['continue-on-error'], undefined);
  const assembly = publication.steps.find(step => step.name === 'Assemble release candidate evidence');
  assert.equal(assembly.if, undefined);
  assert.equal(assembly['continue-on-error'], undefined);
  for (const arch of ['amd64', 'arm64']) {
    const name = `Download ${arch.toUpperCase()} published routing receipt`;
    const steps = publication.steps.filter(step => step.name === name);
    assert.equal(steps.length, 1);
    assert.deepEqual(steps[0], { name, uses: download, with: { name: `published-routing-${arch}`, path: `.tmp/release-candidate/routing-${arch}` } });
    assert.ok(publication.steps.indexOf(steps[0]) < publication.steps.indexOf(assembly));
    assert.ok(assembly.run.includes(`--routing-${arch} .tmp/release-candidate/routing-${arch}/${arch}.json`));
  }
  return true;
}
