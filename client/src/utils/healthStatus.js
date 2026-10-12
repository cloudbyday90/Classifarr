/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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
  disabled: {
    label: 'Disabled',
    badgeVariant: 'default',
    dotClass: 'bg-gray-500',
    borderClass: 'border-gray-700',
    bgClass: 'bg-gray-900/20',
    textClass: 'text-gray-400',
    icon: '⛔'
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
 * @returns {typeof HEALTH_STATUS.unknown} Status configuration object
 */
export function getStatusConfig(status) {
  return HEALTH_STATUS[/** @type {keyof typeof HEALTH_STATUS} */ (status)] || HEALTH_STATUS.unknown
}

/**
 * Get CSS class for latency color coding
 * Green <100ms, Yellow <500ms, Red >=500ms
 * 
 * @param {number} latency - Response time in milliseconds
 * @returns {string} CSS class for latency coloring
 */
export function getLatencyClass(latency) {
  if (latency == null) return 'text-gray-500'
  if (latency < LATENCY_GOOD_THRESHOLD) return 'text-green-500'
  if (latency < LATENCY_WARNING_THRESHOLD) return 'text-yellow-500'
  return 'text-red-500'
}

// Aggregate policy is separate from presentation and latency/trend helpers.
export { getOverallHealth } from './serviceHealthSummary'

/**
 * Calculate trend based on status and latency changes
 * @param {{ status?: string, responseTime?: number | null } | null} current - Current service state
 * @param {{ status?: string, responseTime?: number | null } | null} previous - Previous service state
 * @returns {'improving'|'degrading'|'stable'|null}
 */
export function calculateTrend(current, previous) {
  if (!current || !previous || !previous.status) {
    return null;
  }
  
  // Status score for comparison
  /** @type {Record<string, number>} */
  const statusScore = {
    'healthy': 3,
    'connected': 3,
    'available': 3,
    'configured': 2,
    'degraded': 2,
    'partial': 2,
    'unhealthy': 1,
    'disconnected': 1,
    'unavailable': 1,
    'error': 1,
    'not_configured': 0,
    'disabled': 0,
    'unknown': 0
  };
  
  const currentScore = statusScore[current.status ?? 'unknown'] || 0;
  const previousScore = statusScore[previous.status] || 0;
  
  // Status improved
  if (currentScore > previousScore) {
    return 'improving';
  }
  
  // Status degraded
  if (currentScore < previousScore) {
    return 'degrading';
  }
  
  // Status same - check latency trend
  if (current.responseTime != null && previous.responseTime != null) {
    const diff = current.responseTime - previous.responseTime;
    const threshold = 50; // 50ms threshold for meaningful change
    
    if (Math.abs(diff) > threshold) {
      return diff < 0 ? 'improving' : 'degrading';
    }
  }
  
  return 'stable';
}

/**
 * Get emoji arrow for trend
 * @param {string} trend - Trend value
 * @returns {string} Emoji arrow
 */
export function getTrendArrow(trend) {
  switch (trend) {
    case 'improving': return '↗️';
    case 'degrading': return '↘️';
    case 'stable': return '→';
    default: return '';
  }
}

/**
 * Get tooltip text for trend
 * @param {{ trend?: string | null }} service - Service with trend data
 * @returns {string} Tooltip text
 */
export function getTrendTooltip(service) {
  if (!service.trend || service.trend === 'stable') {
    return 'Status is stable';
  }
  
  if (service.trend === 'improving') {
    return 'Status is improving';
  }
  
  if (service.trend === 'degrading') {
    return 'Status is degrading';
  }
  
  return '';
}
