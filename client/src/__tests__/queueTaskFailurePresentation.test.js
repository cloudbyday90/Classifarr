/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from 'vitest'
import { canRetryTask, queueTaskFailureMessage } from '../utils/queueTaskFailurePresentation'

describe('queue failure guidance', () => {
  test('distinguishes confirmed missing identity from legacy unknown metadata cause', () => {
    expect(queueTaskFailureMessage('task_metadata_not_found')).toMatch(/Eligible tasks are rechecked automatically/)
    expect(queueTaskFailureMessage('task_metadata_fetch_failed')).toMatch(/original cause may no longer/)
    expect(queueTaskFailureMessage('task_metadata_fetch_failed')).not.toMatch(/could not find/)
  })
  test('offers Retry for recoverable errors only and explains the lineage refusal', () => {
    expect(canRetryTask({ error_message: 'task_retry_lineage_refused' })).toBe(false)
    expect(canRetryTask({ error_message: 'task_processing_failed' })).toBe(true)
    expect(canRetryTask({ payload: { identity_repair: {} } })).toBe(false)
    expect(queueTaskFailureMessage('task_retry_lineage_refused')).toMatch(/could not verify its original request or webhook links/)
  })
  test.each([undefined, null, {}, 'constructor', '__proto__', '<script>private</script>'])('never reflects arbitrary input %j', value => {
    expect(queueTaskFailureMessage(value)).toBeNull()
  })
})
