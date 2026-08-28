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
  buildNativeIntentReconciliationPurposeSuggestion,
} from './nativeIntentReconciliationPurposeSuggestionContract.mjs';
import {
  loadNativeIntentReconciliationPurposeSuggestionRecord,
} from './nativeIntentReconciliationPurposeSuggestionPersistence.mjs';

export class NativeIntentReconciliationPurposeSuggestionService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    loadRecord = loadNativeIntentReconciliationPurposeSuggestionRecord,
    buildSuggestion = buildNativeIntentReconciliationPurposeSuggestion,
  } = {}) {
    this.db = db;
    this.now = now;
    this.loadRecord = loadRecord;
    this.buildSuggestion = buildSuggestion;
  }

  async getSuggestion({ dbClient = this.db, policyId, now = this.now() } = {}) {
    const record = await this.loadRecord({ db: dbClient, policyId });
    return this.buildSuggestion({ record, now });
  }
}

export const nativeIntentReconciliationPurposeSuggestionService =
  new NativeIntentReconciliationPurposeSuggestionService();
