/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'
import { URL } from 'node:url'
import { pendingReviewReference } from '../src/__tests__/fixtures/pendingReviewReference.js'
import { createUnresolvedClassifyFallback } from '../../server/src/services/genericClassifyUnresolved.mjs'
import { normalizePolicyRuntimeQuestion } from '../../server/src/services/policyRuntimeQuestionNormalizer.mjs'
import { buildPolicyRuntimeQuestionAnswerContract } from '../../server/src/services/policyRuntimeQuestionAnswerContract.mjs'
import { buildUnresolvedRecoveryAdvice } from '../../server/src/services/recoveryUnresolvedAdvice.mjs'
import { buildProviderRecovery } from '../../server/src/services/classificationProviderRecovery.mjs'
import { composePolicyCandidateEvidenceCard } from '../../server/src/services/policyCandidateEvidenceCard.mjs'
import { unknownReviewPurpose } from '../../server/src/services/currentPolicyReviewFrameContract.mjs'
import { evaluateClassificationRouteSafety, buildClassificationRouteSafetyProjection } from '../../server/src/services/classificationRouteSafetyGate.mjs'

test('disagreement stays compact, keyboard accessible and explicit at narrow widths', async ({ page }, testInfo) => {
  const writes = []
  const policyName = `Comedy ${'LongLibraryName'.repeat(8)}`
  const advisoryName = `Movies ${'AnotherLongLibraryName'.repeat(5)}`
  const id = '9223372036854775807'
  const staleId = '9223372036854775806'
  const answer = { ...pendingReviewReference({ policyName, advisoryName }), candidate_item: { classification_id: id } }
  const stale = {
    id: staleId, title: 'Saved review requires refresh', media_type: 'movie',
    policy_question_stale: true, policy_question_stale_reason: 'policy_context_invalid',
    policy_question_current_context_version: null, policy_question_answer: null,
    policy_question: { question: 'Saved question', options: [{ library_id: { toString: null } }] },
  }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let data = {}, status = 200
    if (request.method() !== 'GET') {
      writes.push({ path, method: request.method(), body: request.postDataJSON() })
      data = path === '/api/classification/retry' ? { results: [{ queued: true }] }
        : { success: true, routed: false, libraryName: advisoryName }
    } else {
      if (path === '/api/setup/status') data = { setupRequired: false }
      if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
      if (path === '/api/notifications') data = { data: [] }
      if (path === '/api/notifications/unread-count') data = { unread: 0 }
      if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
      if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
      if (path === '/api/classification/pending') data = { items: [{ id, title: 'Synthetic review', year: 2026,
        media_type: 'movie', confidence: 100, library_name: 'Mutable unrelated label', policy_question_stale: false,
        policy_question: { question: 'Old contradictory prompt' }, policy_question_answer: answer }, stale] }
      if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
      if (path.includes('native-intent-reconciliation') || path.includes('held-out-semantic')) status = 403
    }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const card = page.locator('#needs-attention .action-item').first()
  await expect(card).toContainText('Choose a destination for this item.')
  await expect(card).not.toContainText('Mutable unrelated label')
  await expect(card).not.toContainText('100% confidence')
  await expect(card.getByRole('button', { name: /^Confirm / })).toHaveCount(0)
  await expect(card.locator('.pending-question-review-summary')).toContainText(`Policy evidence points to ${policyName}; the AI comparison suggests ${advisoryName}.`)
  const evidence = card.locator('.review-evidence-and-safeguards')
  await expect(evidence).not.toHaveAttribute('open')
  const disclosure = evidence.locator(':scope > summary')
  await disclosure.focus()
  await expect(disclosure).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(evidence).toHaveAttribute('open', '')
  await expect(evidence).toContainText(`Advisory destination: ${advisoryName}`)
  await expect(evidence.locator('.technical-review-details')).not.toHaveAttribute('open')
  expect(writes).toEqual([])
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await card.scrollIntoViewIfNeeded()
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await card.screenshot({ path: testInfo.outputPath('review-mobile.png') })
  const candidates = card.locator('.alternative-destinations')
  await candidates.locator(':scope > summary').focus()
  await page.keyboard.press('Space')
  const select = candidates.getByRole('button', { name: `Use ${advisoryName}`, exact: true })
  await expect(select).toBeVisible()
  await select.focus()
  await expect(select).toBeFocused()
  expect(writes).toEqual([])
  await page.keyboard.press('Enter')
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toEqual({ path: `/api/classification/pending/${id}/resolve`, method: 'POST', body: {
    contract_version: 'policy.runtime_question_answer.v1', contract_fingerprint: 'abcdefghijklmnopqrstuv',
    action_id: 'confirm_destination', destination_library_id: 8 } })
  const staleCard = page.locator('#needs-attention .action-item').filter({ hasText: stale.title })
  await expect(staleCard.getByRole('status')).toContainText('must be refreshed')
  await expect(staleCard.getByRole('button', { name: /^Confirm / })).toHaveCount(0)
  const retry = staleCard.getByRole('button', { name: 'Retry Classification', exact: true })
  await retry.focus()
  await expect(retry).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1]).toEqual({ path: '/api/classification/retry', method: 'POST', body: { classificationIds: [staleId], options: {} } })
})

