/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MIGRATION_PHASES, validateMigrationReceipt } from './embeddedMigrationPhases.mjs';

function validateSelection(value, binding) {
  if (value === null) return null;
  if (!value || Object.keys(value).sort().join(',') !== 'binding,phase,version'
    || value.version !== 1 || value.binding !== binding
    || !['verifying', 'selected'].includes(value.phase)) {
    throw new Error('migration_selection_invalid');
  }
  return value;
}

async function readState(journal, binding) {
  // Validate the binding even on an empty installation. No caller paths or roles.
  validateMigrationReceipt(null, binding);
  const migration = await journal.read();
  const selection = validateSelection(await journal.selection.read(), binding);
  if (migration === null && selection === null) return { empty: true, selection };
  const receipt = validateMigrationReceipt(migration, binding);
  if (migration === null || receipt.completed !== MIGRATION_PHASES.length || receipt.pending !== null) {
    throw new Error('migration_selection_not_ready');
  }
  return { empty: false, selection };
}

/** Decision only; the startup caller must revalidate with selectEmbeddedMigration before launch. */
export async function readEmbeddedMigrationSelection({ journal, binding }) {
  const { empty, selection } = await readState(journal, binding);
  // Missing receipts could also mean lost metadata around an existing candidate.
  // This API never authorizes fallback; ordinary legacy startup is separate.
  if (empty || selection?.phase !== 'selected') throw new Error('migration_selection_not_ready');
  return 'candidate';
}

/** Caller owns offline isolation and holds the journal lease throughout verification and selection. */
export async function selectEmbeddedMigration({ journal, binding, verify, checkpoint = async () => {} }) {
  if (typeof verify !== 'function') throw new Error('migration_selection_verifier_required');
  const { empty, selection } = await readState(journal, binding);
  if (empty) throw new Error('migration_selection_not_ready');
  if (selection === null) await journal.selection.write({ version: 1, binding, phase: 'verifying' });
  await checkpoint('before:verify');
  // A saved selection is not proof of continuing authentication/filesystem isolation.
  await verify();
  await checkpoint('verified');
  // Re-sync even an existing selection: a previous rename may have succeeded
  // while directory fsync failed. A process restart is not a durability proof.
  await journal.selection.write({ version: 1, binding, phase: 'selected' });
  await checkpoint('selected');
  return { status: 'selected', database: 'candidate', productionCutover: false };
}
