/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** A provider observation, not a policy label or an inferred organization role. */
export function normalizeOrganizationName(value) {
  if (typeof value !== 'string' || value.length > 160) return null;
  const name = value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return name && name.length <= 160 ? name : null;
}

function readCompanies(value, maxItems = 32) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const companies = new Map(), ids = new Map();
  for (const item of value) {
    const name = normalizeOrganizationName(typeof item === 'string' ? item : item?.name);
    const id = typeof item === 'object' && item !== null ? item.id : null;
    if (!name || (id != null && (!Number.isSafeInteger(id) || id <= 0))) return null;
    const key = name.toLowerCase();
    if (id != null && ids.has(id) && ids.get(id) !== key) return null;
    if (companies.has(key) && companies.get(key).id != null && id != null && companies.get(key).id !== id) return null;
    if (id != null) ids.set(id, key);
    if (!companies.has(key) || id != null) companies.set(key, { ...(id != null ? { id } : {}), name });
  }
  return [...companies.values()];
}

/** Copy only the two distinct roles. Missing fields stay missing for legacy payloads. */
export function captureOrganizationMetadata(metadata = {}) {
  const result = {};
  if (Object.hasOwn(metadata, 'studio')) result.studio = normalizeOrganizationName(metadata.studio);
  if (Object.hasOwn(metadata, 'production_companies')) result.production_companies = readCompanies(metadata.production_companies) ?? [];
  return result;
}

/** Rechecks may add compatible observations, never choose a studio by company order. */
export function mergeOrganizationMetadata(original = {}, incoming = {}) {
  const left = captureOrganizationMetadata(original), right = captureOrganizationMetadata(incoming);
  const result = { ...left, ...right };
  if (left.studio && right.studio && left.studio.toLowerCase() !== right.studio.toLowerCase()) result.studio = null;
  if (Object.hasOwn(left, 'production_companies') && Object.hasOwn(right, 'production_companies')) {
    const a = readCompanies(original.production_companies), b = readCompanies(incoming.production_companies);
    // Check claims across both sources, not just conflicts inside either list.
    const combined = a && b ? readCompanies([...a, ...b], 64) : null;
    const contains = (superset, subset) => subset.every(company => superset.some(other =>
      company.name.toLowerCase() === other.name.toLowerCase() &&
      (company.id == null || other.id == null || company.id === other.id)));
    const selected = !combined ? [] : contains(b, a) ? b : contains(a, b) ? a : [];
    result.production_companies = selected.map(company => {
      const observed = combined.find(other => other.name.toLowerCase() === company.name.toLowerCase());
      return { ...company, ...(observed.id != null ? { id: observed.id } : {}) };
    });
  }
  return result;
}
