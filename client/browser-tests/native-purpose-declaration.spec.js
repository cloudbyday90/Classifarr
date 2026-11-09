/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@playwright/test'

test('saved legacy purpose stays visible, fresh choices stay positive and actionable refusals retain retry identity', async ({ page }) => {
  const attempts = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new globalThis.URL(req.url()).pathname
    let body = {}, status = 200
    if (path.endsWith('/purpose-change')) body = {
      version: 'policy.native_intent_purpose_change_read.v2', statusId: 'native_intent_purpose_change_available',
      policyId: 17, revision: 3,
      changeCommand: { command_id: 'update_purpose', values: [{ signal_type: 'genres', operator: 'exclude',
        values: { exclude: ['custom-token'] }, semantics: 'identity', constraint_mode: 'advisory' }] },
      purposeProvenance: { id: 'declared_native', declarationRequired: false, rawRuleProvenanceExposed: false },
      authority: { source: 'server_owned_native_intent', purposeChangeAllowed: true, browserAuthorityAccepted: false },
      compatibilityDataExposed: false, aiDataExposed: false, routingDataExposed: false, learningDataExposed: false,
    }
    else if (path.endsWith('/changes') && req.method() === 'POST') {
      attempts.push({ body: req.postDataJSON(), key: req.headers()['idempotency-key'] })
      status = 400
      body = { code: 'POLICY_PURPOSE_DECLARATION_UNSUPPORTED', error: 'Fixed purpose validation refusal.' }
    } else if (path.includes('csrf')) body = { csrfToken: 'synthetic-browser-csrf-fixture' }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/browser-tests/fixtures/native-purpose-declaration.html')
  await page.locator('#policy-native-purpose-change button').first().click()
  const matching = page.getByRole('combobox', { name: 'Matching rule', exact: true })
  await expect(matching).toHaveValue('exclude')
  await expect(matching.locator('option[value="exclude"]')).toBeDisabled()
  expect(await matching.locator('option:not([disabled])').evaluateAll(options => options.map(option => option.value)))
    .toEqual(['require_any', 'require_all', 'prefer', 'include'])
  const terms = page.getByRole('textbox', { name: 'Purpose terms for rule 1' })
  await expect(terms).toHaveValue('custom-token')
  await page.getByRole('button', { name: 'Apply purpose change', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Use avoid rules for exclusions.')
  await page.getByRole('button', { name: 'Apply purpose change', exact: true }).click()
  await expect.poll(() => attempts.length).toBe(2)
  expect(attempts[0].key).toBeTruthy()
  expect(attempts[1]).toEqual(attempts[0])
  await matching.selectOption('require_any')
  await expect(matching.locator('option[value="exclude"]')).toHaveCount(0)
  await expect(terms).toHaveValue('custom-token')
})

test('real browser cookie path boundaries and inert actionability remain enforced', async ({ page, context }) => {
  await context.addCookies([{ name: 'scoped', value: 'synthetic', domain: '127.0.0.1', path: '/allowed', sameSite: 'Lax' }])
  expect((await context.cookies('http://127.0.0.1:4173/allowed/child')).map(cookie => cookie.name)).toContain('scoped')
  expect((await context.cookies('http://127.0.0.1:4173/allowed-other')).map(cookie => cookie.name)).not.toContain('scoped')
  expect((await context.cookies('http://localhost:4173/allowed')).map(cookie => cookie.name)).not.toContain('scoped')
  await page.setContent('<div inert><button id="inert">Inert control</button></div><button id="ordinary">Ordinary control</button>')
  await page.evaluate(() => { globalThis.clicks = []; globalThis.document.addEventListener('click', event => globalThis.clicks.push(event.target.id)) })
  await expect(page.locator('#inert').click({ timeout: 250 })).rejects.toThrow(/Timeout/)
  await page.locator('#ordinary').click()
  expect(await page.evaluate(() => globalThis.clicks)).toEqual(['ordinary'])
})
