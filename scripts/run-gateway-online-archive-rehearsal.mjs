/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runGatewayArchiveQualification } from './lib/gatewayArchiveQualification.mjs';
import { runGatewayArchiveRehearsal } from './lib/gatewayArchiveRehearsal.mjs';
import { runGatewayCatalogSchedulingRehearsal } from './lib/gatewayCatalogSchedulingRehearsal.mjs';
import { runGatewayInferenceSoak } from './lib/gatewayInferenceSoak.mjs';

const [image,revision,mode] = process.argv.slice(2);
if (process.argv.length > 5 || (mode && !['--qualification','--cleanup','--catalog-scheduling','--catalog-qualification',
  '--catalog-memory','--catalog-memory-baseline','--inference-soak','--extended-soak','--rotation-study','--history-profile','--restore-memory','--row-mode-profile'].includes(mode))) throw new Error('archive_rehearsal_arguments_invalid');
if (!/^sha256:[a-f0-9]{64}$/.test(image ?? '') || !/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('immutable_image_and_revision_required');
if (['--inference-soak','--extended-soak','--history-profile','--restore-memory','--row-mode-profile'].includes(mode)) {
  await runGatewayInferenceSoak(image, revision, mode === '--inference-soak' ? 'regression' : 'extended',
    mode === '--history-profile' ? 'history' : mode === '--restore-memory' ? 'restores' : mode === '--row-mode-profile' ? 'rowmode' : 'inference');
} else if (['--catalog-memory','--catalog-memory-baseline'].includes(mode)) {
  await runGatewayArchiveQualification(image, revision, false, true, 'catalog-wide', mode === '--catalog-memory');
} else if (['--catalog-scheduling','--rotation-study'].includes(mode)) {
  await runGatewayCatalogSchedulingRehearsal(image, revision, mode === '--rotation-study');
} else if (['--qualification','--cleanup','--catalog-qualification'].includes(mode)) {
  await runGatewayArchiveQualification(image,revision,mode === '--cleanup',mode === '--catalog-qualification');
} else {
  await runGatewayArchiveRehearsal(image,revision);
}
