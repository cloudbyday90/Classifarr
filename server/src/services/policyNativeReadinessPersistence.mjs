/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function toReadinessRouting(mapping = {}) {
  const rootFolderPath = typeof mapping.arr_root_folder_path === 'string'
    ? mapping.arr_root_folder_path.trim()
    : '';
  const arrType = typeof mapping.arr_type === 'string' ? mapping.arr_type.trim() : '';
  const configured = Boolean(mapping.arr_config_id && rootFolderPath && arrType);

  return {
    configured,
    routeReady: configured,
    targetName: configured ? `${arrType} library mapping` : null,
  };
}

async function fetchPolicyNativeReadinessContext(dbClient, policyId) {
  const policyResult = await dbClient.query(`
    SELECT id, library_id
    FROM library_policies
    WHERE id = $1
  `, [policyId]);
  const policy = policyResult.rows?.[0] || null;
  if (!policy) return null;

  const mappingResult = await dbClient.query(`
    SELECT arr_type, arr_config_id, arr_root_folder_path
    FROM library_arr_mappings
    WHERE library_id = $1
    LIMIT 1
  `, [policy.library_id]);

  return {
    policy: {
      id: policy.id,
      libraryId: policy.library_id,
    },
    routing: toReadinessRouting(mappingResult.rows?.[0]),
  };
}

export {
  fetchPolicyNativeReadinessContext,
  toReadinessRouting,
};
