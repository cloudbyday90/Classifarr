/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export function useCommandCenterShell({ route, router }) {
  const isMobileViewport = ref(false)
  const expandedSections = ref({
    errors: true,
    enrichment: true,
    recent: true,
    quickadd: false,
    libraries: true,
    today: false,
  })

  function toggleSection(section) {
    expandedSections.value = { ...expandedSections.value, [section]: !expandedSections.value[section] }
  }

  const legacyRouteNotice = computed(() => {
    const source = String(route.query.legacyRoute || '').toLowerCase()
    if (!source) return null

    if (source === 'activity') {
      return {
        message: 'You were redirected from Live Activity. Operational live processing now runs in Command Center.',
        actions: [
          { label: 'Go To Processing', to: { path: '/', hash: '#processing' } },
          { label: 'Open Notifications', to: { path: '/notifications' } },
        ],
      }
    }

    if (source === 'queue') {
      return {
        message: 'You were redirected from Queue. Primary queue operations now live in Command Center; advanced controls are in Settings > Queue.',
        actions: [
          { label: 'Go To Processing', to: { path: '/', hash: '#processing' } },
          { label: 'Open Settings Queue', to: { path: '/settings', query: { tab: 'queue' } } },
        ],
      }
    }

    if (source === 'migration') {
      return {
        message: 'Migration workflows are deprecated. Use Policies, Presets, and Tuning for active rule management.',
        actions: [
          { label: 'Open Policies', to: { path: '/policies' } },
          { label: 'Open Presets', to: { path: '/presets' } },
          { label: 'Open Tuning', to: { path: '/tuning-suggestions' } },
        ],
      }
    }

    if (source === 'dashboard') {
      return {
        message: 'You were redirected from Dashboard. Command Center is now the primary operational surface.',
        actions: [
          { label: 'Go To Alerts', to: { path: '/', hash: '#alerts' } },
          { label: 'Go To Today', to: { path: '/', hash: '#today' } },
        ],
      }
    }

    return null
  })

  function dismissLegacyRouteNotice() {
    const query = { ...route.query }
    delete query.legacyRoute
    router.replace({ path: route.path, hash: route.hash, query })
  }

  let mobileMediaQueryList = null

  function applyViewportMode(matches) {
    isMobileViewport.value = Boolean(matches)
  }

  function handleMobileViewportChange(event) {
    applyViewportMode(event.matches)
  }

  onMounted(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mobileMediaQueryList = window.matchMedia('(max-width: 1023px)')
      applyViewportMode(mobileMediaQueryList.matches)
      if (typeof mobileMediaQueryList.addEventListener === 'function') {
        mobileMediaQueryList.addEventListener('change', handleMobileViewportChange)
      } else if (typeof mobileMediaQueryList.addListener === 'function') {
        mobileMediaQueryList.addListener(handleMobileViewportChange)
      }
    }
  })

  onBeforeUnmount(() => {
    if (mobileMediaQueryList) {
      if (typeof mobileMediaQueryList.removeEventListener === 'function') {
        mobileMediaQueryList.removeEventListener('change', handleMobileViewportChange)
      } else if (typeof mobileMediaQueryList.removeListener === 'function') {
        mobileMediaQueryList.removeListener(handleMobileViewportChange)
      }
    }
  })

  return {
    dismissLegacyRouteNotice,
    expandedSections,
    isMobileViewport,
    legacyRouteNotice,
    toggleSection,
  }
}
