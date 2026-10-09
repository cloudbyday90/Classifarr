/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { loadWorkflow } from '../../scripts/checkReleaseCandidatePublicationWorkflow.mjs';
import { validateDockerHubPullWorkflows, validateDockerHubPullAction } from '../../scripts/dockerHubPullWorkflowContract.mjs';

const resourcePath = resolve(import.meta.dirname, '../../../../.github/workflows/resource-capacity.yml');
const load = () => ({ ci: loadWorkflow(), resource: loadWorkflow(resourcePath) });
const validate = ({ ci, resource }) => validateDockerHubPullWorkflows(ci, resource);
const targets = [
  ['ci', 'build-and-test'],
  ['ci', 'database-tests'],
  ['ci', 'runtime-installation-acceptance'],
  ['resource', 'resource-capacity'],
];
const login = job => job.steps.find(step => step.id === 'dockerhub-pull-login');

test('all four image consumers use guarded read-only pull credentials', () => {
  expect(validate(load())).toBe(true);
});

const mutations = [
  ['missing login', job => { job.steps = job.steps.filter(step => step !== login(job)); }],
  ['duplicate login', job => { job.steps.push(structuredClone(login(job))); }],
  ['late login', job => { const step = login(job); job.steps = job.steps.filter(s => s !== step); job.steps.push(step); }],
  ['no event boundary', job => { delete login(job).if; }],
  ['PR credentials', job => { login(job).if = "github.event_name == 'pull_request'"; }],
  ['PR-target credentials', job => { login(job).if = "github.event_name == 'pull_request_target'"; }],
  ['fork credentials', job => { login(job).if = login(job).if.replace("github.repository == 'cloudbyday90/Classifarr' && ", ''); }],
  ['other branch credentials', job => { login(job).if = login(job).if.replace("github.ref == 'refs/heads/main' && ", ''); }],
  ['tag credentials', job => { login(job).if = login(job).if.replace("github.ref == 'refs/heads/main'", "startsWith(github.ref, 'refs/tags/v')"); }],
  ['bypassed prior failure', job => { login(job).if = `always() && (${login(job).if})`; }],
  ['mutable action', job => { login(job).uses = 'docker/login-action@v4'; }],
  ['other registry', job => { login(job).with.registry = 'other.example'; }],
  ['publishing credential', job => { login(job).with.password = '${{ secrets.DOCKERHUB_TOKEN }}'; }],
  ['publishing fallback', job => { login(job).with.password = '${{ secrets.DOCKERHUB_PULL_TOKEN || secrets.DOCKERHUB_TOKEN }}'; }],
  ['no username', job => { delete login(job).with.username; }],
  ['missing token', job => { delete login(job).with.password; }],
  ['masked login failure', job => { login(job)['continue-on-error'] = true; }],
  ['masked job failure', job => { job['continue-on-error'] = true; }],
  ['credentials retained', job => { login(job).with.logout = false; }],
  ['Buildx-only credentials', job => { login(job).with.scope = 'cloudbyday90/classifarr@pull'; }],
  ['unbounded step', job => { delete login(job)['timeout-minutes']; }],
  ['credential env', job => { job.env = { TOKEN: '${{ secrets.DOCKERHUB_PULL_TOKEN }}' }; }],
  ['credential output', job => { job.outputs = { token: '${{ secrets.DOCKERHUB_PULL_TOKEN }}' }; }],
  ['extra credential step', job => { job.steps.push({ run: 'echo $TOKEN', env: { TOKEN: '${{ secrets.DOCKERHUB_PULL_TOKEN }}' } }); }],
  ['service image before login', job => { job.services = { db: { image: 'pgvector/pgvector:0.8.7-pg18' } }; }],
  ['self-hosted runner', job => { job['runs-on'] = 'self-hosted'; }],
  ['write permission', job => { job.permissions = { contents: 'write' }; }],
];

test.each(targets.flatMap(([workflow, job]) => mutations.map(([name, mutate]) => [workflow, job, name, mutate])))
  ('rejects %s/%s: %s', (workflow, job, _name, mutate) => {
    const workflows = load();
    mutate(workflows[workflow].jobs[job]);
    expect(() => validate(workflows)).toThrow();
  });

test.each(['ci', 'resource'].flatMap(workflow => ['pull_request_target', 'workflow_run'].map(trigger => [workflow, trigger])))
  ('rejects privileged %s trigger %s even when YAML value is null', (workflow, trigger) => {
    const workflows = load();
    workflows[workflow].on[trigger] = null;
    expect(() => validate(workflows)).toThrow();
  });

test.each(['ci', 'resource'])('rejects global credentials in %s', workflow => {
  const workflows = load();
  workflows[workflow].env = { TOKEN: '${{ secrets.DOCKERHUB_PULL_TOKEN }}' };
  expect(() => validate(workflows)).toThrow();
});

test('resource gate retains read-only workflow permissions', () => {
  const workflows = load();
  workflows.resource.permissions.contents = 'write';
  expect(() => validate(workflows)).toThrow();
});

test.each(['post', 'post-if', 'main', 'using'])('action rejects changed %s cleanup/runtime contract', key => {
  const action = loadWorkflow(resolve(import.meta.dirname, '../../../../.github/actions/dockerhub-pull/action.yml'));
  action.runs[key] = 'unsafe';
  expect(() => validateDockerHubPullAction(action)).toThrow();
});

test('registry comparison cannot be skipped or mask pull failures', () => {
  const workflows = load();
  workflows.ci.jobs['database-tests'].steps.find(step => step.name.startsWith('Compare Docker CLI'))['continue-on-error'] = true;
  expect(() => validate(workflows)).toThrow();
});
