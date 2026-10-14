/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile,unlink } from 'node:fs/promises';
import { withDockerBoundaryFixture } from './dockerBoundaryFixture.mjs';

// This fixture runs separately from production source; no real Docker socket is mounted.
const run = (config,action = 'inspect') => new Promise((resolve,reject) => {
  const child = spawn(process.execPath,['/app/src/scripts/observeOllamaProviderBoundary.mjs',action],{
    env: { PATH: process.env.PATH,CLASSIFARR_GATEWAY_BOUNDARY_CONFIG_FILE: config },stdio: ['ignore','pipe','pipe'] });
  let stdout = '',stderr = '';
  child.stdout.on('data',chunk => { stdout += chunk; }); child.stderr.on('data',chunk => { stderr += chunk; });
  const timer = setTimeout(() => child.kill('SIGKILL'),18000);
  child.once('error',reject); child.once('close',code => { clearTimeout(timer); resolve({ code,stdout,stderr }); });
});

await withDockerBoundaryFixture(async ({ config,requests }) => {
  const path = '/tmp/docker-boundary-private.json';
  try {
    await writeFile(path,JSON.stringify(config),{ mode: 0o600,flag: 'wx' });
    const success = await run(path);
    assert.equal(success.code,0); assert.equal(success.stderr,'');
    assert.equal(JSON.parse(success.stdout).observation,'stopped');
    assert.equal(JSON.parse(success.stdout).recoveryAuthorized,false);
    assert.equal(requests.length,5); assert.ok(requests.every(item => item.method === 'GET'));
    assert.ok(!success.stdout.includes('PRIVATE-'));
    const refused = await run(path,'resume');
    assert.equal(refused.code,1); assert.equal(requests.length,5);
    assert.equal(refused.stderr,'gateway_boundary_config_invalid\n');
  } finally { await unlink(path); }
});
process.stdout.write('packaged_docker_boundary_cli_passed five_gets zero_mutations no_recovery_authority\n');
