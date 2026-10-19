/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createArchiveVerifier,assertArchiveVerifierStopped } from './gatewayArchiveSandbox.mjs';

/** Preserve the default native archive/refusal scenarios and original attempts. */
export function runGatewayArchiveScenarios({docker,image,stores,binding,label,names,inspect,execute}) {
  process.stdout.write(execute('archiveRestoreInput.mjs'));
  const fixture = action => process.stdout.write(execute('onlineArchive.mjs',[action]));
  const protection = action => process.stdout.write(execute('archiveProtection.mjs',[action]));
  fixture('setup'); fixture('checks');
  createArchiveVerifier({docker,image,name:names.verifier,label,kind:'archive',stores,binding,inspect});
  const verify = state => {
    const output = docker(['start','-a',names.verifier]);
    assert.ok(output.includes(`"state":"${state}"`),output);
    assertArchiveVerifierStopped(inspect(names.verifier));
  };
  for (let cycle=0;cycle<3;cycle++) {
    if (cycle) fixture('next');
    if (cycle === 1) {
      fixture('receipt-downgrade'); fixture('tamper-inventory');
      verify('verification_failed'); fixture('restore-inventory-fixture');
    }
    verify('verified');
    if (!cycle) { fixture('receipt-crash'); verify('idle'); }
    fixture('accept');
  }
  fixture('corrupt');
  for (let cycle=4;cycle<=7;cycle++) {
    fixture('next'); verify('verified');
    if (cycle === 7) protection('retirement-cut');
    fixture('accept');
    if (cycle === 4) { protection('stage'); fixture('accept'); protection('check'); }
  }
  protection('rotated');
}
