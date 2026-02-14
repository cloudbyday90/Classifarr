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

import { ref, computed, onMounted, onUnmounted, watch, unref } from "vue";
import { useOnline } from "@vueuse/core";

const STORAGE_PREFIX = "classifarr:v1:swr:";
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000];

/**
 * Stale-While-Revalidate composable for Vue 3
 *
 * Shows cached data instantly, then fetches fresh data in background.
 * Provides loading, stale, and error states for UI feedback.
 *
 * @param {string} cacheKey - Unique key for localStorage cache
 * @param {Function} fetcher - Async function that returns data
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Cache time-to-live in ms (default: 60000)
 * @param {*} options.initialData - Initial data before cache/fetch (default: null)
 * @param {number|null} options.pollInterval - Auto-poll interval in ms (default: null)
 * @param {boolean} options.pollOnlyWhenVisible - Pause polling when tab hidden (default: true)
 * @param {boolean} options.autoRetry - Auto-retry on transient errors (default: true)
 *
 * @returns {Object} { data, isLoading, isStale, error, refresh, isOffline, retryCount, cacheTimestamp }
 */
export function useSWR(cacheKey, fetcher, options = {}) {
  const {
    ttl = 60000,
    initialData = null,
    pollInterval = null,
    pollOnlyWhenVisible = true,
    autoRetry = true,
  } = options;

  // State
  const data = ref(initialData);
  const isLoading = ref(true);
  const isStale = ref(false);
  const error = ref(null);
  const retryCount = ref(0);
  const cacheTimestamp = ref(null);

  // Network status
  const isOnline = useOnline();
  const isOffline = computed(() => !isOnline.value);

  const STORAGE_KEY = STORAGE_PREFIX + cacheKey;

  // === Cache Operations ===

  /**
   * Load data from localStorage cache
   * @returns {*} Cached value or null if not found/expired
   */
  function loadFromCache() {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return null;

      const { value, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < ttl) {
        cacheTimestamp.value = timestamp;
        return value;
      }
      return null; // Expired
    } catch (e) {
      console.warn("[useSWR] Cache read error:", e);
      return null;
    }
  }

  /**
   * Save data to localStorage cache
   * @param {*} value - Data to cache
   */
  function saveToCache(value) {
    if (typeof window === "undefined") return;
    try {
      const timestamp = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, timestamp }));
      cacheTimestamp.value = timestamp;
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        clearOldEntries();
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ value, timestamp: Date.now() }),
          );
        } catch {
          /* ignore */
        }
      }
      console.warn("[useSWR] Cache write error:", e);
    }
  }

  /**
   * Clear oldest cache entries when quota exceeded
   */
  function clearOldEntries() {
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(STORAGE_PREFIX),
      );
      // Remove oldest half of entries
      keys
        .slice(0, Math.ceil(keys.length / 2))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("[useSWR] Failed to clear old entries:", e);
    }
  }

  // === Fetching ===

  /**
   * Check if an error is retryable (network/server errors)
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is retryable
   */
  function isRetryableError(err) {
    const status = err.response?.status;
    if (!status) return true; // Network error
    if (status === 429) return true; // Rate limited
    if (status >= 500) return true; // Server error
    return false;
  }

  /**
   * Schedule a retry with exponential backoff
   */
  function scheduleRetry() {
    const delay = RETRY_DELAYS[retryCount.value] || 10000;
    retryCount.value++;
    setTimeout(revalidate, delay);
  }

  /**
   * Fetch fresh data from the API
   */
  async function revalidate() {
    // Offline handling
    if (!isOnline.value) {
      const cached = loadFromCache();
      if (cached !== null) {
        data.value = cached;
        isStale.value = true;
      }
      error.value = { message: "Offline", offline: true, retryable: false };
      isLoading.value = false;
      return;
    }

    try {
      const freshData = await fetcher();
      data.value = freshData;
      saveToCache(freshData);
      error.value = null;
      retryCount.value = 0;
    } catch (e) {
      const retryable = isRetryableError(e);
      error.value = {
        message: e.message || "Fetch failed",
        timestamp: Date.now(),
        retryable,
      };

      if (autoRetry && retryable && retryCount.value < MAX_RETRIES) {
        scheduleRetry();
      }

      console.error("[useSWR] Fetch error:", e);
    } finally {
      isLoading.value = false;
      isStale.value = false;
    }
  }

  /**
   * Manually trigger a refresh
   * @returns {Promise} Resolves when revalidation completes
   */
  function refresh() {
    if (data.value) isStale.value = true;
    return revalidate();
  }

  // === Cross-Tab Sync ===

  /**
   * Handle storage changes from other tabs
   * @param {StorageEvent} e - The storage event
   */
  function handleStorageChange(e) {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const { value, timestamp } = JSON.parse(e.newValue);
        data.value = value;
        cacheTimestamp.value = timestamp;
        isStale.value = false;
        error.value = null;
      } catch {
        /* ignore parse errors */
      }
    }
  }

  // === Lifecycle ===
  let pollIntervalId = null;
  let stopPollIntervalWatch = null;

  function resolvePollInterval() {
    let value = pollInterval;
    if (typeof value === "function") {
      value = value();
    } else {
      value = unref(value);
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function stopPolling() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  function startPolling() {
    stopPolling();
    const intervalMs = resolvePollInterval();
    if (!intervalMs) return;
    pollIntervalId = setInterval(() => {
      if (!pollOnlyWhenVisible || document.visibilityState === "visible") {
        refresh();
      }
    }, intervalMs);
  }

  onMounted(() => {
    // Step 1: Hydrate from cache immediately
    const cached = loadFromCache();
    if (cached !== null) {
      data.value = cached;
      isLoading.value = false;
      isStale.value = true; // Mark stale since we'll fetch fresh
    }

    // Step 2: Fetch fresh data in background
    revalidate();

    // Step 3: Set up cross-tab sync
    window.addEventListener("storage", handleStorageChange);

    // Step 4: Set up polling (supports static or dynamic interval)
    startPolling();
    stopPollIntervalWatch = watch(
      () => resolvePollInterval(),
      () => startPolling(),
    );
  });

  onUnmounted(() => {
    window.removeEventListener("storage", handleStorageChange);
    stopPolling();
    if (typeof stopPollIntervalWatch === "function") {
      stopPollIntervalWatch();
      stopPollIntervalWatch = null;
    }
  });

  // Auto-revalidate when coming back online
  watch(isOnline, (online) => {
    if (online && data.value) {
      isStale.value = true;
      revalidate();
    }
  });

  return {
    data,
    isLoading,
    isStale,
    error,
    refresh,
    isOffline,
    retryCount,
    cacheTimestamp,
  };
}
