/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInventoryDiscoveryAdmission } from '../../services/inventoryDiscoveryAdmission.mjs';
import { resourceAdmissionFixture } from './resourceAdmissionFixture.mjs';

export function discoveryAdmissionFixture(options) {
  return createInventoryDiscoveryAdmission({
    resourceAdmission: resourceAdmissionFixture(options.readMemory), ...options,
  });
}
