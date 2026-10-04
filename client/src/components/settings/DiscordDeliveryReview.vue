<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    :aria-labelledby="headingId"
    class="delivery-review rounded-lg border border-gray-700 bg-gray-800 p-5 space-y-4"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3
          :id="headingId"
          class="text-lg font-semibold"
        >
          Discord deliveries
        </h3>
        <p class="text-sm text-gray-300">
          Check saved delivery results. Nothing is resent.
        </p>
      </div>
      <Button
        variant="outline-solid"
        :disabled="busy"
        @click="refresh"
      >
        {{ page ? 'Refresh records' : 'Load delivery records' }}
      </Button>
    </div>
    <p
      role="status"
      class="text-sm text-gray-300"
    >
      {{ announcement }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-amber-200"
    >
      {{ error }}
    </p>
    <div
      v-if="page"
      :aria-busy="busy"
    >
      <template v-if="page.items.length">
        <p class="text-xs text-gray-300 mb-2">
          On this page · {{ page.items.length }} records
        </p>
        <dl class="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 mb-5">
          <div
            v-for="status in statuses"
            :key="status.label"
            class="flex min-[400px]:block items-center justify-between rounded-lg bg-gray-900 p-3"
          >
            <dt
              class="text-xs sm:text-sm"
              :class="status.color"
            >
              {{ status.label }}
            </dt>
            <dd class="text-2xl font-semibold mt-1">
              {{ counts[status.label] }}
            </dd>
          </div>
        </dl>
        <ul
          aria-label="Recorded Discord deliveries"
          class="divide-y divide-gray-700"
        >
          <li
            v-for="item in page.items"
            :key="item.classificationId"
            class="py-4 first:pt-0"
          >
            <div class="flex flex-wrap justify-between gap-2">
              <p class="font-medium break-words min-w-0">
                {{ item.title || 'Untitled classification' }}
              </p>
              <span
                class="text-sm font-semibold"
                :class="presentation(item.state).color"
              >{{ presentation(item.state).label }}</span>
            </div>
            <p class="text-sm text-gray-300 mt-1">
              {{ presentation(item.state).next }}
            </p>
            <details class="mt-2 text-sm text-gray-300">
              <summary class="cursor-pointer w-fit">
                Details for classification #{{ item.classificationId }}
              </summary>
              <dl class="mt-2 space-y-1 break-words">
                <div>
                  <dt class="inline">
                    Recorded channel:
                  </dt><dd class="inline">
                    {{ item.channelId }}
                  </dd>
                </div>
                <div v-if="item.messageId">
                  <dt class="inline">
                    Recorded message:
                  </dt><dd class="inline">
                    {{ item.messageId }}
                  </dd>
                </div>
                <div>
                  <dt class="inline">
                    Notification type:
                  </dt><dd class="inline">
                    {{ item.kind }}
                  </dd>
                </div>
                <div>
                  <dt class="inline">
                    Attempt started:
                  </dt><dd class="inline">
                    {{ formatDate(item.createdAt) }}
                  </dd>
                </div>
                <div>
                  <dt class="inline">
                    Record updated:
                  </dt><dd class="inline">
                    {{ formatDate(item.updatedAt) }}
                  </dd>
                </div>
              </dl>
              <DiscordDeliveryVerification
                v-if="item.canVerify === true"
                :classification-id="item.classificationId"
                @confirmed="messageId => confirmRecord(item, messageId)"
              />
            </details>
          </li>
        </ul>
      </template>
      <p
        v-else
        class="text-gray-300"
      >
        No delivery records on this page.
      </p>
      <div class="flex flex-wrap gap-3 mt-4">
        <Button
          variant="outline-solid"
          :disabled="busy"
          @click="load()"
        >
          Newest classifications
        </Button>
        <Button
          variant="outline-solid"
          :disabled="busy || !page.nextBefore"
          @click="load(page.nextBefore)"
        >
          Older classifications
        </Button>
      </div>
    </div>
    <details class="text-xs text-gray-300">
      <summary class="cursor-pointer w-fit">
        What these records cover
      </summary>
      <p class="mt-2">
        Initial classification alerts only, ordered by classification—not send time.
        Older messages without receipts and test/system alerts are not included.
        Delivered means previously confirmed, not a live check that the message still exists.
      </p>
    </details>
  </section>
</template>

<script setup>
import { computed, useId } from 'vue'
import Button from '../common/Button.vue'
import DiscordDeliveryVerification from './DiscordDeliveryVerification.vue'
import { useDiscordDeliveryReview } from '../../composables/useDiscordDeliveryReview'

const headingId = useId()
const { page, busy, error, announcement, load, refresh } = useDiscordDeliveryReview()
const statuses = [
  { label: 'Delivered', color: 'text-green-300', next: 'Delivery was confirmed. No action needed.' },
  { label: 'Unconfirmed', color: 'text-amber-200', next: 'Check the recorded channel. Delivery is not yet confirmed; do not resend.' },
  { label: 'Rejected', color: 'text-red-300', next: 'Check bot access and channel permissions. This alert will not resend automatically.' },
]
function presentation(state) {
  return state === 'delivered' ? statuses[0] : state === 'rejected' ? statuses[2] : statuses[1]
}
function confirmRecord(item, messageId) {
  item.state = 'delivered'
  item.messageId = messageId
  // Keep this form mounted so the focused action and its status stay available.
}
const counts = computed(() => {
  const result = { Delivered: 0, Unconfirmed: 0, Rejected: 0 }
  for (const item of page.value?.items || []) result[presentation(item.state).label]++
  return result
})
function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString()
}
</script>

<style scoped>
.delivery-review :is(button, summary):focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 3px;
}
</style>
