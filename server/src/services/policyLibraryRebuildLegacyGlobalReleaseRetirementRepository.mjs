/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

async function loadPolicyLibraryRebuildLegacyEnabledPolicyInventory({ client } = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Global legacy-path retirement requires a transaction client.');
  }

  const result = await client.query(
    `SELECT id AS policy_id, library_id
     FROM library_policies
     WHERE enabled = TRUE
     ORDER BY id ASC
     FOR SHARE`,
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

export {
  loadPolicyLibraryRebuildLegacyEnabledPolicyInventory,
};
