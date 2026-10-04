/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, ref } from 'vue'
import { verifyDiscordDelivery } from '../api/settingsNotificationsApi'

const messages = {
  confirmed: 'Delivery confirmed. Nothing was resent.',
  proof_mismatch: 'That message does not match this receipt. Check the message ID.',
  bot_changed: 'The saved bot differs from the original sender. Check Discord settings.',
  configuration_changed: 'The receipt or Discord settings changed. Refresh records and check settings.',
  access_denied: 'Check the bot token and its View Channel and Read Message History permissions.',
  message_unavailable: 'Message not found or not accessible. Delivery remains unconfirmed.',
  not_eligible: 'This receipt cannot be verified by message ID. Refresh records.',
  receipt_missing: 'This delivery record no longer exists. Refresh records.',
  verification_paused: 'Verification is paused after an invalid provider retry limit. Ask a maintainer to review it.',
  timed_out: 'Discord took too long. Nothing was resent. Refresh records before another check.',
  cancelled: 'Verification cancelled. Refresh records to check the saved result.',
}

export function useDiscordDeliveryVerification(classificationId, onConfirmed = (_messageId) => {}) {
  const messageId = ref('')
  const busy = ref(false)
  const confirmed = ref(false)
  const feedback = ref('')
  const invalid = ref(false)
  /** @type {AbortController|null} */
  let controller = null
  let disposed = false
  async function verify() {
    if (disposed || busy.value || confirmed.value) return
    invalid.value = !/^[0-9]{17,20}$/.test(messageId.value)
    if (invalid.value) {
      feedback.value = 'Enter the 17–20 digit Discord message ID, not a link.'
      return
    }
    busy.value = true
    feedback.value = 'Checking the existing message…'
    controller = new AbortController()
    try {
      const response = await verifyDiscordDelivery(classificationId, messageId.value, controller.signal)
        .catch(error => ({ data: error?.response?.data }))
      if (disposed) return
      const savedMessageId = response?.data?.messageId
      const receivedCode = response?.data?.code
      const code = typeof receivedCode !== 'string' || (receivedCode === 'confirmed' &&
        (typeof savedMessageId !== 'string' || !/^[0-9]{17,20}$/.test(savedMessageId)))
        ? 'invalid_response' : receivedCode
      confirmed.value = code === 'confirmed'
      if (confirmed.value) {
        messageId.value = savedMessageId
        onConfirmed(savedMessageId)
      }
      const seconds = response?.data?.retryAfterSeconds
      feedback.value = ['cooldown', 'rate_limited', 'busy'].includes(code)
        ? Number.isSafeInteger(seconds) && seconds > 0
          ? `Wait at least ${seconds} seconds before another check. Nothing was resent.`
          : 'Verification is busy or paused. Try later; nothing was resent.'
        : Object.hasOwn(messages, code) ? messages[code]
          : 'Could not verify delivery. Refresh records before trying again; nothing was resent.'
    } finally {
      busy.value = false
      controller = null
    }
  }
  onBeforeUnmount(() => { disposed = true; controller?.abort() })
  return { messageId, busy, confirmed, feedback, invalid, verify }
}
