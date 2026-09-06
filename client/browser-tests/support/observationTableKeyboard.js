/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect } from '@playwright/test'

export async function checkKeyboardScroll(page, region) {
  await region.focus()
  await region.evaluate(element => {
    element.dataset.scrollFinished = 'false'
    element.addEventListener('scrollend', () => { element.dataset.scrollFinished = 'true' }, { once: true })
  })
  await page.keyboard.press('ArrowRight')
  await expect(region).toHaveAttribute('data-scroll-finished', 'true')
  expect(await region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await region.evaluate(element => { element.scrollTo({ left: 0, behavior: 'instant' }) })
  await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBe(0)
}
