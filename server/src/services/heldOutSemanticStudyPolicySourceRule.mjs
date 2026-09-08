/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

/**
 * Profile-derived purpose describes observed library contents. It cannot
 * establish the independent policy source required by a held-out study.
 */
export function isHeldOutSemanticStudyExcludedInferredProfileRule(rule = {}) {
  return rule?.source === 'media_server_library_profile' &&
    rule?.inference_state === 'inferred';
}
