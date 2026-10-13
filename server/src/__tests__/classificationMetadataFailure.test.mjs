/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ClassificationMetadataFailure, classificationMetadataFailureReason, classificationMetadataFailureLogFields } from '../services/classificationMetadataFailure.mjs';

test.each([
  [404, 'task_metadata_not_found'], [401, 'task_metadata_fetch_failed'],
  [429, 'task_metadata_fetch_failed'], [503, 'task_metadata_fetch_failed'],
  [undefined, 'task_metadata_fetch_failed'],
])('keeps only sanitized details failure %s', (status, reason) => {
  const error = new ClassificationMetadataFailure(Object.assign(new Error('private-token'), {
    response: { status, data: 'secret' }, config: { url: 'private-url' },
  }));
  expect(classificationMetadataFailureReason(error)).toBe(reason);
  expect(error.message).toBe('Classification metadata lookup failed');
  expect(error.cause).toBeUndefined();
  expect(JSON.stringify(error)).not.toMatch(/private|secret/);
  expect(classificationMetadataFailureLogFields(error)).toMatchObject({ metadataFailure: error.observation,
    reasonCode: reason, provider: 'tmdb', operation: 'details', tmdbId: null, mediaType: null,
    failureReference: expect.stringMatching(/^[a-f0-9-]{36}$/) });
  expect(classificationMetadataFailureLogFields(error).metadataFailure.httpStatus).toBe(status ?? null);
});

test('non-details 404 is not a missing identity and arbitrary errors cannot claim this boundary', () => {
  expect(classificationMetadataFailureReason(new ClassificationMetadataFailure({ response: { status: 404 } }, false)))
    .toBe('task_metadata_fetch_failed');
  for (const error of [null, {}, new Error('404'), { response: { status: 404 } }, { reasonCode: 'task_metadata_not_found' }]) {
    expect(classificationMetadataFailureReason(error)).toBeNull();
    expect(classificationMetadataFailureLogFields(error)).toEqual({});
  }
});

test('lookup identity and reference are bounded, repeatable and independent of task credentials', () => {
  const error = new ClassificationMetadataFailure({ code: 'ERR_CANCELED', message: 'private' }, false,
    { tmdbId: '00042', mediaType: ' TV ', authorization: 'private' });
  const fields = classificationMetadataFailureLogFields(error, '123');
  expect(fields).toMatchObject({ taskId: 123, tmdbId: 42, mediaType: 'tv', operation: 'enrichment',
    reasonCode: 'task_metadata_fetch_failed', metadataFailure: { category: 'cancelled' } });
  expect(classificationMetadataFailureLogFields(error).failureReference).toBe(fields.failureReference);
  for (const taskId of [null, true, {}, -1, 1.5, 'secret', '9'.repeat(50)]) {
    expect(classificationMetadataFailureLogFields(error, taskId)).not.toHaveProperty('taskId');
  }
  expect(JSON.stringify(fields)).not.toContain('private');
  expect(classificationMetadataFailureLogFields(new ClassificationMetadataFailure({}, true,
    { tmdbId: 'secret', mediaType: 'secret' }))).toMatchObject({ tmdbId: null, mediaType: null });
});
