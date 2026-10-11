/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SourceCombinedEvidence from '@/components/library/SourceCombinedEvidence.vue'
import { parseSourceScopeEvidence } from '@/utils/sourceScopeEvidence'
import { parseCombinedEvidence } from '@/utils/sourceCombinedEvidence'

const scope = { kind: 'whole_work', tmdbId: 10 }
const comparison = { total: 2, matched: 2, exclusions: [] }
const audit = () => ({ version: 'source_combined_evidence.v1', fingerprint: 'f'.repeat(64),
  status: 'catalog_and_scope_agreement', parentBlockers: [], candidateTmdbId: 10,
  scopeComplete: true, proposalMatchesIdentity: true, crossProviderVerified: false, automaticRecoveryEligible: false })

it('projects only bounded diagnostic fields and never renders an action or announces a detail list', () => {
  const value = parseCombinedEvidence({ ...audit(), private: 'secret' }, scope, comparison)
  expect(JSON.stringify(value)).not.toContain('secret')
  const wrapper = mount(SourceCombinedEvidence, { props: { audit: value } })
  expect(wrapper.text()).toContain('No repair or backfill was authorized')
  expect(wrapper.find('button').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  wrapper.unmount()
})
it.each([
  value => { value.version = 'future' }, value => { value.fingerprint = 'private' },
  value => { value.crossProviderVerified = true }, value => { value.automaticRecoveryEligible = true },
  value => { value.parentBlockers = ['private-error'] }, value => { value.parentBlockers = ['no_external_confirmation', 'no_external_confirmation'] },
  value => { value.parentBlockers = null }, value => { value.candidateTmdbId = null },
  value => { value.candidateTmdbId = 0 }, value => { value.candidateTmdbId = 2147483648 },
  value => { value.parentBlockers = ['no_external_confirmation'] }, value => { value.scopeComplete = false },
  value => { value.proposalMatchesIdentity = false }, value => { value.status = 'review_required' },
])('rejects malformed or inconsistent combined evidence', change => {
  const value = audit(); change(value)
  expect(parseCombinedEvidence(value, scope, comparison)).toBeNull()
})
it('shows parent blockers even when every episode matches', () => {
  const value = { ...audit(), status: 'review_required', candidateTmdbId: null,
    parentBlockers: ['missing_catalog_match'], proposalMatchesIdentity: false }
  const wrapper = mount(SourceCombinedEvidence, { props: { audit: parseCombinedEvidence(value, scope, comparison) } })
  expect(wrapper.text()).toContain('does not prove the identifier is stale or wrong')
  expect(wrapper.text()).toContain('Source membership: complete for this proposal')
  wrapper.unmount()
})
it.each(['empty', 'partial', 'grouped', 'wrong-work', 'complete-seasons'])('checks %s against the proposal, not just server flags', mode => {
  const value = audit(), counts = { ...comparison }
  let proposal = scope
  if (mode === 'empty') { counts.total = counts.matched = 0; value.scopeComplete = false }
  if (mode === 'partial') {
    proposal = { kind: 'seasons', coverage: 'partial', mappings: [{ tmdbSeriesId: 10 }] }; value.scopeComplete = false
  }
  if (mode === 'grouped') {
    proposal = { kind: 'seasons', coverage: 'complete', mappings: [{ tmdbSeriesId: 10 }, { tmdbSeriesId: 11 }] }; value.proposalMatchesIdentity = false
  }
  if (mode === 'wrong-work') { proposal = { kind: 'whole_work', tmdbId: 11 }; value.proposalMatchesIdentity = false }
  if (mode === 'complete-seasons') proposal = { kind: 'seasons', coverage: 'complete', mappings: [{ tmdbSeriesId: 10 }] }
  if (mode !== 'complete-seasons') value.status = 'review_required'
  const parsed = parseCombinedEvidence(value, proposal, counts)
  expect(parsed).not.toBeNull()
  const wrapper = mount(SourceCombinedEvidence, { props: { audit: parsed } })
  if (mode === 'grouped') expect(wrapper.text()).toContain('Preserve any intended grouping')
  wrapper.unmount()
})
it('accepts older servers but rejects a malformed included audit', () => {
  const draft = { sourceKey: 'a'.repeat(64), sourceVersion: 'b'.repeat(64), draftFingerprint: 'c'.repeat(64), scope }
  const data = { ...draft, version: 'source_scope_evidence.v1', canApply: false, persisted: false,
    crossProviderVerified: false, verification: 'typed_catalog_membership', backfill: { eligible: false, excludedScope: 'all' },
    reference: '2e851bf4-9497-4b99-8b7c-e8117a05c762', comparison: { ...comparison, unit: 'episode' } }
  expect(parseSourceScopeEvidence(data, draft).combinedAudit).toBeNull()
  expect(parseSourceScopeEvidence({ ...data, combinedAudit: audit() }, draft).combinedAudit.status).toBe('catalog_and_scope_agreement')
  expect(parseSourceScopeEvidence({ ...data, combinedAudit: {} }, draft)).toBeNull()
})
