/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createLogger } from '../utils/logger.mjs';
import { libraryInventoryProfileRefreshPlanner } from './libraryInventoryProfileRefreshPlanner.mjs';
import {
  policyNativeProfileRefreshPlanner,
} from './policyNativeProfileRefreshPlanner.mjs';
import {
  policyProfileRefreshOutboxWorker,
} from './policyProfileRefreshOutboxWorker.mjs';

const POLICY_PROFILE_REFRESH_AUTOMATION_VERSION =
  'policy.profile_refresh_automation.v1';

const logger = createLogger('PolicyProfileRefreshAutomationService');

class PolicyProfileRefreshAutomationService {
  constructor({
    nativeProfileRefreshPlanner = policyNativeProfileRefreshPlanner,
    inventoryProfileRefreshPlanner = libraryInventoryProfileRefreshPlanner,
    outboxWorker = policyProfileRefreshOutboxWorker,
    loggerInstance = logger,
  } = {}) {
    this.nativeProfileRefreshPlanner = nativeProfileRefreshPlanner;
    this.inventoryProfileRefreshPlanner = inventoryProfileRefreshPlanner;
    this.outboxWorker = outboxWorker;
    this.logger = loggerInstance;
  }

  async run() {
    let inventoryPlanning;
    try {
      inventoryPlanning = await this.inventoryProfileRefreshPlanner.run();
    } catch {
      inventoryPlanning = { statusId: 'failed', reasonId: 'inventory_profile_refresh_planning_failed' };
      this.logger.warn('Inventory profile refresh planning failed', inventoryPlanning);
    }
    let planning;
    try {
      planning = await this.nativeProfileRefreshPlanner.run();
    } catch {
      planning = {
        statusId: 'failed',
        reasonId: 'native_profile_refresh_planning_failed',
      };
      this.logger.warn('Native policy profile refresh planning failed', planning);
    }

    const delivery = await this.outboxWorker.run();
    return {
      version: POLICY_PROFILE_REFRESH_AUTOMATION_VERSION,
      planning,
      inventoryPlanning,
      delivery,
    };
  }
}

const policyProfileRefreshAutomationService = new PolicyProfileRefreshAutomationService();

export {
  PolicyProfileRefreshAutomationService,
  policyProfileRefreshAutomationService,
  POLICY_PROFILE_REFRESH_AUTOMATION_VERSION,
};
