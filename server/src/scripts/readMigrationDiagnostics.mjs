/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import '../config/env.mjs';
import { readMigrationDiagnostic } from '../services/migrationDiagnosticReader.mjs';

// Does not load database configuration, open a database connection or run migrations.
export async function runMigrationDiagnosticCommand({ args = process.argv.slice(2), read = readMigrationDiagnostic, output = value => process.stdout.write(`${value}\n`) } = {}) {
  if (args.length) {
    output('Usage: node src/scripts/readMigrationDiagnostics.mjs (read only; run with the maintenance identity and existing app-data mount)');
    return args.length === 1 && args[0] === '--help' ? 0 : 2;
  }
  try {
    const result = await read();
    output(JSON.stringify(result, null, 2));
    return result.status === 'available' ? 0 : 1;
  } catch {
    output('{"status":"unavailable"}');
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runMigrationDiagnosticCommand();
