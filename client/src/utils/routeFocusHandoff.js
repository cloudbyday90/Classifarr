/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const routeFocusHandoffs = new Map()

const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0

/**
 * Stores one in-memory focus destination for a successful client-side route.
 * It is intentionally not persisted, serialized, or exposed in the URL.
 */
export function requestRouteFocusHandoff({ routeName, targetId, fallbackTargetId }) {
  if (!isNonEmptyString(routeName) || !isNonEmptyString(targetId)) return false

  routeFocusHandoffs.set(routeName, {
    targetId,
    fallbackTargetId: isNonEmptyString(fallbackTargetId) ? fallbackTargetId : '',
  })
  return true
}

export function consumeRouteFocusHandoff(routeName) {
  if (!isNonEmptyString(routeName)) return null

  const handoff = routeFocusHandoffs.get(routeName) || null
  routeFocusHandoffs.delete(routeName)
  return handoff
}

export function clearRouteFocusHandoff(routeName) {
  if (!isNonEmptyString(routeName)) return false

  return routeFocusHandoffs.delete(routeName)
}
