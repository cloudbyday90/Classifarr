/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function buildPresentation(mode, status) {
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1)

  switch (status) {
    case 'running':
      return {
        statusLabel: 'Running',
        headline: `${modeLabel} backfill running`,
        detail: `${modeLabel} backfill is actively processing work.`,
        tone: 'info'
      }
    case 'paused':
      return {
        statusLabel: 'Paused',
        headline: `${modeLabel} backfill paused`,
        detail: `${modeLabel} backfill is paused.`,
        tone: 'warning'
      }
    case 'cooldown':
      return {
        statusLabel: 'Waiting',
        headline: `${modeLabel} backfill waiting on provider recovery`,
        detail: `${modeLabel} backfill is paused until the embedding provider recovers.`,
        tone: 'warning'
      }
    case 'completed':
      return {
        statusLabel: 'Completed',
        headline: `${modeLabel} backfill completed`,
        detail: `${modeLabel} backfill has completed.`,
        tone: 'success'
      }
    case 'failed':
      return {
        statusLabel: 'Failed',
        headline: `${modeLabel} backfill failed`,
        detail: `${modeLabel} backfill failed.`,
        tone: 'danger'
      }
    case 'enabled':
      return {
        statusLabel: 'Enabled',
        headline: `${modeLabel} backfill enabled`,
        detail: `${modeLabel} backfill is enabled.`,
        tone: 'success'
      }
    default:
      return {
        statusLabel: 'Disabled',
        headline: `${modeLabel} backfill disabled`,
        detail: `${modeLabel} backfill is disabled.`,
        tone: 'neutral'
      }
  }
}

function buildControls(mode, status) {
  if (mode === 'manual') {
    return {
      canStart: !['running', 'paused', 'cancelling'].includes(status),
      canPause: status === 'running',
      canResume: status === 'paused',
      canClear: status !== 'running',
      canRun: true
    }
  }

  return {
    canStart: false,
    canPause: false,
    canResume: false,
    canClear: false,
    canRun: status !== 'cooldown' && status !== 'disabled'
  }
}

export function defaultBackfillModeStatus(mode) {
  const status = mode === 'manual' ? 'idle' : 'disabled'
  return {
    mode,
    status,
    enabled: mode === 'manual',
    isRunning: false,
    isPaused: false,
    isTerminal: false,
    progress: 0,
    controls: buildControls(mode, status),
    presentation: buildPresentation(mode, status)
  }
}

export function normalizeBackfillModeStatus(mode, status) {
  const base = defaultBackfillModeStatus(mode)
  const input = status || {}
  const merged = {
    ...base,
    ...input
  }
  const mergedStatus = merged.status || base.status

  return {
    ...merged,
    mode,
    status: mergedStatus,
    controls: {
      ...buildControls(mode, mergedStatus),
      ...(input.controls || {})
    },
    presentation: {
      ...buildPresentation(mode, mergedStatus),
      ...(input.presentation || {})
    }
  }
}

export function getBackfillToneClasses(status) {
  const normalized = status?.presentation ? status : normalizeBackfillModeStatus(status?.mode || 'manual', status)
  switch (normalized.presentation.tone) {
    case 'info':
      return {
        textClass: 'text-blue-400',
        bannerClass: 'bg-blue-500/10 border-blue-500/40 text-blue-200'
      }
    case 'warning':
      return {
        textClass: 'text-yellow-400',
        bannerClass: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-200'
      }
    case 'danger':
      return {
        textClass: 'text-red-400',
        bannerClass: 'bg-red-500/10 border-red-500/40 text-red-200'
      }
    case 'success':
      return {
        textClass: 'text-green-400',
        bannerClass: 'bg-green-500/10 border-green-500/40 text-green-200'
      }
    default:
      return {
        textClass: 'text-gray-400',
        bannerClass: 'bg-gray-500/10 border-gray-500/40 text-gray-200'
      }
  }
}
