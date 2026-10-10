/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from 'vitest'
import { queueTaskFailureMessage } from '../utils/queueTaskFailurePresentation'

describe('queue failure guidance', () => {
  test('distinguishes confirmed missing identity from legacy unknown metadata cause', () => {
    expect(queueTaskFailureMessage('task_metadata_not_found')).toMatch(/Verify the TMDb ID/)
    expect(queueTaskFailureMessage('task_metadata_fetch_failed')).toMatch(/original cause may no longer/)
    expect(queueTaskFailureMessage('task_metadata_fetch_failed')).not.toMatch(/could not find/)
  })
  test.each([undefined, null, {}, 'constructor', '__proto__', '<script>private</script>'])('never reflects arbitrary input %j', value => {
    expect(queueTaskFailureMessage(value)).toBeNull()
  })
})
