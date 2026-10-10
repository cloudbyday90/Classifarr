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
  expect(classificationMetadataFailureLogFields(error)).toEqual({ metadataFailure: error.observation });
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