test('pending review refresh distinguishes loading, unreadable context and a confirmed empty list', async ({ page }) => {
  const writes = []
  let snapshots = 0
  let mode = 'outage'
  let releaseInitial
  const initialRead = new Promise(resolve => { releaseInitial = resolve })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let data = {}, status = 200
    if (request.method() !== 'GET') writes.push(path)
    if (path === '/api/setup/status') data = { setupRequired: false }
    if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
    if (path === '/api/notifications') data = { data: [] }
    if (path === '/api/notifications/unread-count') data = { unread: 0 }
    if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
    if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
    if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    if (path === '/api/classification/pending') {
      snapshots += 1
      if (snapshots === 1) await initialRead
      if (mode === 'outage') {
        status = 503
        data = { code: 'pending_reviews_unavailable' }
      } else if (mode === 'partial') {
        data = { count: 1, items: [{ id: 79, title: 'Unreadable context', media_type: 'movie',
          policy_question_stale: true, policy_question_stale_reason: 'policy_context_unavailable', policy_question_answer: null }] }
      } else {
        data = { count: 0, items: [] }
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })

  await page.goto('/')
  const pending = page.locator('#needs-attention')
  const exhaustedTransport = page.waitForResponse(response => response.status() === 503 &&
    new URL(response.url()).pathname === '/api/classification/pending' && snapshots === 4)
  try {
    await expect(pending.getByRole('status')).toHaveText('Loading pending reviews…')
    await expect(pending.getByText('All caught up')).toHaveCount(0)
  } finally {
    releaseInitial()
  }
  await exhaustedTransport
  await expect(pending.getByRole('status')).toHaveText('Pending reviews could not be loaded.')
  await expect(pending.getByText('All caught up')).toHaveCount(0)
  const refresh = pending.getByRole('button', { name: 'Refresh pending decisions', exact: true })
  await refresh.focus()
  await expect(refresh).toBeFocused()
  mode = 'partial'
  await page.keyboard.press('Enter')
  await expect(pending.getByRole('heading', { name: 'Unreadable context' })).toBeVisible()
  await expect(pending.getByRole('button', { name: 'Retry Classification', exact: true })).toHaveCount(0)
  await expect(pending.getByRole('button', { name: /^Confirm / })).toHaveCount(0)
  await refresh.focus()
  mode = 'empty'
  await page.keyboard.press('Enter')
  await expect(pending.getByText('All caught up')).toBeVisible()
  expect(writes).toEqual([])
})

