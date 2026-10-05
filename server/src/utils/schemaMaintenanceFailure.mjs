/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const RESTORE_VERIFICATION_REQUIRED_EXIT = 78;
export const RESTORE_VERIFICATION_REQUIRED_MESSAGE = 'Restore verification is incomplete. Start in restore mode and complete a verified restore before normal startup.';

/** Only the schema admission check constructs this typed, non-sensitive failure. */
export class SchemaRestoreVerificationRequiredError extends Error {
  constructor() {
    super('schema_maintenance_restore_verification_required');
    this.name = 'SchemaRestoreVerificationRequiredError';
  }
}
