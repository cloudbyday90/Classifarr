<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <header class="relative z-30 bg-sidebar border-b border-gray-800 px-4 md:px-6 py-3">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-2 min-w-0">
        <button
          @click="$emit('toggleSidebar')"
          class="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-300 hover:bg-background-light hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
          aria-label="Toggle navigation menu"
        >
          <Bars3Icon class="h-5 w-5" />
        </button>
        <router-link to="/" class="truncate text-lg font-semibold tracking-tight text-white hover:text-blue-300">
          Classifarr
        </router-link>
      </div>

      <div class="flex items-center gap-3">
        <div ref="notificationsContainerRef" class="relative">
          <button
            type="button"
            class="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-300 hover:bg-background-light hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Notifications"
            @click="toggleNotificationsPanel"
          >
            <BellIcon class="h-5 w-5" />
            <span
              v-if="unreadCount > 0"
              class="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
            >
              {{ unreadCount }}
            </span>
          </button>

          <div
            v-if="notificationsOpen"
            class="absolute right-0 top-full z-[70] mt-2 w-[360px] max-w-[90vw] rounded-lg border border-gray-700 bg-gray-900 shadow-2xl"
          >
            <div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <h3 class="text-sm font-semibold text-gray-100">NOTIFICATIONS</h3>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-60"
                  :disabled="!unreadNotifications.length || notificationsActionBusy"
                  @click="markAllRead"
                >
                  {{ notificationsActionBusy ? 'Working...' : 'Mark All Read' }}
                </button>
                <button
                  type="button"
                  class="text-xs text-red-300 hover:text-red-200 disabled:opacity-60"
                  :disabled="!notifications.length || notificationsActionBusy"
                  @click="clearAllNotifications"
                >
                  {{ notificationsActionBusy ? 'Working...' : 'Clear All' }}
                </button>
              </div>
            </div>

            <div class="max-h-[420px] overflow-y-auto px-2 py-2">
              <template v-if="notifications.length">
                <template v-if="unreadNotifications.length">
                  <p class="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Unread</p>
                  <div
                    v-for="notification in unreadNotifications"
                    :key="`header-notification-unread-${notification.id}`"
                    class="mb-2 rounded-md border border-gray-800 px-3 py-2 last:mb-0 hover:border-gray-700 hover:bg-gray-800/50"
                  >
                    <button
                      type="button"
                      class="w-full text-left"
                      @click="openNotification(notification)"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <p class="text-xs font-semibold text-gray-200">
                          <span class="mr-1">{{ notification.isRead ? '○' : '●' }}</span>{{ typeIcon(notification.type) }} {{ notification.title }}
                        </p>
                        <span class="shrink-0 text-[11px] text-gray-500">{{ formatRelativeTime(notification.createdAt) }}</span>
                      </div>
                      <p class="mt-1 text-xs text-gray-400">{{ notification.message }}</p>
                    </button>

                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" class="text-[11px] text-blue-400 hover:text-blue-300" @click.stop="openNotification(notification)">Open</button>
                      <button type="button" class="text-[11px] text-blue-400 hover:text-blue-300" @click.stop="toggleReadState(notification)">
                        {{ notification.isRead ? 'Mark Unread' : 'Mark Read' }}
                      </button>
                      <button type="button" class="text-[11px] text-red-300 hover:text-red-200" @click.stop="deleteNotification(notification)">
                        Delete
                      </button>
                    </div>
                  </div>
                </template>

                <template v-if="readNotifications.length">
                  <div class="my-2 border-t border-gray-800 pt-2">
                    <p class="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Read</p>
                    <div
                      v-for="notification in readNotifications"
                      :key="`header-notification-read-${notification.id}`"
                      class="mb-2 rounded-md border border-gray-800 px-3 py-2 last:mb-0 hover:border-gray-700 hover:bg-gray-800/50"
                    >
                      <button
                        type="button"
                        class="w-full text-left"
                        @click="openNotification(notification)"
                      >
                        <div class="flex items-start justify-between gap-2">
                          <p class="text-xs font-semibold text-gray-200">
                            <span class="mr-1">{{ notification.isRead ? '○' : '●' }}</span>{{ typeIcon(notification.type) }} {{ notification.title }}
                          </p>
                          <span class="shrink-0 text-[11px] text-gray-500">{{ formatRelativeTime(notification.createdAt) }}</span>
                        </div>
                        <p class="mt-1 text-xs text-gray-400">{{ notification.message }}</p>
                      </button>

                      <div class="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" class="text-[11px] text-blue-400 hover:text-blue-300" @click.stop="openNotification(notification)">Open</button>
                        <button type="button" class="text-[11px] text-blue-400 hover:text-blue-300" @click.stop="toggleReadState(notification)">
                          {{ notification.isRead ? 'Mark Unread' : 'Mark Read' }}
                        </button>
                        <button type="button" class="text-[11px] text-red-300 hover:text-red-200" @click.stop="deleteNotification(notification)">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
              </template>
              <p v-else class="px-2 py-6 text-center text-sm text-gray-400">No notifications yet</p>
            </div>

            <div class="border-t border-gray-800 px-4 py-3 text-right">
              <button
                type="button"
                class="text-xs text-blue-400 hover:text-blue-300"
                @click="goToAllNotifications"
              >
                View All Notifications
              </button>
            </div>
          </div>
        </div>

        <div ref="accountContainerRef" class="relative">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-200 hover:bg-background-light hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Account menu"
            @click="toggleAccountMenu"
          >
            <UserCircleIcon class="h-5 w-5" />
            <span class="hidden sm:inline">{{ accountUsername }}</span>
            <ChevronDownIcon class="h-4 w-4" />
          </button>

          <div
            v-if="accountMenuOpen"
            class="absolute right-0 top-full z-[70] mt-2 w-44 rounded-lg border border-gray-700 bg-gray-900 p-1 shadow-2xl"
          >
            <button
              type="button"
              class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
              @click="openProfile"
            >
              Profile
            </button>
            <button
              type="button"
              class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
              @click="openSettings"
            >
              Settings
            </button>
            <div class="my-1 border-t border-gray-800"></div>
            <button
              type="button"
              class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-red-900/20 disabled:opacity-60"
              :disabled="accountActionBusy"
              @click="signOut"
            >
              {{ accountActionBusy ? 'Signing out...' : 'Sign out' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/api";
import { useSWR } from "@/composables/useSWR";
import { CACHE_TTL, POLL_INTERVALS } from "@/constants/cacheKeys";
import {
  Bars3Icon,
  BellIcon,
  UserCircleIcon,
  ChevronDownIcon,
} from "@heroicons/vue/24/outline";

defineEmits(["toggleSidebar"]);

const route = useRoute();
const router = useRouter();
const notificationsOpen = ref(false);
const notificationsActionBusy = ref(false);
const notificationsContainerRef = ref(null);
const accountMenuOpen = ref(false);
const accountActionBusy = ref(false);
const accountContainerRef = ref(null);

const { data: userResponse } = useSWR(
  "header:user",
  () => api.getUserProfile(),
  { ttl: CACHE_TTL.LONG, pollInterval: POLL_INTERVALS.SLOW, pollOnlyWhenVisible: true }
);

const accountUsername = computed(() => {
  const username = userResponse.value?.username;
  return typeof username === 'string' && username.trim() ? username : 'admin';
});

const { data: notificationsResponse, refresh: refreshNotifications } = useSWR(
  "header:notifications:list",
  () => api.getNotifications({ page: 1, limit: 10, filter: "all" }),
  { ttl: CACHE_TTL.SHORT, pollInterval: POLL_INTERVALS.FAST, pollOnlyWhenVisible: true }
);

const { data: unreadResponse, refresh: refreshUnreadCount } = useSWR(
  "header:notifications:unread",
  () => api.getUnreadNotificationCount(),
  { ttl: CACHE_TTL.SHORT, pollInterval: POLL_INTERVALS.FAST, pollOnlyWhenVisible: true }
);

const notifications = computed(() => {
  const rows = Array.isArray(notificationsResponse.value?.data) ? notificationsResponse.value.data : [];
  return [...rows];
});

const unreadNotifications = computed(() => notifications.value.filter((row) => !row.isRead));
const readNotifications = computed(() => notifications.value.filter((row) => row.isRead));
const unreadCount = computed(() => {
  const unread = Number(unreadResponse.value?.unread);
  if (Number.isFinite(unread)) return unread;
  return unreadNotifications.value.length;
});

function typeIcon(type) {
  switch (type) {
    case "awaiting_decision":
      return "🚨";
    case "error":
      return "⚠️";
    case "connection_lost":
      return "⚡";
    case "connection_restored":
      return "✅";
    case "budget_warning":
      return "💰";
    case "sync_completed":
      return "🗂️";
    case "enrichment_completed":
      return "🎬";
    case "policy_suggestion":
      return "💡";
    case "update_available":
      return "🆕";
    default:
      return "ℹ️";
  }
}

function formatRelativeTime(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function normalizeAnchor(anchor) {
  if (!anchor) return "";
  return anchor.startsWith("#") ? anchor : `#${anchor}`;
}

async function refreshNotificationsData() {
  await Promise.all([refreshNotifications(), refreshUnreadCount()]);
}

function toggleNotificationsPanel() {
  closeAccountMenu();
  notificationsOpen.value = !notificationsOpen.value;
  if (notificationsOpen.value) {
    refreshNotificationsData();
  }
}

function closeNotificationsPanel() {
  notificationsOpen.value = false;
}

function toggleAccountMenu() {
  closeNotificationsPanel();
  accountMenuOpen.value = !accountMenuOpen.value;
}

function closeAccountMenu() {
  accountMenuOpen.value = false;
}

async function markAllRead() {
  notificationsActionBusy.value = true;
  try {
    await api.markAllNotificationsRead();
    await refreshNotificationsData();
  } finally {
    notificationsActionBusy.value = false;
  }
}

async function toggleReadState(notification) {
  notificationsActionBusy.value = true;
  try {
    if (notification.isRead) {
      await api.markNotificationUnread(notification.id);
    } else {
      await api.markNotificationRead(notification.id);
    }
    await refreshNotificationsData();
  } finally {
    notificationsActionBusy.value = false;
  }
}

async function deleteNotification(notification) {
  notificationsActionBusy.value = true;
  try {
    await api.deleteNotification(notification.id);
    await refreshNotificationsData();
  } finally {
    notificationsActionBusy.value = false;
  }
}

async function clearAllNotifications() {
  const confirmed = window.confirm('Delete all notifications? This cannot be undone.');
  if (!confirmed) return;

  notificationsActionBusy.value = true;
  try {
    await api.clearAllNotifications();
    await refreshNotificationsData();
  } finally {
    notificationsActionBusy.value = false;
  }
}

async function openNotification(notification) {
  notificationsActionBusy.value = true;
  try {
    if (!notification.isRead) {
      await api.markNotificationRead(notification.id);
    }
    const routeTarget = {
      path: notification.targetPath || "/",
      hash: normalizeAnchor(notification.targetAnchor),
    };
    await router.push(routeTarget);
    await refreshNotificationsData();
    closeNotificationsPanel();
  } finally {
    notificationsActionBusy.value = false;
  }
}

function goToAllNotifications() {
  router.push("/notifications");
  closeNotificationsPanel();
}

function openProfile() {
  router.push({ path: '/settings', query: { tab: 'profile' } });
  closeAccountMenu();
}

function openSettings() {
  router.push('/settings');
  closeAccountMenu();
}

async function signOut() {
  accountActionBusy.value = true;
  try {
    const refreshToken = sessionStorage.getItem('classifarr_refresh_token')
    await api.logout(refreshToken)
  } catch {
    // Proceed with local sign-out even if server-side audit/logout fails.
  } finally {
    sessionStorage.removeItem('classifarr_refresh_token')
    accountActionBusy.value = false;
    closeAccountMenu();
    closeNotificationsPanel();
    router.push('/login');
  }
}

function handleDocumentClick(event) {
  const container = notificationsContainerRef.value;
  if (container && !container.contains(event.target)) {
    closeNotificationsPanel();
  }
  const accountContainer = accountContainerRef.value;
  if (accountContainer && !accountContainer.contains(event.target)) {
    closeAccountMenu();
  }
}

watch(
  () => route.fullPath,
  () => {
    closeNotificationsPanel();
    closeAccountMenu();
  }
);

onMounted(() => {
  document.addEventListener("mousedown", handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleDocumentClick);
});
</script>
