/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { useAttrs, useId } from 'vue'

// useAttrs is not reactive: read it during each render, not in a computed cache.
export function useFormControlAttrs() {
  const attrs = useAttrs()
  const generatedId = useId()
  const errorId = `${generatedId}-error`
  const hintId = `${generatedId}-hint`
  const controlId = () => typeof attrs.id === 'string' && attrs.id ? attrs.id : generatedId
  const layoutAttrs = () => ({ class: attrs.class, style: attrs.style })

  /**
   * @param {string} [error]
   * @param {string} [hint]
   */
  function controlAttrs(error = '', hint = '') {
    const forwarded = Object.fromEntries(Object.entries(attrs).filter(([key]) =>
      !['class', 'style', 'modelModifiers'].includes(key)))
    forwarded.id = controlId()
    if (error) {
      forwarded['aria-invalid'] = true
    }
    if (error || hint) {
      const existing = typeof attrs['aria-describedby'] === 'string' ? attrs['aria-describedby'].trim() : ''
      forwarded['aria-describedby'] = [...new Set([
        ...existing.split(/\s+/).filter(Boolean),
        ...(hint ? [hintId] : []),
        ...(error ? [errorId] : []),
      ])].join(' ')
    }
    return forwarded
  }

  return { controlId, controlAttrs, layoutAttrs, errorId, hintId }
}
