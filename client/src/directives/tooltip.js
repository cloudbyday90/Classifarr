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

function createTooltip(text) {
  const tooltip = document.createElement('div')
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

function showTooltip(el, binding) {
  const text = binding.value
  if (!text) return
  
  // Remove existing tooltip
  hideTooltip()
  
  // Create and position new tooltip
  tooltipElement = createTooltip(text)
  positionTooltip(tooltipElement, el)
}

function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.remove()
    tooltipElement = null
  }
}

export default {
  mounted(el, binding) {
    el._tooltipHandlers = {
      mouseenter: () => showTooltip(el, binding),
      mouseleave: hideTooltip,
      click: hideTooltip
    }
    
    el.addEventListener('mouseenter', el._tooltipHandlers.mouseenter)
    el.addEventListener('mouseleave', el._tooltipHandlers.mouseleave)
    el.addEventListener('click', el._tooltipHandlers.click)
  },
  
  updated(el, binding) {
    // Update tooltip text if it changed while showing
    if (tooltipElement && binding.value !== binding.oldValue) {
      hideTooltip()
      if (el.matches(':hover')) {
        showTooltip(el, binding)
      }
    }
  },
  
  unmounted(el) {
    if (el._tooltipHandlers) {
      el.removeEventListener('mouseenter', el._tooltipHandlers.mouseenter)
      el.removeEventListener('mouseleave', el._tooltipHandlers.mouseleave)
      el.removeEventListener('click', el._tooltipHandlers.click)
      delete el._tooltipHandlers
    }
    hideTooltip()
  }
}
