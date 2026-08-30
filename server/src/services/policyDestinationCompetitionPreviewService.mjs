/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { evaluateNativePolicyIntent } from './policyNativeIntentRuntimeEvaluator.mjs';
import {
  attachActiveNativeIntentsForPolicies,
} from './policyNativePolicyReadService.mjs';
import {
  buildPolicyCohortSimulationCurrentContract,
  buildPolicyCohortSimulationDraftContract,
  buildPolicyCohortSimulationPolicy,
} from './policyCohortSimulationContract.mjs';
import {
  POLICY_COHORT_SIMULATION_MAXIMUM_ITEMS,
  POLICY_COHORT_SIMULATION_WINDOW_DAYS,
  loadPolicyCohortSimulationContext,
  loadPolicyCohortSimulationItems,
} from './policyCohortSimulationPersistence.mjs';
import {
  buildPolicyDestinationCompetitionPreview,
} from './policyDestinationCompetitionPreviewContract.mjs';
import {
  buildPolicyDestinationCompetitionComparisonCoverage,
} from './policyDestinationCompetitionComparisonCoverage.mjs';
import {
  buildPolicyDestinationCompetitionSharedEligibilityExplanation,
} from './policyDestinationCompetitionSharedEligibilityExplanation.mjs';
import {
  POLICY_DESTINATION_COMPETITION_MAXIMUM_COMPETITORS,
  loadPolicyDestinationCompetitionCompetitors,
} from './policyDestinationCompetitionPreviewPersistence.mjs';
import {
  projectPolicyCohortSimulationItem,
} from './policyCohortSimulationService.mjs';

export class PolicyDestinationCompetitionPreviewNotFoundError extends Error {
  constructor() {
    super('Policy not found for destination competition preview.');
    this.name = 'PolicyDestinationCompetitionPreviewNotFoundError';
    this.code = 'POLICY_DESTINATION_COMPETITION_PREVIEW_POLICY_NOT_FOUND';
  }
}

function subtractWindowDays(now, windowDays) {
  const date = now instanceof Date ? new Date(now) : new Date(now);
  date.setUTCDate(date.getUTCDate() - windowDays);
  return date;
}

function isEligible(evaluation) {
  return evaluation?.eligible === true;
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

export class PolicyDestinationCompetitionPreviewService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    windowDays = POLICY_COHORT_SIMULATION_WINDOW_DAYS,
    maximumItems = POLICY_COHORT_SIMULATION_MAXIMUM_ITEMS,
    maximumCompetitors = POLICY_DESTINATION_COMPETITION_MAXIMUM_COMPETITORS,
    loadContext = loadPolicyCohortSimulationContext,
    loadItems = loadPolicyCohortSimulationItems,
    loadCompetitors = loadPolicyDestinationCompetitionCompetitors,
    attachNativeIntents = attachActiveNativeIntentsForPolicies,
    buildCurrentContract = buildPolicyCohortSimulationCurrentContract,
    buildDraftContract = buildPolicyCohortSimulationDraftContract,
    buildPolicy = buildPolicyCohortSimulationPolicy,
    evaluate = evaluateNativePolicyIntent,
    projectItem = projectPolicyCohortSimulationItem,
    buildPreview = buildPolicyDestinationCompetitionPreview,
    buildComparisonCoverage = buildPolicyDestinationCompetitionComparisonCoverage,
    buildSharedEligibilityExplanation = buildPolicyDestinationCompetitionSharedEligibilityExplanation,
  } = {}) {
    this.db = db;
    this.now = now;
    this.windowDays = windowDays;
    this.maximumItems = maximumItems;
    this.maximumCompetitors = asNonNegativeInteger(maximumCompetitors);
    this.loadContext = loadContext;
    this.loadItems = loadItems;
    this.loadCompetitors = loadCompetitors;
    this.attachNativeIntents = attachNativeIntents;
    this.buildCurrentContract = buildCurrentContract;
    this.buildDraftContract = buildDraftContract;
    this.buildPolicy = buildPolicy;
    this.evaluate = evaluate;
    this.projectItem = projectItem;
    this.buildPreview = buildPreview;
    this.buildComparisonCoverage = buildComparisonCoverage;
    this.buildSharedEligibilityExplanation = buildSharedEligibilityExplanation;
  }

  async preview({ dbClient = this.db, policyId, draft, now = this.now() } = {}) {
    const persistedPolicy = await this.loadContext({ db: dbClient, policyId });
    if (!persistedPolicy) throw new PolicyDestinationCompetitionPreviewNotFoundError();

    const proposedContract = this.buildDraftContract({ policy: persistedPolicy, draft });
    const proposedPolicy = this.buildPolicy({
      policy: persistedPolicy,
      contract: proposedContract,
    });
    const [loadedCompetitors, historicItems] = await Promise.all([
      this.loadCompetitors({
        db: dbClient,
        policyId: persistedPolicy.id,
        mediaType: persistedPolicy.library_media_type,
        maximumCompetitors: this.maximumCompetitors,
      }),
      this.loadItems({
        db: dbClient,
        mediaType: persistedPolicy.library_media_type,
        cutoff: subtractWindowDays(now, this.windowDays),
        maximumItems: this.maximumItems,
      }),
    ]);
    const additionalActiveCompetitorsExcluded = loadedCompetitors.length > this.maximumCompetitors;
    const persistedCompetitors = loadedCompetitors.slice(0, this.maximumCompetitors);
    const attachedCompetitors = await this.attachNativeIntents({
      dbClient,
      policies: persistedCompetitors,
    });
    const competitorContracts = attachedCompetitors.map(policy => this.buildCurrentContract(policy));
    const competitorPolicies = attachedCompetitors.map((policy, index) => this.buildPolicy({
      policy,
      contract: competitorContracts[index],
    }));
    const proposedEligibility = [];
    const competitorEligibility = [];

    for (const historicItem of historicItems) {
      const item = this.projectItem(historicItem);
      proposedEligibility.push(isEligible(this.evaluate(proposedPolicy, item)));
      competitorEligibility.push(competitorPolicies.some(
        competitorPolicy => isEligible(this.evaluate(competitorPolicy, item)),
      ));
    }

    return this.buildPreview({
      sample: {
        windowDays: this.windowDays,
        maximumItems: this.maximumItems,
        evaluatedItemCount: historicItems.length,
      },
      proposedEligibility,
      competitorEligibility,
      comparisonCoverage: this.buildComparisonCoverage({
        comparedActiveCompetitorPolicyCount: competitorPolicies.length,
        maximumCompetitorPolicyCount: this.maximumCompetitors,
        additionalActiveCompetitorsExcluded,
      }),
      sharedEligibilityExplanation: this.buildSharedEligibilityExplanation({
        sharedEligibleItemCount: proposedEligibility.reduce((count, proposedEligible, index) => (
          proposedEligible && competitorEligibility[index] ? count + 1 : count
        ), 0),
        proposedContract,
        competitorContracts,
      }),
      activeCompetitorPolicyCount: competitorPolicies.length,
      maximumCompetitorPolicies: this.maximumCompetitors,
      additionalActiveCompetitorsExcluded,
      evaluatedAt: now,
    });
  }
}

export const policyDestinationCompetitionPreviewService =
  new PolicyDestinationCompetitionPreviewService();
