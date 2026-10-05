/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { startSelectedApplication } from './embeddedSelectedApplication.mjs';
import { startSelectedMaintenance } from './embeddedSelectedMaintenance.mjs';
import { SELECTED_RESTORE_MAX_BYTES } from './embeddedSelectedMaintenanceContract.mjs';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';

/** Internal default-layout composition, not a public mode or saved-template override.
 * Caller holds the selection lease and owns/clears restore input after joined completion.
 */
export function selectedRuntimeComposition({ mode, identities, request = null, report = () => {},
  startApplication = startSelectedApplication, startMaintenance = startSelectedMaintenance,
}) {
  if (!['normal', 'restore'].includes(mode) || (mode === 'normal' ? request !== null
    : !Buffer.isBuffer(request) || request.length === 0 || request.length > SELECTED_RESTORE_MAX_BYTES)) {
    throw new Error('selected_runtime_composition_invalid');
  }
  const database = { uid: parseEmbeddedId(identities?.database?.uid), gid: parseEmbeddedId(identities?.database?.gid) };
  const application = { uid: parseEmbeddedId(identities?.application?.uid), gid: parseEmbeddedId(identities?.application?.gid) };
  if (database.uid === application.uid || database.gid === application.gid) throw new Error('selected_runtime_identity_collision');
  return {
    maintenanceOnly: mode === 'restore',
    startMaintenance: () => startMaintenance({ operation: mode === 'normal' ? 'schema' : 'restore',
      identity: database, request, report }),
    startApplication: mode === 'normal' ? () => startApplication({ identity: application }) : null,
  };
}
