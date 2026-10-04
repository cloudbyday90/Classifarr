/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, ref } from 'vue'
import { getDiscordDeliveries } from '../api/settingsNotificationsApi'

/**
 * @typedef {object} DeliveryRecord
 * @property {string} classificationId
 * @property {string|null} title
 * @property {string} state
 * @property {string} channelId
 * @property {string|null} messageId
 * @property {string} kind
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export function useDiscordDeliveryReview() {
  /** @type {import('vue').Ref<{items: DeliveryRecord[], nextBefore: string|null}|null>} */
  const page = ref(null)
  const busy = ref(false)
  const error = ref('')
  const announcement = ref('')
  /** @type {AbortController|null} */
  let controller = null
  let disposed = false
  /** @type {string|null} */
  let currentBefore = null

  /** @param {string|null} [before] */
  async function load(before = null) {
    if (busy.value || disposed) return
    busy.value = true
    error.value = ''
    announcement.value = 'Loading delivery records…'
    controller = new AbortController()
    try {
      const result = await getDiscordDeliveries(before, controller.signal)
      if (disposed) return
      if (!result || !Array.isArray(result.items) || result.items.length > 25 ||
          !(result.nextBefore === null || (typeof result.nextBefore === 'string' && /^[1-9]\d{0,18}$/.test(result.nextBefore))) ||
          result.items.some(item => !item || typeof item.classificationId !== 'string' ||
            !/^[1-9]\d{0,18}$/.test(item.classificationId) || typeof item.state !== 'string' ||
            !(item.title === null || typeof item.title === 'string') || typeof item.channelId !== 'string')) {
        throw new Error('Invalid delivery records')
      }
      page.value = result
      currentBefore = before
      announcement.value = `${result.items.length} delivery records loaded.`
    } catch {
      if (disposed) return
      error.value = page.value
        ? 'Could not refresh. Showing the last loaded records. Try again or sign in again.'
        : 'Could not load delivery records. Try again or sign in again.'
      announcement.value = ''
    } finally {
      busy.value = false
      controller = null
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    controller?.abort()
  })

  return { page, busy, error, announcement, load, refresh: () => load(currentBefore) }
}
