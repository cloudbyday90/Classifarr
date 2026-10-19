/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createArchiveVerifier,assertArchiveVerifierStopped } from './gatewayArchiveSandbox.mjs';
import { requireBoundStudyOutput } from './gatewayStudyPolicy.mjs';

export function runGatewayCatalogRetentionRehearsal({docker,image,stores,binding,label,names,inspect,remove,execute}) {
  const fixture = (...args) => execute('catalogRetention.mjs',args).trim();
  const name = names.retention;
  fixture('setup');
  process.stdout.write(`${fixture('capacity')}\n`);
  for (let cycle=0;cycle<3;cycle++) {
    const id = fixture('capture'); assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
    try {
      createArchiveVerifier({docker,image,name,label,kind:'retention',stores,binding,inspect,args:['verify',id]});
      const output = docker(['start','-a',name]); assertArchiveVerifierStopped(inspect(name));
      const receipt = JSON.parse(requireBoundStudyOutput(output,binding,'catalogRetention.mjs'));
      assert.equal(receipt.archiveId,id);
      process.stdout.write(`${fixture('accept',JSON.stringify(receipt))}\n`);
    } finally { remove(name); }
  }
  process.stdout.write(`${fixture('faults')}\n${fixture('resume')}\n`);
  process.stdout.write(`${fixture('read-guards')}\n`);
}
