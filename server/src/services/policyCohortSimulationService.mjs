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
import {
  evaluateNativePolicyIntent,
} from './policyNativeIntentRuntimeEvaluator.mjs';
import {
  attachActiveNativeIntentForPolicy,
} from './policyNativePolicyReadService.mjs';
import {
  buildPolicyCohortSimulation,
  buildPolicyCohortSimulationCurrentContract,
  buildPolicyCohortSimulationDraftContract,
  buildPolicyCohortSimulationPolicy,
  normalizePolicyCohortSimulationOutcome,
} from './policyCohortSimulationContract.mjs';
import {
  POLICY_COHORT_SIMULATION_MAXIMUM_ITEMS,
  POLICY_COHORT_SIMULATION_WINDOW_DAYS,
  loadPolicyCohortSimulationContext,
  loadPolicyCohortSimulationItems,
} from './policyCohortSimulationPersistence.mjs';

export class PolicyCohortSimulationNotFoundError extends Error {
  constructor() {
    super('Policy not found for cohort simulation.');
    this.name = 'PolicyCohortSimulationNotFoundError';
    this.code = 'POLICY_COHORT_SIMULATION_POLICY_NOT_FOUND';
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return asObject(parsed);
  } catch {
    return {};
  }
}

function metadataList(metadata, keys = []) {
  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function metadataString(metadata, keys = []) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

/**
 * Keeps historic rows inside the server boundary while projecting the minimum
 * metadata shape required by the shared deterministic native-intent evaluator.
 */
export function projectPolicyCohortSimulationItem(row = {}) {
  const metadata = parseJsonObject(row.metadata);
  const tmdb = asObject(metadata.tmdb);
  const omdb = asObject(metadata.omdb);
  const omdbData = asObject(omdb.data);
  const primaryStudio = typeof row.primary_studio_name === 'string' && row.primary_studio_name.trim()
    ? [row.primary_studio_name]
    : [];

  return {
    media_type: row.media_type,
    title: row.title,
    year: row.year,
    genres: asArray(row.genre_names).length > 0
      ? row.genre_names
      : metadataList(metadata, ['genres', 'genre_names']),
    keywords: metadataList(metadata, ['keywords']),
    studios: primaryStudio.length > 0
      ? primaryStudio
      : metadataList(metadata, ['production_companies', 'studios']),
    original_language: metadataString(metadata, ['original_language']) || metadataString(tmdb, ['original_language']),
    certification: metadataString(metadata, ['certification', 'content_rating'])
      || metadataString(tmdb, ['certification'])
      || metadataString(omdbData, ['Rated']),
    rating: metadata.rating ?? metadata.vote_average ?? tmdb.vote_average ?? null,
    runtime: metadata.runtime ?? tmdb.runtime ?? omdbData.Runtime ?? null,
    overview: metadataString(metadata, ['overview']) || metadataString(tmdb, ['overview']),
  };
}

function subtractWindowDays(now, windowDays) {
  const date = now instanceof Date ? new Date(now) : new Date(now);
  date.setUTCDate(date.getUTCDate() - windowDays);
  return date;
}

export class PolicyCohortSimulationService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    windowDays = POLICY_COHORT_SIMULATION_WINDOW_DAYS,
    maximumItems = POLICY_COHORT_SIMULATION_MAXIMUM_ITEMS,
    loadContext = loadPolicyCohortSimulationContext,
    loadItems = loadPolicyCohortSimulationItems,
    attachNativeIntent = attachActiveNativeIntentForPolicy,
    buildCurrentContract = buildPolicyCohortSimulationCurrentContract,
    buildDraftContract = buildPolicyCohortSimulationDraftContract,
    buildPolicy = buildPolicyCohortSimulationPolicy,
    evaluate = evaluateNativePolicyIntent,
    projectItem = projectPolicyCohortSimulationItem,
    buildSimulation = buildPolicyCohortSimulation,
  } = {}) {
    this.db = db;
    this.now = now;
    this.windowDays = windowDays;
    this.maximumItems = maximumItems;
    this.loadContext = loadContext;
    this.loadItems = loadItems;
    this.attachNativeIntent = attachNativeIntent;
    this.buildCurrentContract = buildCurrentContract;
    this.buildDraftContract = buildDraftContract;
    this.buildPolicy = buildPolicy;
    this.evaluate = evaluate;
    this.projectItem = projectItem;
    this.buildSimulation = buildSimulation;
  }

  async simulate({ dbClient = this.db, policyId, draft, now = this.now() } = {}) {
    const persistedPolicy = await this.loadContext({ db: dbClient, policyId });
    if (!persistedPolicy) throw new PolicyCohortSimulationNotFoundError();

    const currentPolicy = await this.attachNativeIntent({
      dbClient,
      policy: persistedPolicy,
    });
    const baselinePolicy = this.buildPolicy({
      policy: currentPolicy,
      contract: this.buildCurrentContract(currentPolicy),
    });
    const proposedPolicy = this.buildPolicy({
      policy: currentPolicy,
      contract: this.buildDraftContract({ policy: currentPolicy, draft }),
    });
    const historicItems = await this.loadItems({
      db: dbClient,
      mediaType: persistedPolicy.library_media_type,
      cutoff: subtractWindowDays(now, this.windowDays),
      maximumItems: this.maximumItems,
    });

    const baselineOutcomes = [];
    const proposedOutcomes = [];
    for (const historicItem of historicItems) {
      const item = this.projectItem(historicItem);
      baselineOutcomes.push(normalizePolicyCohortSimulationOutcome(this.evaluate(baselinePolicy, item)));
      proposedOutcomes.push(normalizePolicyCohortSimulationOutcome(this.evaluate(proposedPolicy, item)));
    }

    return this.buildSimulation({
      context: { policy: persistedPolicy },
      sample: {
        windowDays: this.windowDays,
        maximumItems: this.maximumItems,
        evaluatedItemCount: historicItems.length,
      },
      baselineOutcomes,
      proposedOutcomes,
      evaluatedAt: now,
    });
  }
}

export const policyCohortSimulationService = new PolicyCohortSimulationService();
