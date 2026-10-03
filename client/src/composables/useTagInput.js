/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ref, watch } from 'vue'

/**
 * @param {object} options
 * @param {Readonly<import('vue').Ref<HTMLInputElement | null>>} options.input
 * @param {() => string[]} options.getTags
 * @param {() => boolean} options.isLocked
 * @param {(tags: string[]) => void} options.onUpdate
 */
export function useTagInput({ input, getTags, isLocked, onUpdate }) {
  const draft = ref('')
  const status = ref('')
  let composing = false
  let commitAfterComposition = false

  const canEdit = () => !isLocked() && !!input.value && !input.value.matches(':disabled')

  function resetComposition() {
    composing = false
    commitAfterComposition = false
  }
  watch(isLocked, locked => { if (locked) resetComposition() }, { flush: 'sync' })

  function focusInput() {
    if (input.value && !input.value.matches(':disabled')) input.value.focus()
  }

  /** @param {MouseEvent} event */
  function handleContainerClick(event) {
    if (event.target === event.currentTarget) focusInput()
  }

  /** @param {Event} event */
  function handleInput(event) {
    if (canEdit() && event.currentTarget instanceof HTMLInputElement) {
      draft.value = event.currentTarget.value
    }
  }

  function addTag() {
    if (!canEdit() || composing) return
    const value = draft.value.trim()
    if (value) {
      if (getTags().includes(value)) {
        status.value = 'That tag is already added.'
      } else {
        const next = [...getTags(), value]
        onUpdate(next)
        status.value = `Tag added. ${next.length} total.`
      }
    }
    draft.value = ''
    // Clear the native draft synchronously: IMEs can dispatch a final input
    // before Vue's render flush, which must not restore the committed text.
    if (input.value) input.value.value = ''
  }

  function addFromButton() {
    if (!canEdit() || composing) return
    addTag()
    focusInput()
  }

  /** @param {string} tag */
  function removeTag(tag) {
    if (!canEdit() || composing || !getTags().includes(tag)) return
    // Move focus before Vue removes the active button, preserving the draft.
    focusInput()
    const next = getTags().filter(value => value !== tag)
    onUpdate(next)
    status.value = `Tag removed. ${next.length} total.`
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    // IME boundaries can report isComposing=false; MDN documents this fallback.
    if (composing || event.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') event.preventDefault()
    if (!canEdit() || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
    if (event.key === 'Enter') addTag()
    if (event.key === 'Backspace' && !draft.value && getTags().length) {
      event.preventDefault()
      // Preserve the established single-last-item behavior, even for legacy duplicates.
      const next = getTags().slice(0, -1)
      onUpdate(next)
      status.value = `Tag removed. ${next.length} total.`
    }
  }

  /** @param {FocusEvent} event */
  function handleFocusout(event) {
    if (!canEdit()) {
      resetComposition()
      return
    }
    if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node
      && event.currentTarget.contains(event.relatedTarget)) return
    if (composing) {
      commitAfterComposition = true
    } else {
      addTag()
    }
  }

  function handleCompositionstart() {
    if (!canEdit()) return
    composing = true
    commitAfterComposition = false
  }

  function handleFocusin() {
    commitAfterComposition = false
  }

  /** @param {CompositionEvent} event */
  function handleCompositionend(event) {
    composing = false
    handleInput(event)
    if (commitAfterComposition && input.value?.ownerDocument.activeElement !== input.value) addTag()
    commitAfterComposition = false
  }

  return {
    draft, status, handleInput, handleKeydown, handleFocusout, handleFocusin,
    handleCompositionstart, handleCompositionend, handleContainerClick,
    addFromButton, removeTag,
  }
}
