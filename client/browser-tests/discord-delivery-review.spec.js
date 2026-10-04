/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@playwright/test'

const items = ['uncertain', 'delivered', 'rejected'].map((state, i) => ({
  classificationId: String(103 - i), title: ['The Martian', 'Arrival', 'Dune'][i], state,
  channelId: '222222222222222222', messageId: state === 'delivered' ? '333333333333333333' : null,
  kind: 'classification', createdAt: '2026-10-04T10:00:00Z', updatedAt: '2026-10-04T10:01:00Z',
}))

for (const width of [320, 1280]) {
  test(`review is keyboard accessible and fits ${width}px without polling or writes`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const requests = []
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      requests.push(`${route.request().method()} ${new globalThis.URL(route.request().url()).pathname}`)
      return route.fulfill({ json: { items, nextBefore: null } })
    })
    await page.goto('/browser-tests/fixtures/discord-delivery-review.html')
    await expect(page.getByRole('heading', { name: 'Discord deliveries' })).toBeVisible()
    expect(requests).toEqual([])
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Load delivery records' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toHaveText('3 delivery records loaded.')
    await page.keyboard.press('Tab')
    const summary = page.locator('summary').first()
    await expect(summary).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Recorded channel:', { exact: true }).first()).toBeVisible()
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`review-${width}.png`), fullPage: true })
    await page.clock.install()
    await page.clock.fastForward(60_000)
    expect(requests).toEqual(['GET /api/settings/discord/deliveries'])
  })
}

test('a failed refresh leaves labelled old records and never retries in the transport', async ({ page }) => {
  let requests = 0
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    expect(route.request().method()).toBe('GET')
    requests++
    return route.fulfill(requests === 1
      ? { json: { items, nextBefore: null } }
      : { status: 503, json: { error: 'private provider detail' } })
  })
  await page.goto('/browser-tests/fixtures/discord-delivery-review.html')
  await page.getByRole('button', { name: 'Load delivery records' }).click()
  await expect(page.getByText('The Martian', { exact: true })).toBeVisible()
  await page.clock.install()
  await page.getByRole('button', { name: 'Refresh records' }).click()
  await expect(page.getByRole('alert')).toContainText('Showing the last loaded records')
  await expect(page.getByText('The Martian', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('private provider detail')
  await page.clock.fastForward(60_000)
  expect(requests).toBe(2)
})
