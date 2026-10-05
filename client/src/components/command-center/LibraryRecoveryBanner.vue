<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div>
    <p
      ref="statusNode"
      class="sr-only"
      role="status"
      aria-atomic="true"
      tabindex="-1"
    >
      {{ announcement }}
    </p>
    <section
      v-if="visible"
      ref="bannerNode"
      class="recovery-banner"
      :class="{ 'needs-attention': report.attention }"
      aria-labelledby="library-recovery-heading"
    >
      <div class="recovery-heading">
        <h2 id="library-recovery-heading">
          {{ heading }}
        </h2>
        <button
          type="button"
          :aria-disabled="refreshing"
          @click="refresh"
        >
          {{ refreshing ? 'Refreshing…' : 'Refresh status' }}
        </button>
      </div>
      <p v-if="report.state === 'unavailable'">
        Library status could not be checked. Refresh to see current guidance.
      </p>
      <template v-else>
        <p>{{ report.attention ? 'Some imports need your help. Follow the steps for each affected library.' : 'Classifarr is handling these imports. No action is needed.' }}</p>
        <details :open="report.attention > 0">
          <summary>View affected libraries ({{ report.items.length }})</summary>
          <ul>
            <li
              v-for="item in report.items.slice(0, 5)"
              :key="item.id"
            >
              <div class="library-heading">
                <strong>{{ item.name }}</strong><span>{{ item.title }}</span>
              </div>
              <p>{{ item.message }}</p>
              <div
                v-if="item.deployment"
                class="deployment-guidance"
              >
                <p
                  v-for="step in item.deployment.steps"
                  :key="step"
                >
                  {{ step }}
                </p>
                <details v-if="item.deployment.facts.length">
                  <summary>What Classifarr checked</summary>
                  <p
                    v-for="fact in item.deployment.facts"
                    :key="fact"
                  >
                    {{ fact }}
                  </p>
                </details>
              </div>
              <RouterLink :to="item.path">
                {{ item.action }}<span class="sr-only">: {{ item.name }}</span>
              </RouterLink>
            </li>
          </ul>
          <RouterLink
            v-if="report.items.length > 5"
            to="/libraries"
          >
            View all libraries ({{ report.items.length - 5 }} more affected)
          </RouterLink>
        </details>
        <MigrationFailureReport v-if="report.items.some(item => item.deployment)" />
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import MigrationFailureReport from '../library/MigrationFailureReport.vue'

const props = defineProps({ report: { type: Object, required: true }, refreshing: Boolean })
const emit = defineEmits(['refresh'])
const bannerNode = ref(null)
const statusNode = ref(null)
function refresh() {
  if (!props.refreshing) emit('refresh')
}
const visible = computed(() => props.report.state === 'unavailable' || props.report.items.length > 0)
// If resolution removes the focused control, leave focus on its stable status.
// Background refreshes never move focus from elsewhere on the page.
watch(visible, value => {
  const previousFocus = document.activeElement
  if (value || !bannerNode.value?.contains(previousFocus)) return
  void nextTick(() => {
    if (document.activeElement === previousFocus || document.activeElement === document.body) {
      statusNode.value?.focus({ preventScroll: true })
    }
  })
})
const heading = computed(() => {
  if (props.report.state === 'unavailable') return 'Library status unavailable'
  const count = props.report.attention
  return count ? `${count} ${count === 1 ? 'library needs' : 'libraries need'} attention` : 'Imports are being handled automatically'
})
const announcement = computed(() => {
  if (props.report.state === 'loading') return ''
  if (props.report.state === 'unavailable') return 'Library recovery status is unavailable.'
  return props.report.items.length
    ? `${props.report.attention} ${props.report.attention === 1 ? 'library needs' : 'libraries need'} attention; ${props.report.progress} ${props.report.progress === 1 ? 'import is' : 'imports are'} being handled automatically.`
    : 'No library import issues reported.'
})
</script>

<style scoped>
.recovery-banner { margin: 1rem 0; padding: 1rem; border: 1px solid var(--border-color, #475569); border-radius: 0.75rem; background: var(--bg-secondary, #1e293b); color: var(--text-primary, #f1f5f9); }
.needs-attention { border-color: #b98d3c; }
.recovery-heading, .library-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
h2 { font-size: 1rem; font-weight: 600; }
p { margin: 0.5rem 0; line-height: 1.5; }
summary { cursor: pointer; padding: 0.5rem 0; }
ul { list-style: none; margin: 0; padding: 0; }
li { padding: 0.75rem 0; border-top: 1px solid var(--border-color, #475569); overflow-wrap: anywhere; }
.library-heading span { font-size: 0.875rem; }
a { display: inline-block; text-decoration: underline; text-underline-offset: 0.2em; padding: 0.4rem 0; }
button { border: 1px solid currentColor; border-radius: 0.375rem; padding: 0.375rem 0.625rem; font-size: 0.875rem; }
button[aria-disabled="true"] { opacity: 0.6; cursor: wait; }
.deployment-guidance { margin: 0.5rem 0; }
button:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid #60a5fa; outline-offset: 3px; }
</style>
