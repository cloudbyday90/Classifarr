/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Vue 3 Tooltip Directive
 * Usage: v-tooltip="'Tooltip text'"
 */

// Tooltip positioning margin
const TOOLTIP_MARGIN = 8;

let tooltipElement = null
let activeTarget = null
const states = new WeakMap()

function createTooltip(text) {
  const tooltip = document.createElement('div')
  tooltip.setAttribute('role', 'tooltip')
  tooltip.className = 'fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none transition-opacity duration-200 whitespace-pre-line'
  tooltip.style.opacity = '0'
  tooltip.textContent = text
  document.body.appendChild(tooltip)
  return tooltip
}

function positionTooltip(tooltip, targetEl) {
  const rect = targetEl.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  
  // Position above element, centered
  const left = rect.left + (rect.width / 2) - (tooltipRect.width / 2)
  const top = rect.top - tooltipRect.height - TOOLTIP_MARGIN
  
  tooltip.style.left = `${Math.max(TOOLTIP_MARGIN, left)}px`
  tooltip.style.top = `${Math.max(TOOLTIP_MARGIN, top)}px`
  
  // Fade in
  requestAnimationFrame(() => {
    tooltip.style.opacity = '1'
  })
}

function showTooltip(el) {
  const text = states.get(el)?.value
  hideTooltip()
  if (!text) return
  
  // Create and position new tooltip
  tooltipElement = createTooltip(text)
  activeTarget = el
  positionTooltip(tooltipElement, el)
}

function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.remove()
    tooltipElement = null
  }
  activeTarget = null
}

export default {
  mounted(el, binding) {
    const dismiss = () => { if (activeTarget === el) hideTooltip() }
    const handlers = {
      mouseenter: () => showTooltip(el),
      mouseleave: dismiss,
      click: dismiss
    }
    
    states.set(el, { value: binding.value, handlers })
    for (const [event, handler] of Object.entries(handlers)) el.addEventListener(event, handler)
  },
  
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.value = binding.value
    if (activeTarget === el && binding.value !== binding.oldValue) showTooltip(el)
  },
  
  unmounted(el) {
    const state = states.get(el)
    if (state) {
      for (const [event, handler] of Object.entries(state.handlers)) el.removeEventListener(event, handler)
      states.delete(el)
    }
    if (activeTarget === el) hideTooltip()
  }
}
