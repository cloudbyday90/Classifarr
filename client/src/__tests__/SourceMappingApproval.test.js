/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SourceMappingApproval from '@/components/library/SourceMappingApproval.vue'
import SourceScopeEvidence from '@/components/library/SourceScopeEvidence.vue'
import { approveSourceScope, inspectSourceScope } from '@/api/mediaIdentityReviewApi'
vi.mock('@/api/mediaIdentityReviewApi', () => ({ approveSourceScope: vi.fn(), inspectSourceScope: vi.fn() }))
const id = '2e851bf4-9497-4b99-8b7c-e8117a05c762'
const draft = () => ({ sourceKey: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), draftFingerprint: 'c'.repeat(64), scope: { kind: 'whole_work', tmdbId: 10 } })
let wrapper
const render = () => { wrapper = mount(SourceMappingApproval, { props: { draft: draft(), offset: 0, evidence: { evidenceFingerprint: 'd'.repeat(64) } } }); return wrapper }
beforeEach(() => { vi.clearAllMocks(); approveSourceScope.mockResolvedValue({ data: { version: 'source_mapping_approval.v1', mappingId: id, status: 'approved', materialized: false } }) })
afterEach(() => wrapper?.unmount())
it('requires explicit consent and describes pending recovery rather than completed repair', async () => {
  render(); expect(approveSourceScope).not.toHaveBeenCalled()
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  await wrapper.get('input').setValue(true); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(approveSourceScope).toHaveBeenCalledWith(draft().sourceKey, { confirmed: true, offset: 0,
    sourceVersion: draft().sourceVersion, scope: draft().scope, evidenceFingerprint: 'd'.repeat(64) }, expect.any(AbortSignal))
  expect(wrapper.get('[role="status"]').text()).toContain('remains unresolved until a scheduled library sync')
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
})
it.each([409, 403, 503, null])('does not replay an uncertain or refused approval (%s)', async status => {
  approveSourceScope.mockRejectedValue({ response: { status, data: { error: 'private response' } } })
  render(); await wrapper.get('input').setValue(true); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('saved mappings')
  expect(wrapper.text()).not.toContain('private response')
  await wrapper.get('button').trigger('click'); expect(approveSourceScope).toHaveBeenCalledTimes(1)
})
it('rejects a malformed success response', async () => {
  approveSourceScope.mockResolvedValue({ data: { status: 'approved' } })
  render(); await wrapper.get('input').setValue(true); await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('could not be confirmed')
})
it.each(['edit', 'unmount'])('ignores a late response after %s', async mode => {
  const waiting = Promise.withResolvers(); approveSourceScope.mockReturnValue(waiting.promise)
  render(); await wrapper.get('input').setValue(true); await wrapper.get('button').trigger('click')
  const signal = approveSourceScope.mock.calls[0][2]
  if (mode === 'edit') await wrapper.setProps({ offset: 50 }); else wrapper.unmount()
  expect(signal.aborted).toBe(true)
  waiting.resolve({ data: { version: 'source_mapping_approval.v1', mappingId: id, status: 'approved', materialized: false } }); await flushPromises()
  if (mode === 'edit') expect(wrapper.text()).not.toContain('Mapping saved')
})
it.each(['complete', 'partial', 'missing', 'empty'])('only offers approval for complete nonempty evidence: %s', async mode => {
  const current = draft()
  if (mode === 'partial') current.scope = { kind: 'seasons', coverage: 'partial' }
  inspectSourceScope.mockResolvedValue({ data: { ...current, version: 'source_scope_evidence.v1', canApply: false,
    persisted: false, crossProviderVerified: false, verification: 'typed_catalog_membership',
    evidenceFingerprint: mode === 'missing' ? null : 'd'.repeat(64), reference: id, backfill: { eligible: false, excludedScope: 'all' },
    comparison: { unit: 'episode', total: mode === 'empty' ? 0 : 2, matched: mode === 'empty' ? 0 : 2, exclusions: [] } } })
  wrapper = mount(SourceScopeEvidence, { props: { draft: current, offset: 0 } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(SourceMappingApproval).exists()).toBe(mode === 'complete')
})
