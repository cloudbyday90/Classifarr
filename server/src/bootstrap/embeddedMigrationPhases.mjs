/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const MIGRATION_PHASES = Object.freeze(['copy', 'ownership', 'authentication', 'roles', 'verification']);

export function validateMigrationReceipt(receipt, binding) {
  if (typeof binding !== 'string' || !/^[a-f0-9]{64}$/.test(binding) || binding.length !== 64) throw new Error('migration_binding_invalid');
  if (receipt === null) return { version: 1, binding, completed: 0, pending: null };
  if (!receipt || Object.keys(receipt).sort().join(',') !== 'binding,completed,pending,version'
    || receipt.version !== 1 || receipt.binding !== binding || !Number.isInteger(receipt.completed)
    || receipt.completed < 0 || receipt.completed > MIGRATION_PHASES.length
    || (receipt.pending !== null && (typeof receipt.pending !== 'string'
      || receipt.pending !== MIGRATION_PHASES[receipt.completed]))) {
    throw new Error('migration_receipt_invalid');
  }
  return receipt;
}

/** The caller holds an exclusive journal lease and owns offline-cluster isolation. */
export async function runEmbeddedMigrationPhases({ journal, binding, steps, checkpoint = async () => {} }) {
  if (!MIGRATION_PHASES.every(phase => typeof steps[phase] === 'function') || typeof steps.prepare !== 'function') {
    throw new Error('migration_steps_invalid');
  }
  let receipt = validateMigrationReceipt(await journal.read(), binding);
  await steps.prepare(receipt);
  for (let index = receipt.completed; index < MIGRATION_PHASES.length; index += 1) {
    const phase = MIGRATION_PHASES[index];
    receipt = { ...receipt, pending: phase };
    await journal.write(receipt);
    await checkpoint(`before:${phase}`);
    await steps[phase]();
    await checkpoint(`applied:${phase}`);
    receipt = { ...receipt, completed: index + 1, pending: null };
    await journal.write(receipt);
    await checkpoint(`after:${phase}`);
  }
  // A receipt is not continuing proof of a filesystem or credential boundary.
  await steps.verification();
  return { status: 'verified', productionCutover: false };
}
