/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue'

/**
 * @param {Readonly<import('vue').Ref<HTMLInputElement | null>>} input
 * @param {() => boolean} isDisabled
 */
export function usePasswordVisibility(input, isDisabled) {
  const visible = ref(false)
  /** @type {HTMLFormElement | null} */
  let form = null

  function hide() {
    visible.value = false
    // Submit's default action must not wait for Vue's next render.
    if (input.value) input.value.type = 'password'
  }

  function toggle() {
    if (!isDisabled()) visible.value = !visible.value
  }

  function detach() {
    form?.removeEventListener('submit', hide, true)
    form = null
  }

  function syncForm() {
    const nextForm = input.value?.form ?? null
    if (nextForm === form) return
    detach()
    form = nextForm
    form?.addEventListener('submit', hide, true)
  }

  watch(isDisabled, disabled => { if (disabled) hide() }, { flush: 'sync' })
  onMounted(syncForm)
  onUpdated(syncForm)
  onBeforeUnmount(detach)

  return { visible, toggle }
}
