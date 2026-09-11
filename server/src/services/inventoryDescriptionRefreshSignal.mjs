/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// A local hint only. Periodic current-inventory reconciliation remains authoritative.
let revision = 0;
export function requestInventoryDescriptionRefresh() { revision = (revision + 1) % Number.MAX_SAFE_INTEGER; }
export function getInventoryDescriptionRefreshRevision() { return revision; }
