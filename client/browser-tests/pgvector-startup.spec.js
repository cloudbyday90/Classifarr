/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

const factLabels = ['Version', 'Build', 'Selected optimization', 'CPU supports AVX', 'CPU supports AVX2']

async function expectFacts(panel, values) {
  const facts = panel.locator('dl')
  await expect(facts).toHaveCount(1)
  const terms = facts.getByRole('term'), definitions = facts.getByRole('definition')
  await expect(terms).toHaveText(factLabels)
  await expect(definitions).toHaveText(values)
  for (let index = 0; index < values.length; index += 1) {
    await expect(terms.nth(index)).toBeVisible()
    await expect(definitions.nth(index)).toBeVisible()
  }
}

for (const [mode, values] of [
  ['match', ['0.8.1', 'Multi-variant', 'AVX2', 'Yes', 'Yes']],
  ['mismatch', ['0.8.1', 'Multi-variant', 'AVX2', 'Yes', 'No']],
  ['unknown', ['0.8.1', 'Multi-variant', 'AVX2', 'Yes', 'Unknown']],
  ['stale', ['0.8.1', 'Unknown', 'Unknown', 'Unknown', 'Unknown']],
  ['generic', ['0.8.1', 'Multi-variant', 'Generic', 'Yes', 'Yes']],
]) {
  test(`startup ${mode} is not service health`, async ({ page }, testInfo) => {
    const requests = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      requests.push(route.request().method())
      await route.abort()
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/browser-tests/fixtures/pgvector-startup.html?mode=${mode}`)
    const panel = page.getByRole('region', { name: 'pgvector', exact: true })
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 844 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport)
      await expect(panel).toBeVisible()
      await expect(panel.getByRole('heading', { name: 'pgvector', exact: true })).toBeVisible()
      await expectFacts(panel, values)
      const warning = panel.getByTestId('pgvector-cpu-warning')
      if (mode === 'mismatch') {
        await expect(warning).toBeVisible()
        await expect(warning).toHaveText('Selected optimization is not supported by this CPU. Check the container image.')
      } else await expect(warning).toHaveCount(0)
      await expect(panel).not.toContainText(/\b(?:healthy|unhealthy)\b/i)
      await expect(panel.getByRole('button')).toHaveCount(0)
      await expect(panel.getByRole('link')).toHaveCount(0)
      await expect(panel.locator('input, select, textarea, form')).toHaveCount(0)
      await expect(panel.getByTestId('pgvector-compatibility-label')).toHaveCount(0)
      await expect(panel.getByTestId('pgvector-startup-report')).toHaveCount(0)
      await expect(panel).not.toContainText(/12345678-1234-4567-8123-123456789abc|2026-10-12/)
      await expect(panel).not.toContainText(/startup compatibility|not included in service-health totals|not a loaded-binary or database-health check|saved by another application process/i)
      await expect.poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
      if (viewport.width !== 1280) await page.screenshot({ path: testInfo.outputPath(viewport.width === 390 ? 'startup-mobile.png' : 'startup-320.png'), fullPage: true })
    }
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })
}
