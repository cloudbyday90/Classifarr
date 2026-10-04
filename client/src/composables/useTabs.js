/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, onBeforeUpdate, onUpdated, ref, useId, watch } from 'vue'

/** @typedef {{ id: string, label: string, icon?: string, badge?: string | number }} TabItem */

/**
 * @param {object} options
 * @param {() => TabItem[]} options.getTabs
 * @param {() => string} options.getValue
 * @param {Readonly<import('vue').Ref<HTMLElement | null>>} options.list
 * @param {(id: string) => void} options.onUpdate
 */
export function useTabs({ getTabs, getValue, list, onUpdate }) {
  const baseId = useId()
  const focusedId = ref('')
  /** @type {Map<string, number>} */
  const tokens = new Map()
  let sequence = 0
  /** @type {HTMLElement | null} */
  let previousFocus = null

  const items = computed(() => {
    const seen = new Set()
    const source = getTabs()
    if (!Array.isArray(source)) return []
    return source.filter(tab => {
      if (!tab || typeof tab.id !== 'string' || !tab.id.trim()
        || typeof tab.label !== 'string' || !tab.label.trim() || seen.has(tab.id)) return false
      seen.add(tab.id)
      return true
    }).map(tab => ({
      id: tab.id,
      label: tab.label,
      icon: typeof tab.icon === 'string' ? tab.icon : '',
      badge: typeof tab.badge === 'string' || (typeof tab.badge === 'number' && Number.isFinite(tab.badge)) ? tab.badge : undefined,
    }))
  })
  const selectedId = computed(() => items.value.find(tab => tab.id === getValue())?.id ?? '')
  const entryId = computed(() => items.value.some(tab => tab.id === focusedId.value)
    ? focusedId.value : selectedId.value || items.value[0]?.id || '')

  // Retain identity across reordering, without retaining removed entries or
  // incorporating caller strings into DOM IDs/selectors.
  watch(items, tabs => {
    const ids = new Set(tabs.map(tab => tab.id))
    for (const id of tokens.keys()) if (!ids.has(id)) tokens.delete(id)
    for (const id of ids) if (!tokens.has(id)) tokens.set(id, sequence++)
  }, { immediate: true, flush: 'sync' })

  /** @param {string} id */
  const tabId = id => `${baseId}-tab-${tokens.get(id)}`
  /** @param {string} id */
  const panelId = id => `${baseId}-panel-${tokens.get(id)}`
  const buttons = () => Array.from(list.value?.querySelectorAll('button') ?? [])
    .filter(element => element.getAttribute('role') === 'tab' && !element.matches(':disabled'))

  /** @param {string} id @param {FocusEvent} event */
  function focusTab(id, event) {
    focusedId.value = id
    // Native focus may leave a partially visible tab clipped in an overflow
    // strip. Reveal it fully with minimal movement and no smooth animation.
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    }
  }

  /** @param {FocusEvent} event */
  function leaveList(event) {
    if (!(event.relatedTarget instanceof Node) || !list.value?.contains(event.relatedTarget)) focusedId.value = ''
  }

  /** @param {string} id @param {MouseEvent} event */
  function activate(id, event) {
    if (!(event.currentTarget instanceof HTMLButtonElement) || event.currentTarget.matches(':disabled')) return
    if (items.value.some(tab => tab.id === id) && getValue() !== id) onUpdate(id)
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return
    const controls = buttons()
    const current = controls.findIndex(button => button === event.currentTarget)
    if (current < 0) return
    let target
    switch (event.key) {
      case 'ArrowLeft': target = (current + controls.length - 1) % controls.length; break
      case 'ArrowRight': target = (current + 1) % controls.length; break
      case 'Home': target = 0; break
      case 'End': target = controls.length - 1; break
      default: return
    }
    event.preventDefault()
    controls[target]?.focus()
  }

  onBeforeUpdate(() => {
    const active = list.value?.ownerDocument.activeElement
    previousFocus = active instanceof HTMLElement && list.value?.contains(active) ? active : null
  })
  onUpdated(() => {
    const removed = previousFocus
    previousFocus = null
    if (!removed || removed.isConnected || removed.ownerDocument.activeElement !== removed.ownerDocument.body) return
    buttons().find(button => button.id === tabId(entryId.value))?.focus()
  })

  return { items, selectedId, entryId, tabId, panelId, focusTab, leaveList, activate, handleKeydown }
}
