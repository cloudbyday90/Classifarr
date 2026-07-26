/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function listActiveDeclaredIdentityRules({
  client,
  libraryId,
  signalType,
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Identity authority resolution requires a transaction client.');
  }

  const result = await client.query(
    `SELECT
       intent.id AS intent_id,
       intent.policy_id,
       intent.library_id,
       intent.intent_version,
       rule.signal_type,
       rule.operator,
       rule.values
     FROM policy_intents AS intent
     INNER JOIN policy_intent_rules AS rule ON rule.intent_id = intent.id
     WHERE intent.library_id = $1
       AND intent.active = TRUE
       AND intent.source = 'native_intent'
       AND intent.inference_state = 'inferred'
       AND intent.validation_status IN ('valid', 'warning')
       AND rule.intent_role = 'purpose'
       AND rule.collection = 'purpose'
       AND rule.semantics = 'identity'
       AND rule.signal_type = $2
     FOR SHARE OF intent, rule`,
    [libraryId, signalType],
  );

  return asArray(result?.rows);
}

const policyIdentityEvidenceAuthorityRepository = Object.freeze({
  listActiveDeclaredIdentityRules,
});

export {
  listActiveDeclaredIdentityRules,
  policyIdentityEvidenceAuthorityRepository,
};
