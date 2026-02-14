<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">NOTIFICATIONS</h1>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-60"
          :disabled="!unreadCount || actionBusy"
          @click="markAllRead"
        >
          {{ actionBusy ? 'Working...' : 'Mark All Read' }}
        </button>
        <button
          type="button"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-60"
          :disabled="!hasReadRows || actionBusy"
          @click="clearRead"
        >
          {{ actionBusy ? 'Working...' : 'Clear Read' }}
        </button>
      </div>
    </div>

    <div class="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="option in filterOptions"
          :key="`notif-filter-${option.value}`"
          type="button"
          class="rounded-md border px-3 py-1 text-xs"
          :class="activeFilter === option.value ? 'border-blue-700/40 bg-blue-900/20 text-blue-200' : 'border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700'"
          @click="setFilter(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="mt-3">
        <input
          v-model="search"
          type="text"
          placeholder="Search notifications..."
          class="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
          @keyup.enter="reload"
        />
      </div>

      <div class="mt-3 flex items-center gap-2">
        <label for="notifications-sort" class="text-xs text-gray-400">Sort</label>
        <select
          id="notifications-sort"
          v-model="sort"
          class="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="unread_first">Unread First</option>
        </select>
      </div>
    </div>

    <p v-if="error" class="rounded-md border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
      {{ error }}
    </p>

    <div class="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
      <div v-if="loading" class="py-8 text-center text-sm text-gray-400">Loading notifications...</div>
      <div v-else-if="!rows.length" class="py-8 text-center text-sm text-gray-400">
        {{ activeFilter === 'unread' ? 'No unread notifications ✓' : 'No notifications yet' }}
      </div>
      <div v-else class="space-y-2">
        <article
          v-for="notification in rows"
          :key="`notifications-row-${notification.id}`"
          class="rounded-md border border-gray-700/70 bg-gray-900/40 px-3 py-3"
        >
          <button type="button" class="w-full text-left" @click="openNotification(notification)">
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm font-semibold text-gray-100">
                <span class="mr-1">{{ notification.isRead ? '○' : '●' }}</span>{{ typeIcon(notification.type) }} {{ notification.title }}
              </p>
              <span class="shrink-0 text-xs text-gray-400">{{ formatRelativeTime(notification.createdAt) }}</span>
            </div>
            <p class="mt-1 text-xs text-gray-400">{{ notification.message }}</p>
          </button>

          <div class="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" class="text-xs text-blue-400 hover:text-blue-300" @click="openNotification(notification)">Open</button>
            <button type="button" class="text-xs text-blue-400 hover:text-blue-300" @click="toggleRead(notification)">
              {{ notification.isRead ? 'Mark Unread' : 'Mark Read' }}
            </button>
            <button
              v-if="notification.dismissible"
              type="button"
              class="text-xs text-gray-400 hover:text-gray-300"
              @click="dismissNotification(notification)"
            >
              Dismiss
            </button>
          </div>
        </article>
      </div>

      <div v-if="pagination.totalPages > 1" class="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-60"
          :disabled="pagination.page <= 1 || actionBusy"
          @click="setPage(pagination.page - 1)"
        >
          Previous
        </button>
        <span class="text-xs text-gray-400">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
        <button
          type="button"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-60"
          :disabled="pagination.page >= pagination.totalPages || actionBusy"
          @click="setPage(pagination.page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api';
import { useSWR } from '@/composables/useSWR';
import { CACHE_TTL, POLL_INTERVALS } from '@/constants/cacheKeys';

const router = useRouter();
const pageSize = 25;

const activeFilter = ref('all');
const sort = ref('newest');
const search = ref('');
const page = ref(1);
const actionBusy = ref(false);
const error = ref('');

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'info', label: 'Info' },
];

const { data, isLoading, refresh } = useSWR(
  'notifications:view',
  async () => {
    const response = await api.getNotifications({
      page: page.value,
      limit: pageSize,
      filter: activeFilter.value,
      sort: sort.value,
      search: search.value || undefined,
    });
    return response.data;
  },
  { ttl: CACHE_TTL.SHORT, pollInterval: POLL_INTERVALS.NORMAL, pollOnlyWhenVisible: true }
);

const rows = computed(() => Array.isArray(data.value?.data) ? data.value.data : []);
const pagination = computed(() => data.value?.pagination || { page: 1, totalPages: 1 });
const unreadCount = computed(() => Number(data.value?.unreadCount || 0));
const hasReadRows = computed(() => rows.value.some((row) => row.isRead));
const loading = computed(() => isLoading.value && !data.value);

function normalizeAnchor(anchor) {
  if (!anchor) return '';
  return anchor.startsWith('#') ? anchor : `#${anchor}`;
}

function typeIcon(type) {
  switch (type) {
    case 'awaiting_decision': return '🚨';
    case 'error': return '⚠️';
    case 'connection_lost': return '⚡';
    case 'connection_restored': return '✅';
    case 'budget_warning': return '💰';
    case 'sync_completed': return '🗂️';
    case 'enrichment_completed': return '🎬';
    case 'policy_suggestion': return '💡';
    case 'update_available': return '🆕';
    default: return 'ℹ️';
  }
}

function formatRelativeTime(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function withAction(action) {
  error.value = '';
  actionBusy.value = true;
  try {
    await action();
    await reload();
  } catch (actionError) {
    error.value = actionError?.response?.data?.error || actionError?.message || 'Notification action failed';
  } finally {
    actionBusy.value = false;
  }
}

async function openNotification(notification) {
  await withAction(async () => {
    if (!notification.isRead) {
      await api.markNotificationRead(notification.id);
    }
    await router.push({
      path: notification.targetPath || '/',
      hash: normalizeAnchor(notification.targetAnchor),
    });
  });
}

async function toggleRead(notification) {
  await withAction(async () => {
    if (notification.isRead) await api.markNotificationUnread(notification.id);
    else await api.markNotificationRead(notification.id);
  });
}

async function dismissNotification(notification) {
  await withAction(async () => {
    await api.dismissNotification(notification.id);
  });
}

async function markAllRead() {
  await withAction(async () => {
    await api.markAllNotificationsRead();
  });
}

async function clearRead() {
  await withAction(async () => {
    await api.clearReadNotifications();
  });
}

async function reload() {
  await refresh();
}

function setFilter(filter) {
  activeFilter.value = filter;
  page.value = 1;
}

function setPage(nextPage) {
  page.value = nextPage;
}

watch([activeFilter, sort, page], () => {
  reload();
});
</script>
