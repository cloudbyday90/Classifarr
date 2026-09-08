/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * A configuration restore invalidates both derived lifecycle cursors. Neither
 * table is portable backup data: they contain only aggregate provenance used
 * to decide whether a later, private audit must be re-run.
 */
export async function resetHeldOutSemanticStudyLifecycleStateForRestore({ client }) {
  await client.query('DELETE FROM held_out_semantic_study_lifecycle_reaudit_state');
  await client.query('DELETE FROM held_out_semantic_study_lifecycle_source_checkpoint');
}
