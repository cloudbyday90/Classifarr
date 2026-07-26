/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_AUTHORIZED_OUTCOME_RECEIPT_VERSION =
  'policy.authorized_outcome_source_event_receipt.v1';

const POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS = Object.freeze({
  CLAIMED: 'claimed',
  REPLAYED: 'replayed',
  SOURCE_EVENT_MISMATCH: 'source_event_mismatch',
});

const POLICY_AUTHORIZED_OUTCOME_RECEIPT_REASON_IDS = Object.freeze({
  CLAIMED: 'authorized_outcome_source_event_claimed',
  REPLAYED: 'authorized_outcome_source_event_replayed',
  SOURCE_EVENT_MISMATCH: 'authorized_outcome_source_event_payload_mismatch',
});

const POLICY_AUTHORIZED_OUTCOME_RECEIPT_TABLE =
  'policy_authorized_outcome_source_event_receipts';

export {
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS,
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_REASON_IDS,
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_TABLE,
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_VERSION,
};
