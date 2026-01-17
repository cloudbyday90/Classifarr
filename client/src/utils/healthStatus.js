/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Standardized health status configuration
 * Defines canonical status values and their visual properties
 */

// Latency thresholds (milliseconds)
const LATENCY_GOOD_THRESHOLD = 100;
const LATENCY_WARNING_THRESHOLD = 500;

export const HEALTH_STATUS = {
  healthy: {
    label: 'Healthy',
    badgeVariant: 'success',
    dotClass: 'bg-green-500',
    borderClass: 'border-green-700',
    bgClass: 'bg-green-900/20',
    textClass: 'text-green-400',
    icon: '✅'
  },
  degraded: {
    label: 'Degraded',
    badgeVariant: 'warning',
    dotClass: 'bg-yellow-500',
    borderClass: 'border-yellow-700',
    bgClass: 'bg-yellow-900/20',
    textClass: 'text-yellow-400',
    icon: '⚠️'
  },
  unhealthy: {
    label: 'Unhealthy',
    badgeVariant: 'error',
    dotClass: 'bg-red-500',
    borderClass: 'border-red-700',
    bgClass: 'bg-red-900/20',
    textClass: 'text-red-400',
    icon: '❌'
  },
  not_configured: {
    label: 'Not Configured',
    badgeVariant: 'default',
    dotClass: 'bg-gray-500',
    borderClass: 'border-gray-700',
    bgClass: 'bg-gray-900/20',
    textClass: 'text-gray-400',
    icon: '⚙️'
  },
  unknown: {
    label: 'Unknown',
    badgeVariant: 'default',
    dotClass: 'bg-gray-500',
    borderClass: 'border-gray-700',
    bgClass: 'bg-gray-900/20',
    textClass: 'text-gray-400',
    icon: '❓'
  }
}

/**
 * Get status configuration for a given status
 * 
 * @param {string} status - Health status value
 * @returns {object} Status configuration object
 */
export function getStatusConfig(status) {
  return HEALTH_STATUS[status] || HEALTH_STATUS.unknown
}

/**
 * Get CSS class for latency color coding
 * Green <100ms, Yellow <500ms, Red >=500ms
 * 
 * @param {number} latency - Response time in milliseconds
 * @returns {string} CSS class for latency coloring
 */
export function getLatencyClass(latency) {
  if (latency == null || latency === undefined) return 'text-gray-500'
  if (latency < LATENCY_GOOD_THRESHOLD) return 'text-green-500'
  if (latency < LATENCY_WARNING_THRESHOLD) return 'text-yellow-500'
  return 'text-red-500'
}

/**
 * Calculate overall health from services
 * Returns aggregate health status and statistics
 * 
 * @param {Array} services - Array of service health objects
 * @returns {object} Overall health summary
 */
export function getOverallHealth(services) {
  if (!services || services.length === 0) {
    return {
      status: 'unknown',
      message: 'No services configured',
      healthy: 0,
      total: 0
    }
  }
  
  const total = services.length
  const healthy = services.filter(s => s.status === 'healthy').length
  const unhealthy = services.filter(s => s.status === 'unhealthy').length
  const degraded = services.filter(s => s.status === 'degraded').length
  
  let status = 'healthy'
  let message = 'All systems operational'
  
  if (unhealthy > 0) {
    status = 'unhealthy'
    message = `${unhealthy} service${unhealthy > 1 ? 's' : ''} down`
  } else if (degraded > 0) {
    status = 'degraded'
    message = `${degraded} service${degraded > 1 ? 's' : ''} degraded`
  }
  
  return {
    status,
    message,
    healthy,
    total,
    unhealthy,
    degraded
  }
}
