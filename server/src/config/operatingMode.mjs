/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function readOperatingMode(environment = process.env) {
  const mode = environment.CLASSIFARR_RUNTIME_MODE ?? 'normal';
  if (mode !== 'normal' && mode !== 'restore') throw new Error('CLASSIFARR_RUNTIME_MODE must be normal or restore');
  return mode;
}

export function getBackupRuntimeStatus() {
  const mode = readOperatingMode();
  return { mode, restoreAllowed: mode === 'restore', restartRequired: mode === 'restore' };
}
