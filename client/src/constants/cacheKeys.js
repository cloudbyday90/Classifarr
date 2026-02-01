/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Centralized cache keys for useSWR composable
 * 
 * Format: {domain}:{resource}:{identifier?}
 * 
 * These keys are prefixed with 'classifarr:v1:swr:' in the composable
 * to prevent collisions with other apps and enable cache versioning.
 */
export const CACHE_KEYS = {
  // Dashboard
  DASHBOARD_MAIN: 'dashboard:main',
  DASHBOARD_QUEUE: 'dashboard:queue',
  
  // Statistics
  STATS_CLASSIFICATION: 'stats:classification',
  STATS_RAG: 'stats:rag',
  
  // Queue
  QUEUE_STATS: 'queue:stats',
  QUEUE_PENDING: 'queue:pending',
  QUEUE_FAILED: 'queue:failed',
  
  // Activity
  ACTIVITY_FEED: 'activity:feed',
  ACTIVITY_STATS: 'activity:stats'
}

/**
 * Cache TTL presets in milliseconds
 */
export const CACHE_TTL = {
  SHORT: 30000,    // 30 seconds - for frequently changing data
  MEDIUM: 60000,   // 60 seconds - default for most stats
  LONG: 300000,    // 5 minutes - for rarely changing data
  VERY_LONG: 900000 // 15 minutes - for static-ish data
}

/**
 * Polling interval presets in milliseconds
 */
export const POLL_INTERVALS = {
  FAST: 5000,      // 5 seconds - real-time queue/activity
  NORMAL: 30000,   // 30 seconds - dashboard refresh
  SLOW: 60000      // 60 seconds - background stats
}
