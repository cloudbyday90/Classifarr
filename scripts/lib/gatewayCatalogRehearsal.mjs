/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createArchiveVerifier,assertArchiveVerifierStopped } from './gatewayArchiveSandbox.mjs';
import { requireBoundStudyOutput } from './gatewayStudyPolicy.mjs';

/** Existing synthetic archive fixture only; no live connection/credential accepted. */
export function runGatewayCatalogRehearsal({docker,image,stores,binding,label,names,inspect,remove,execute}) {
  const fixture = action => process.stdout.write(execute('catalogArchive.mjs',[action]));
  const name = names.catalog;
  const verify = action => {
    assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
    try {
      createArchiveVerifier({docker,image,name,label,kind:'catalog',stores,binding,inspect,args:[action]});
      const output = docker(['start','-a',name]); assertArchiveVerifierStopped(inspect(name));
      process.stdout.write(requireBoundStudyOutput(output,binding,'catalogArchive.mjs'));
    } finally { remove(name); }
  };
  fixture('capture'); verify('verify');
  fixture('hide-marker'); verify('missing'); fixture('restore-marker');
  fixture('tamper'); verify('tampered'); fixture('restore-manifest'); verify('verify');
  process.stdout.write('catalog_rehearsal_passed: exact restore; absent retired files; missing marker refusal without repair; tamper refusal; zero provider calls\n');
}
