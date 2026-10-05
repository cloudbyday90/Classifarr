/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest } from './core'

export function getMigrationDiagnostics() {
  return getDataRequest('/libraries/migration-diagnostics')
}
export default { getMigrationDiagnostics }
