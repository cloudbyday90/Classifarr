/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Service icon mappings
 * Maps service names to emoji icons for visual identification
 */
export const SERVICE_ICONS = {
  // Direct matches
  'Database': '🗄️',
  'PostgreSQL': '🗄️',
  'Plex': '📺',
  'Radarr': '🎬',
  'Sonarr': '📺',
  'Ollama': '🤖',
  'AI Provider': '🤖',
  'Queue Worker': '⚡',
  'TMDB': '🎫',
  'OMDb': '🎟️',
  'Discord Bot': '💬',
  'Discord': '💬',
  'Tavily': '🌐',
  'Media Server': '📺',
  'Jellyfin': '📺',
  'Emby': '📺',
  'openai': '🤖',
  'anthropic': '🤖',
  'ollama': '🤖',
}

/**
 * Get icon for a service by name
 * Supports direct matches and partial matches
 * 
 * @param {string} serviceName - Name of the service
 * @returns {string} Emoji icon for the service
 */
export function getServiceIcon(serviceName) {
  if (!serviceName) return '📦'
  
  // Direct match
  if (SERVICE_ICONS[serviceName]) {
    return SERVICE_ICONS[serviceName]
  }
  
  // Case-insensitive match
  const lowerName = serviceName.toLowerCase()
  const matchKey = Object.keys(SERVICE_ICONS).find(
    key => key.toLowerCase() === lowerName
  )
  if (matchKey) {
    return SERVICE_ICONS[matchKey]
  }
  
  // Partial match
  const partialMatch = Object.keys(SERVICE_ICONS).find(
    key => lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)
  )
  if (partialMatch) {
    return SERVICE_ICONS[partialMatch]
  }
  
  // Default icon
  return '📦'
}
