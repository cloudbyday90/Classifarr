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
  error = '',
  now = Date.now(),
  staleDays = POLICY_BUILDER_PROFILE_STALE_DAYS,
} = {}) {
  if (loading) {
    return {
      status: 'loading',
      tone: 'info',
      label: 'Loading profile',
      message: 'Loading current library profile.',
      updatedAtLabel: '',
    }
  }

  if (error) {
    return {
      status: 'error',
      tone: 'warning',
      label: 'Profile unavailable',
      message: error,
      updatedAtLabel: '',
    }
  }

  if (!profile) {
    return {
      status: 'missing',
      tone: 'warning',
      label: 'No profile yet',
      message: 'Wait for the server-managed profile lifecycle before relying on library-derived intent suggestions.',
      updatedAtLabel: '',
    }
  }

  const timestamp = parseTimestamp(profileTimestamp(profile))
  if (!timestamp) {
    return {
      status: 'unknown_age',
      tone: 'warning',
      label: 'Profile age unknown',
      message: 'Wait for the server-managed profile lifecycle before relying on library-derived intent suggestions.',
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
      ? `Last generated ${ageLabel}. Wait for the server-managed profile lifecycle before using it as policy evidence.`
      : `Last generated ${ageLabel}.`,
    updatedAtLabel: `Last generated: ${formatDateTime(timestamp)}`,
  }
}
