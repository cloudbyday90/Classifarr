/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS = 100;

function normalizeMaximumCollectionItems(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS;
  }

  return Math.min(Math.floor(numeric), MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS);
}

function buildPolicyEvidenceBoundedCollection(value, {
  maximumCollectionItems = MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS,
} = {}) {
  const items = Array.isArray(value) ? value : [];
  const maximumItems = normalizeMaximumCollectionItems(maximumCollectionItems);

  return {
    items: items.slice(0, maximumItems),
    itemCount: items.length,
    maximumItems,
    exceedsLimit: items.length > maximumItems,
  };
}

export {
  MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS,
  buildPolicyEvidenceBoundedCollection,
  normalizeMaximumCollectionItems,
};
