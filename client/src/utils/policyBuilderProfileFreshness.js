/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_BUILDER_PROFILE_STALE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

function parseTimestamp(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatDateTime(value) {
  const timestamp = parseTimestamp(value)
  if (!timestamp) return 'Unknown'

  return new Date(timestamp).toLocaleString()
}

function formatAge(timestamp, now) {
  const ageMs = Math.max(0, now - timestamp)
  const ageDays = Math.floor(ageMs / DAY_MS)

  if (ageDays >= 1) {
    return `${ageDays} ${ageDays === 1 ? 'day' : 'days'} ago`
  }

  const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
  if (ageHours >= 1) {
    return `${ageHours} ${ageHours === 1 ? 'hour' : 'hours'} ago`
  }

  const ageMinutes = Math.floor(ageMs / (60 * 1000))
  if (ageMinutes >= 1) {
    return `${ageMinutes} ${ageMinutes === 1 ? 'minute' : 'minutes'} ago`
  }

  return 'just now'
}

function profileTimestamp(profile = {}) {
  return profile?.last_generated_at || profile?.updated_at || null
}

export function buildPolicyBuilderProfileFreshness({
  profile = null,
  loading = false,
  refreshing = false,
  error = '',
  now = Date.now(),
  staleDays = POLICY_BUILDER_PROFILE_STALE_DAYS,
} = {}) {
  if (refreshing) {
    return {
      status: 'refreshing',
      tone: 'info',
      label: 'Refreshing profile',
      message: 'Refreshing library profile from current synced media.',
      canRefresh: false,
      updatedAtLabel: '',
    }
  }

  if (loading) {
    return {
      status: 'loading',
      tone: 'info',
      label: 'Loading profile',
      message: 'Loading current library profile.',
      canRefresh: false,
      updatedAtLabel: '',
    }
  }

  if (error) {
    return {
      status: 'error',
      tone: 'warning',
      label: 'Profile unavailable',
      message: error,
      canRefresh: true,
      updatedAtLabel: '',
    }
  }

  if (!profile) {
    return {
      status: 'missing',
      tone: 'warning',
      label: 'No profile yet',
      message: 'Generate a profile after library sync and enrichment before relying on library-derived intent suggestions.',
      canRefresh: true,
      updatedAtLabel: '',
    }
  }

  const timestamp = parseTimestamp(profileTimestamp(profile))
  if (!timestamp) {
    return {
      status: 'unknown_age',
      tone: 'warning',
      label: 'Profile age unknown',
      message: 'Refresh the profile before relying on library-derived intent suggestions.',
      canRefresh: true,
      updatedAtLabel: '',
    }
  }

  const staleMs = Math.max(1, Number.parseInt(staleDays, 10) || POLICY_BUILDER_PROFILE_STALE_DAYS) * DAY_MS
  const isStale = now - timestamp > staleMs
  const ageLabel = formatAge(timestamp, now)

  return {
    status: isStale ? 'stale' : 'current',
    tone: isStale ? 'warning' : 'success',
    label: isStale ? 'Profile may be stale' : 'Profile current',
    message: isStale
      ? `Last generated ${ageLabel}. Refresh before using it as policy evidence.`
      : `Last generated ${ageLabel}.`,
    canRefresh: true,
    updatedAtLabel: `Last generated: ${formatDateTime(timestamp)}`,
  }
}
