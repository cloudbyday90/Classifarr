/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export function shouldRunCli(importMeta) {
  return importMeta.main === true;
}

export async function closeDatabasePool(databaseModule = {}) {
  const pool = databaseModule?.pool;
  if (pool && typeof pool.end === 'function') {
    await pool.end();
  }
}

export function failCli() {
  process.exitCode = 1;
}

/* eslint-disable no-console */
export async function runCliMain({
  execute,
  onSuccess,
  shouldFail = () => false,
  failureMessage = 'Command failed',
  cleanup,
}) {
  try {
    const result = await execute();
    await onSuccess?.(result);
    if (shouldFail(result)) {
      failCli();
    }
    return result;
  } catch (err) {
    console.error(`${failureMessage}:`, err.message);
    failCli();
    return null;
  } finally {
    await cleanup?.();
  }
}
