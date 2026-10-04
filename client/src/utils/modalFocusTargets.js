/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const CANDIDATE_SELECTOR = [
  'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])', 'select',
  'textarea', 'iframe', 'object', 'embed', 'summary', '[contenteditable]', '[tabindex]',
].join(', ')

/** @param {unknown} element @returns {element is HTMLElement} */
export function isAvailableFocusTarget(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected || element.matches(':disabled')) return false
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false

  const view = element.ownerDocument.defaultView
  if (!view) return false
  const visibility = view.getComputedStyle(element).visibility
  if (visibility === 'hidden' || visibility === 'collapse') return false

  for (let ancestor = /** @type {HTMLElement | null} */ (element); ancestor; ancestor = ancestor.parentElement) {
    const style = view.getComputedStyle(ancestor)
    if (style.display === 'none' || style.contentVisibility === 'hidden') return false
    if (ancestor instanceof HTMLDetailsElement && !ancestor.open && ancestor !== element) {
      /** @type {Element | null} */
      const summary = ancestor.querySelector(':scope > summary')
      if (!summary?.contains(element)) return false
    }
  }
  return true
}

/** @param {unknown} element */
export function focusAvailableTarget(element) {
  if (!isAvailableFocusTarget(element)) return false
  element.focus({ preventScroll: true })
  return element.ownerDocument.activeElement === element
}

/** @param {HTMLElement | null} container @returns {HTMLElement[]} */
export function getModalTabStops(container) {
  if (!container) return []
  const candidates = Array.from(container.querySelectorAll(CANDIDATE_SELECTOR))
    .filter(isAvailableFocusTarget)
    .filter(element => element.tabIndex >= 0)

  return candidates.filter(element => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true
    const group = candidates.filter(candidate => candidate instanceof HTMLInputElement &&
      candidate.type === 'radio' && candidate.name === element.name && candidate.form === element.form)
    const checked = group.find(candidate => /** @type {HTMLInputElement} */ (candidate).checked)
    return element === (checked || group[0])
  }).sort((left, right) => {
    // Positive tabindex precedes zero; stable sorting preserves DOM order on ties.
    const leftOrder = left.tabIndex || Infinity
    const rightOrder = right.tabIndex || Infinity
    return leftOrder === rightOrder ? 0 : leftOrder - rightOrder
  })
}
