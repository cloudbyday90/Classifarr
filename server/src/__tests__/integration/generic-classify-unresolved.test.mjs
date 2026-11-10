/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';
import { buildPolicyRuntimeQuestionAnswerContract, parsePolicyRuntimeQuestionAnswer } from '../../services/policyRuntimeQuestionAnswerContract.mjs';

let database;
// Real production transaction factory; connect only to this suite's disposable database.
jest.unstable_mockModule('../../config/database.mjs', () => ({
  query: (...args) => database.query(...args), withTransaction: (...args) => database.withTransaction(...args),
}));
jest.unstable_mockModule('../../services/classification.mjs', () => ({ classificationService: {} }));
jest.unstable_mockModule('../../services/embeddingService.mjs', () => ({ embeddingService: { generateAndStore: jest.fn() } }));
const { AIResponseParser } = await import('../../services/aiResponseParser.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const { resolvePolicyQuestion } = await import('../../services/clarificationPolicyResolution.mjs');
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, () => {}]));
const parser = new AIResponseParser({ logger });
const metadata = { title: 'Owned unresolved persistence', tmdb_id: 884412, media_type: 'movie' };
const context = { extractQuestionContext: () => ({}), getPolicyQuestionContextVersion: async () => 1,
  stampPolicyQuestionContext: value => value, isPolicyQuestionStale: () => false };
const persistence = new ClassificationPersistenceService({ policyQuestionContext: context });
let libraries;

describe('fresh generic unresolved lifecycle', () => {
  beforeAll(() => { database = createReadinessDatabase(); });
  afterAll(async () => { await database.pool.end(); });
  afterEach(async () => {
    await getPool().query('DELETE FROM classification_history WHERE tmdb_id=$1', [metadata.tmdb_id]);
    await getPool().query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries.map(library => library.id)]);
  });
  beforeEach(async () => {
    libraries = (await getPool().query(`INSERT INTO libraries(name,external_id,media_type,is_active)
      VALUES('First arbitrary label','unresolved-first','movie',true),
      ('Movies','unresolved-second','movie',true) RETURNING *`)).rows;
  });

  async function pending(response) {
    const result = parser.parse(response, { metadata, libraries,
      signalContext: { confidence: 99, suggestedLibrary: libraries[1], breakdown: [] } }, { mode: 'classify' });
    expect(result.library).toBeNull();
    result.method = 'ai_analysis';
    result.policy_question = normalizePolicyRuntimeQuestion({ question: result.policy_question || result.clarification,
      metadata, libraries, result });
    const id = await persistence.logClassification(metadata, result);
    const row = (await getPool().query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
    expect(row).toMatchObject({ status: 'awaiting_decision', library_id: null, library_name: null });
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question: row.policy_question });
    expect(contract.recommendation.leading_destination).toBeNull();
    const parsed = parsePolicyRuntimeQuestionAnswer({ contract_version: contract.version, contract_fingerprint: contract.fingerprint,
      action_id: 'confirm_destination', destination_library_id: libraries[0].id });
    expect(parsed.ok).toBe(true);
    return { row, answer: parsed.answer };
  }
  const resolve = (row, answer, policyContext = context) => resolvePolicyQuestion(row.id, answer.destinationLibraryId,
    null, 'owned-operator', false, { policyQuestionContext: policyContext, answerContract: answer });

  test.each([null, 'Invalid narrative response', 'CLARIFY|Ambiguous|Insufficient support|Choose?|1|2',
    JSON.stringify({ decision: 'CLARIFY', problem_summary: 'Ambiguous', why_uncertain: 'Insufficient support',
      question: 'Choose?', options: [1, 2] }),
  ])('NULL pending destination resolves only by explicit choice and exact replay: %s', async response => {
    const { row, answer } = await pending(response);
    const first = await resolve(row, answer);
    expect(first).toMatchObject({ success: true, shouldRoute: true, libraryId: libraries[0].id });
    const saved = (await getPool().query('SELECT * FROM classification_history WHERE id=$1', [row.id])).rows[0];
    expect(saved).toMatchObject({ status: 'completed', library_id: libraries[0].id, policy_question: null });
    expect(await resolve(row, answer)).toMatchObject({ alreadyResolved: true, idempotent: true, shouldRoute: false });
    await expect(resolve(row, { ...answer, contractFingerprint: 'different-receipt' })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('stale question and inactive destination refuse without completing the pending row', async () => {
    const { row, answer } = await pending('Invalid narrative response');
    await expect(resolve(row, answer, { ...context, isPolicyQuestionStale: () => true }))
      .rejects.toMatchObject({ statusCode: 409 });
    await getPool().query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[0].id]);
    await expect(resolve(row, answer)).rejects.toMatchObject({ statusCode: 400 });
    expect((await getPool().query('SELECT status,library_id FROM classification_history WHERE id=$1', [row.id])).rows[0])
      .toEqual({ status: 'awaiting_decision', library_id: null });
    await expect(getPool().query("UPDATE classification_history SET status='completed' WHERE id=$1", [row.id]))
      .rejects.toMatchObject({ code: '23514' });
  });
});
