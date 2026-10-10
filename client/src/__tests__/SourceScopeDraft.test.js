/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SourceScopeDraft from '@/components/library/SourceScopeDraft.vue'
import { reviewSourceScope } from '@/api/mediaIdentityReviewApi'
vi.mock('@/api/mediaIdentityReviewApi', () => ({ reviewSourceScope: vi.fn() }))
const source = () => ({ key: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), mediaType: 'tv' })
const response = scope => ({ data: { version: 'source_scope_review.v1', sourceKey: source().key,
  sourceVersion: source().sourceVersion, status: 'valid_draft', canApply: false, persisted: false,
  verification: 'structure_only', backfill: { eligible: false, excludedScope: 'all' },
  draftFingerprint: 'c'.repeat(64), scope } })
let wrapper
const render = () => { wrapper = mount(SourceScopeDraft, { props: { source: source(), offset: 0 } }); return wrapper }
beforeEach(() => { vi.clearAllMocks(); reviewSourceScope.mockImplementation(async (_key, { scope }) => response(scope)) })
afterEach(() => wrapper?.unmount())
it('labels fields and submits a whole-series draft without an activation control', async () => {
  render()
  expect(reviewSourceScope).not.toHaveBeenCalled()
  expect(wrapper.findAll('label').every(label => wrapper.find(`[id="${label.attributes('for')}"]`).exists())).toBe(true)
  await wrapper.get('input').setValue('10')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(reviewSourceScope).toHaveBeenCalledWith(source().key, { offset: 0, sourceVersion: source().sourceVersion, scope: { kind: 'whole_work', tmdbId: 10 } })
  expect(wrapper.get('[role="status"]').text()).toContain('Nothing was saved or approved')
  expect(wrapper.text()).toContain('All proposed content is excluded')
  expect(wrapper.text()).toContain('parent identity conflict remains')
  expect(wrapper.findAll('button').some(button => /apply|confirm|save/i.test(button.text()))).toBe(false)
  await wrapper.get('input').setValue('20')
  expect(wrapper.get('[role="status"]').text()).toBe('')
})
it('preserves a partial explicit season scope and allows row editing', async () => {
  render(); await wrapper.get('select').setValue('seasons')
  await wrapper.findAll('input')[0].setValue('0, 1, 2')
  const fields = wrapper.get('fieldset').findAll('input')
  await fields[0].setValue('1'); await fields[1].setValue('10'); await fields[2].setValue('1')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(reviewSourceScope.mock.calls[0][1].scope).toEqual({ kind: 'seasons', coverage: 'partial', sourceSeasonNumbers: [0, 1, 2], mappings: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 }] })
  expect(wrapper.get('[role="status"]').text()).toContain('1 of 3')
  await wrapper.findAll('button').find(button => button.text() === 'Add season mapping').trigger('click')
  expect(wrapper.findAll('fieldset')).toHaveLength(2)
  await wrapper.findAll('button').find(button => button.text() === 'Remove').trigger('click')
  expect(wrapper.findAll('fieldset')).toHaveLength(1)
  expect(wrapper.get('[role="status"]').text()).toBe('')
})
it.each([[409, 'source changed'], [403, 'administrator session'], [401, 'administrator session'],
  [400, 'unique source seasons'], [429, 'Wait before trying'], [503, 'No mapping was saved']])('explains %s without raw server messages', async (status, message) => {
  reviewSourceScope.mockRejectedValue({ response: { status, data: { error: 'private-details' } } })
  render(); await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain(message)
  expect(wrapper.text()).not.toContain('private-details')
})
it.each(['edit', 'revision', 'close', 'unmount'])('discards a pending result after %s', async change => {
  let resolve
  reviewSourceScope.mockImplementation(() => new Promise(done => { resolve = done }))
  render(); await wrapper.get('input').setValue('10'); await wrapper.get('form').trigger('submit')
  if (change === 'edit') await wrapper.get('input').setValue('20')
  if (change === 'revision') await wrapper.setProps({ source: { ...source(), sourceVersion: 'd'.repeat(64) } })
  if (change === 'close') await wrapper.get('details').trigger('toggle')
  if (change === 'unmount') wrapper.unmount()
  resolve(response({ kind: 'whole_work', tmdbId: 10 })); await flushPromises()
  if (change !== 'unmount') expect(wrapper.get('[role="status"]').text()).toBe('')
})
it('withholds malformed or unexpectedly applicable results', async () => {
  const data = response({ kind: 'whole_work', tmdbId: 10 }); data.data.canApply = true
  reviewSourceScope.mockResolvedValue(data)
  render(); await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('unavailable')
})
it('supports movies without TV season choices and resets when the item changes', async () => {
  render(); await wrapper.get('input').setValue('10')
  await wrapper.setProps({ source: { ...source(), key: 'd'.repeat(64), mediaType: 'movie' } })
  expect(wrapper.findAll('option')).toHaveLength(1)
  expect(wrapper.get('input').element.value).toBe('')
  expect(wrapper.text()).toContain('TMDb movie ID')
})
