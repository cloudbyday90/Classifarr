/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler.mjs';
import { requireReadWrite } from '../../middleware/apiKeyAuth.mjs';
import { registerExactItemMemoryRoutes } from '../../routes/classificationRouteExactItemMemory.mjs';
import { PolicyRuntimeDestinationEvidenceCommandService } from '../../services/policyRuntimeDestinationEvidenceCommandService.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';

test('manual exact-item HTTP writes and replays only the requested BIGINT History row', async () => {
  const database = createReadinessDatabase();
  const [neighbor, target, maximum] = ['9007199254741092', '9007199254741093', '9223372036854775807'];
  const ids = [neighbor, target, maximum];
  const tmdbIds = [892041, 892042, 892043];
  const fingerprint = 'abcdefghijklmnopqrstuv';
  try {
    const { rows: [destination] } = await database.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
      VALUES ('Owned manual memory destination','manual-memory-id-dst','movie',true) RETURNING id,name`);
    const metadata = { classification_details: { outcome_link: {
      type: 'resolved', source: 'policy_question', final_library_id: destination.id, final_library_name: destination.name,
      runtime_question_answer: {
        action_id: 'confirm_destination', contract_version: 'policy.runtime_question_answer.v1',
        contract_fingerprint: fingerprint, destination_library_id: destination.id,
      },
    } } };
    for (const [index, id] of ids.entries()) {
      metadata.classification_details.outcome_link.runtime_question_answer.classification_id = id;
      await database.query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,library_id,library_name,metadata)
        VALUES($1,$2,$3,'movie','completed',$4,$5,$6::jsonb)`,
      [id, `Owned manual memory ${index}`, tmdbIds[index], destination.id, destination.name, JSON.stringify(metadata)]);
    }

    const app = express();
    app.use((req, _res, next) => {
      if (req.get('x-test-principal') === 'read-only') req.apiKey = { id: 1, permissions: 'read_only' };
      else req.user = { id: 1, username: 'owned-operator' };
      next();
    });
    registerExactItemMemoryRoutes(app, { db: database, logger: createMockLogger(), requireReadWrite });
    app.use(errorHandler);
    const http = request(app);
    const remember = id => http.post(`/history/${id}/exact-item-memory`);
    const receipts = async () => (await database.query(`SELECT id, classification_id, source_event_id, command_fingerprint
      FROM policy_authorized_outcome_source_event_receipts WHERE classification_id=ANY($1::bigint[]) ORDER BY classification_id`, [ids])).rows;
    const evidence = async () => (await database.query(`SELECT id, tmdb_id, library_id FROM classification_evidence
      WHERE scope='item_exact' AND media_type='movie' AND tmdb_id=ANY($1::bigint[]) ORDER BY tmdb_id`, [tmdbIds])).rows;
    const receiptFor = classificationId => expect.objectContaining({
      classification_id: classificationId, source_event_id: `runtime_exact_item_memory:${classificationId}:${fingerprint}`,
    });
    const unboundAnswer = { ...metadata.classification_details.outcome_link.runtime_question_answer };
    delete unboundAnswer.classification_id;
    const replaceAnswer = answer => database.query(`UPDATE classification_history
      SET metadata=jsonb_set(metadata,'{classification_details,outcome_link,runtime_question_answer}',$2::jsonb)
      WHERE id=$1`, [target, JSON.stringify(answer)]);

    await remember(target).set('x-test-principal', 'read-only').expect(403);
    await remember('9007199254741096').expect(404);
    await replaceAnswer(unboundAnswer);
    await remember(target).expect(409);
    await replaceAnswer({ ...unboundAnswer, classification_id: null });
    await remember(target).expect(409);
    expect(await receipts()).toEqual([]);
    expect(await evidence()).toEqual([]);

    await replaceAnswer({ ...unboundAnswer, classification_id: target });
    const first = await remember(target).expect(200);
    expect(first.body).toMatchObject({ status: 'applied', replayed: false, exact_item_memory_recorded: true });
    const savedReceipts = await receipts();
    const savedEvidence = await evidence();
    expect(savedReceipts).toEqual([receiptFor(target)]);
    expect(savedEvidence).toEqual([expect.objectContaining({ tmdb_id: tmdbIds[1], library_id: destination.id })]);

    const replay = await remember(target).expect(200);
    expect(replay.body).toMatchObject({ status: 'replayed', replayed: true, exact_item_memory_recorded: false });
    await replaceAnswer({ ...unboundAnswer, classification_id: neighbor });
    await remember(target).expect(409);
    const destinationEvidence = new PolicyRuntimeDestinationEvidenceCommandService({ db: database });
    expect(await destinationEvidence.execute({ classificationId: target, actorId: 'owned-operator' })).toMatchObject({
      statusId: 'not_admitted', reasonCodes: ['runtime_exact_item_memory_invalid_runtime_answer'], execution: null,
    });
    await remember(`${neighbor}text`).expect(400);
    expect(await receipts()).toEqual(savedReceipts);
    expect(await evidence()).toEqual(savedEvidence);

    await remember(neighbor).expect(200);
    await remember(maximum).expect(200);
    expect(await receipts()).toEqual([receiptFor(neighbor), savedReceipts[0], receiptFor(maximum)]);
    expect((await evidence()).map(row => row.tmdb_id)).toEqual(tmdbIds);
  } finally {
    await database.pool.end();
  }
});
