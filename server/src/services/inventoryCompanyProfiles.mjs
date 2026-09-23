/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { learnInventoryProfiles } from './inventoryLearnedProfiles.mjs';
import { scoreInventoryProfileFields } from './inventoryProfileScoring.mjs';

export const INVENTORY_COMPANY_PROFILE_VERSION = 'production_company_set_v1';
const fields = ['productionCompanies'];

/** Separate model: unknown companies cannot erase genre/studio/rating observations. */
export function learnInventoryCompanyProfiles(documents, metadata, libraries, heldHashes = new Set()) {
  return learnInventoryProfiles(documents, metadata, libraries, heldHashes,
    { fields, version: INVENTORY_COMPANY_PROFILE_VERSION });
}

/** Null is unavailable; this score is not a probability or routing permission. */
export function scoreInventoryCompanyProfile(model, libraryId, metadata) {
  return model ? scoreInventoryProfileFields(model, libraryId, metadata, fields).productionCompanies : null;
}
