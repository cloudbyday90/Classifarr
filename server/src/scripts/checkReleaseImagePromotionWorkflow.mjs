/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const expression = text => '${{ ' + text + ' }}';
const permissions = { attestations: 'read', contents: 'read', packages: 'write' };
const login = 'docker/login-action@dbcb813823bdd20940b903addbd779551569679f';

export function validateReleaseImagePromotionWorkflow(ci, reusable) {
  const build = ci.jobs['docker-release'];
  const metadata = build.steps.find(step => step.id === 'meta');
  assert.equal(metadata.with.flavor, 'latest=false');
  assert.equal(metadata.with.tags.trim(), 'type=ref,event=tag');
  assert.equal(build.steps.find(step => step.id === 'build-and-push-image').with.tags, expression('steps.meta.outputs.tags'));
  assert.equal(ci.jobs['published-digest-consumer-smoke'].steps.some(step => /:latest|image alias/.test(step.run ?? step.name)), false);
  const caller = ci.jobs['promote-published-latest'];
  assert.deepEqual(caller, { name: 'Promote accepted images to latest',
    if: "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')",
    needs: ['docker-release', 'release-candidate-publication', 'published-digest-consumer-smoke', 'published-routing-acceptance'],
    permissions, uses: './.github/workflows/promote-published-release-image.yml',
    with: { source_tag: expression('github.ref_name'), source_revision: expression('github.sha'),
      image_digest: expression('needs.docker-release.outputs.image_digest') },
    secrets: { DOCKERHUB_USERNAME: expression('secrets.DOCKERHUB_USERNAME'), DOCKERHUB_TOKEN: expression('secrets.DOCKERHUB_TOKEN') } });
  assert.equal(reusable.env, undefined);
  assert.deepEqual(Object.keys(reusable.jobs), ['promote-latest']);
  assert.deepEqual(reusable.on.workflow_call.inputs, Object.fromEntries(
    ['source_tag', 'source_revision', 'image_digest'].map(key => [key, { required: true, type: 'string' }])));
  assert.deepEqual(Object.keys(reusable.on), ['workflow_dispatch', 'workflow_call']);
  const job = reusable.jobs['promote-latest'];
  assert.deepEqual(Object.keys(job).sort(), ['concurrency', 'environment', 'if', 'name', 'permissions', 'runs-on', 'steps', 'timeout-minutes']);
  assert.equal(job.if, "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && startsWith(github.ref, 'refs/tags/v') && github.ref_name == inputs.source_tag");
  assert.equal(job['runs-on'], 'ubuntu-latest');
  assert.equal(job['timeout-minutes'], 30);
  assert.equal(job.environment, 'release-publication');
  assert.deepEqual(job.concurrency, { group: 'classifarr-published-latest', 'cancel-in-progress': false });
  assert.deepEqual(job.permissions, permissions);
  assert.deepEqual(job.steps, [
    { name: 'Checkout promotion code and ancestry', uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
      with: { 'fetch-depth': 0, 'persist-credentials': false } },
    { name: 'Setup Node.js', uses: 'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1', with: { 'node-version-file': '.nvmrc' } },
    { name: 'Setup Buildx', uses: 'docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069' },
    { name: 'Log in to GHCR', uses: login, with: { registry: 'ghcr.io', username: expression('github.actor'), password: expression('secrets.GITHUB_TOKEN') } },
    { name: 'Log in to Docker Hub', uses: login, with: { username: expression('secrets.DOCKERHUB_USERNAME'), password: expression('secrets.DOCKERHUB_TOKEN') } },
    { name: 'Verify release and promote exact indexes', env: { GH_TOKEN: expression('github.token'), SOURCE_TAG: expression('inputs.source_tag'),
      SOURCE_REVISION: expression('inputs.source_revision'), IMAGE_DIGEST: expression('inputs.image_digest') }, run: 'node scripts/promote-release-images.mjs --write' },
    { name: 'Upload promotion evidence', if: 'always()', uses: 'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9',
      with: { name: 'published-release-image-alias-promotion', path: '.tmp/ci/published-release-image-alias-promotion.json',
        'if-no-files-found': 'error', 'include-hidden-files': true, 'retention-days': 90 } },
  ]);
  return true;
}