for (const [action, bulk] of [['prompt_confirm', false], ['prompt_select', false], ['auto_classify', false], ['auto_classify', true]]) for (const gap of [false, true]) {
  test(`saved current ${action} bulk=${bulk} ${gap ? 'gap requires choice' : 'uses the fresh destination'} without UI clutter`, async ({ page }) => {
    const selectOnly = action === 'prompt_select'
    const automatic = action === 'auto_classify'
    const id = bulk ? '9007199254740992' : 46
    const secondId = '9007199254740993'
    const libraries = [{ id: 101, name: 'Fresh destination', media_type: 'movie', is_active: true },
      { id: 2001, name: 'Earlier destination', media_type: 'movie', is_active: true }]
    const metadata = { tmdb_id: 42, media_type: 'movie', title: 'Owned saved review', policyResult: {
      action: 'prompt_confirm', confidence: 80, ranked: [{ library_id: 2001, policy_id: 2, score: 80 }] } }
    const candidate = { policy_id: 1, library_id: 101, score: automatic ? 90 : 70, auto_classify_threshold: 85, prompt_threshold: 60,
      origin: 'native_intent', revision: 1, detail: { card: composePolicyCandidateEvidenceCard({ classification: metadata }, unknownReviewPurpose()),
        explanation: null, facts: [] } }
    const policy = { action, confidence: automatic ? 90 : 75, thresholds: { auto_classify: 85, prompt: 60, prompt_select: null }, ranked: [candidate] }
    const method = automatic ? 'policy_auto' : selectOnly ? 'policy_recheck' : 'ai_verified'
    metadata.classification_details = { current_policy_review: { version: automatic ? 'policy.current_review.v3' : selectOnly ? 'policy.current_review.v2' : 'policy.current_review.v1', classification_id: String(id),
      identity_key: 'movie:42', method, status: gap ? 'evidence_gap' : 'recorded', policy: gap ? null : policy } }
    if (automatic) metadata.classification_details.route_safety = buildClassificationRouteSafetyProjection(evaluateClassificationRouteSafety({
      result: { method, library: libraries[0], policyResult: policy, confidence: 90, ai_authority: { sideEffects: { canRoute: false } } },
    }))
    const question = normalizePolicyRuntimeQuestion({ metadata, libraries, policyResult: policy })
    const item = { ...metadata, id, method, confidence: automatic ? 90 : 75, library_id: null, status: 'awaiting_decision', metadata,
      policy_question: question, policy_question_stale: false }
    const answer = buildPolicyRuntimeQuestionAnswerContract({ classification: item, question })
    const second = { ...item, id: secondId, metadata: { ...metadata, classification_details: {
      ...metadata.classification_details, current_policy_review: { ...metadata.classification_details.current_policy_review, classification_id: secondId },
    } } }
    const secondAnswer = buildPolicyRuntimeQuestionAnswerContract({ classification: second, question })
    const writes = []
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      let data = {}
      if (req.method() !== 'GET') { writes.push({ path, body: req.postDataJSON() }); data = { success: true, routed: false } }
      else {
        if (path === '/api/setup/status') data = { setupRequired: false }
        if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
        if (path === '/api/notifications') data = { data: [] }
        if (path === '/api/notifications/unread-count') data = { unread: 0 }
        if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
        if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
        if (path === '/api/classification/pending') data = { items: [{ ...item, policy_question_answer: answer },
          ...(bulk ? [{ ...second, policy_question_answer: secondAnswer }] : [])] }
        if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('/')
    const card = page.locator('#needs-attention .action-item').first()
    await expect(card).not.toContainText('80%')
    if (gap || selectOnly) {
      await expect(card.getByRole('button', { name: /^Confirm / })).toHaveCount(0)
      if (bulk) await expect(page.getByRole('button', { name: 'Confirm All', exact: true })).toHaveCount(0)
      await expect(card).toContainText('Choose a destination for this item.')
      if (selectOnly || automatic) {
        if (!gap) await expect(card).toContainText('Policy score: 70/100 (confirmation at 60, automatic at 85)')
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 844 })
          expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
        }
        expect(writes).toEqual([])
        const candidates = card.locator('.alternative-destinations')
        await candidates.locator(':scope > summary').focus(); await page.keyboard.press('Space')
        const choose = candidates.getByRole('button', { name: 'Use Fresh destination', exact: true })
        await choose.focus(); await expect(choose).toBeFocused(); await page.keyboard.press('Enter')
        await expect.poll(() => writes.length).toBe(1)
        expect(writes[0].body).toEqual({ contract_version: answer.version, contract_fingerprint: answer.fingerprint,
          action_id: 'confirm_destination', destination_library_id: 101 })
      }
    } else {
      await expect(card).toContainText(`${automatic ? 90 : 70}% policy score`)
      if (automatic) {
        await expect(card).toContainText('AI advisory review required')
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 844 })
          expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
        }
        expect(writes).toEqual([])
      }
      const confirm = bulk ? page.getByRole('button', { name: 'Confirm All', exact: true })
        : card.getByRole('button', { name: 'Confirm Fresh destination', exact: true })
      await expect(confirm).toBeVisible()
      await confirm.focus(); await page.keyboard.press('Enter')
      await expect.poll(() => writes.length).toBe(bulk ? 2 : 1)
      expect(writes.map(write => write.path)).toEqual((bulk ? [id, secondId] : [id]).map(historyId => `/api/classification/pending/${historyId}/resolve`))
      expect(writes[0].body).toEqual({ contract_version: answer.version, contract_fingerprint: answer.fingerprint,
        action_id: 'confirm_destination', destination_library_id: 101 })
      if (bulk) expect(writes[1].body).toEqual({ contract_version: secondAnswer.version, contract_fingerprint: secondAnswer.fingerprint,
        action_id: 'confirm_destination', destination_library_id: 101 })
    }
  })
}

async function verifyNeutralDestinationChoice(page, kind) {
  const libraries = [{ id: 11, name: 'First arbitrary label', media_type: 'movie', is_active: true },
    { id: 22, name: 'Movies', media_type: 'movie', is_active: true }]
  const metadata = { title: 'Owned unresolved browser item', media_type: 'movie' }
  const result = kind === 'recovery'
    ? { ...buildUnresolvedRecoveryAdvice(libraries), provider_recovery: buildProviderRecovery() }
    : createUnresolvedClassifyFallback(libraries, metadata)
  const question = normalizePolicyRuntimeQuestion({ question: result.clarification, result, libraries, metadata })
  const item = { ...metadata, id: 45, status: 'awaiting_decision', method: kind === 'recovery' ? 'fallback' : 'ai_analysis', library_id: null,
    library_name: null, policy_question: question }
  const answer = buildPolicyRuntimeQuestionAnswerContract({ classification: item, question })
  expect(answer.recommendation.leading_destination).toBeNull()
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let data = {}
    if (request.method() !== 'GET') {
      writes.push({ path, method: request.method(), body: request.postDataJSON() })
      data = { success: true, routed: false, libraryName: 'Movies' }
    } else {
      if (path === '/api/setup/status') data = { setupRequired: false }
      if (['/api/auth/me', '/api/user/me'].includes(path)) data = { id: 1, role: 'admin', username: 'fixture-operator' }
      if (path === '/api/notifications') data = { data: [] }
      if (path === '/api/notifications/unread-count') data = { unread: 0 }
      if (['/api/libraries', '/api/classification/progress', '/api/queue/pending', '/api/queue/failed'].includes(path)) data = []
      if (path === '/api/queue/live-stats') data = { queue: { pending: 0 }, health: { ai: true, worker: true } }
      if (path === '/api/classification/pending') data = { items: [{ ...item, policy_question_stale: false, policy_question_answer: answer }] }
      if (path === '/api/reclassification/batches/activity') data = { batches: [], nextCursor: null }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(data) })
  })
  await page.goto('/')
  const card = page.locator('#needs-attention .action-item').first()
  await expect(card).toContainText('Choose a destination for this item.')
  await expect(card).not.toContainText('Classifarr recommends')
  await expect(card.getByRole('button', { name: /^Confirm / })).toHaveCount(0)
  expect(writes).toEqual([])
  const candidates = card.locator('.alternative-destinations')
  await candidates.locator(':scope > summary').focus()
  await page.keyboard.press('Space')
  const select = candidates.getByRole('button', { name: 'Use Movies', exact: true })
  await select.focus()
  await expect(select).toBeFocused()
  expect(writes).toEqual([])
  await page.keyboard.press('Enter')
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toEqual({ path: '/api/classification/pending/45/resolve', method: 'POST', body: {
    contract_version: answer.version, contract_fingerprint: answer.fingerprint,
    action_id: 'confirm_destination', destination_library_id: 22 } })
}

for (const kind of ['classify', 'recovery']) {
  test(`fresh ${kind} unresolved server advice stays neutral until an explicit keyboard destination choice`, async ({ page }) => {
    await verifyNeutralDestinationChoice(page, kind)
  })
}
