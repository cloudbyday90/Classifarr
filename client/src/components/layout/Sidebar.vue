<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <aside
    :class="[
      'fixed md:static inset-y-0 left-0 w-72 md:w-64 bg-sidebar border-r border-gray-800 flex flex-col transform transition-transform duration-300 ease-in-out z-50',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    ]"
  >
    <!-- Mobile Close Button -->
    <button
      @click="$emit('close')"
      class="absolute top-4 right-4 p-2 text-gray-400 hover:text-white md:hidden"
      aria-label="Close menu"
    >
      <XMarkIcon class="w-6 h-6" />
    </button>

    <div class="px-6 py-5 flex items-center gap-3">
      <img
        src="/logo.png"
        alt="Classifarr Logo"
        class="w-10 h-10 rounded-lg shadow-lg shadow-primary/20"
      />
      <div>
        <h1 class="text-xl font-bold text-white tracking-tight">Classifarr</h1>
        <p
          class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold"
        >
          Media Classifier
        </p>
      </div>
    </div>

    <nav class="flex-1 px-2 overflow-y-auto">
      <div v-for="section in navigationSections" :key="section.label" class="mb-2">
        <div class="section-header">{{ section.label }}</div>
        <router-link
          v-for="item in section.items"
          :key="item.path"
          :to="item.path"
          class="nav-item group relative flex items-center px-4 py-2.5 mb-0.5 transition-colors"
          :class="isActive(item.path, item.aliases) ? 'active' : ''"
        >
          <div class="active-indicator" v-if="isActive(item.path, item.aliases)"></div>
          <component :is="item.icon" class="w-5 h-5 mr-3" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <!-- Offline Banner -->
    <div
      v-if="isOffline"
      class="mx-2 mb-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-center"
    >
      <span
        class="text-xs text-yellow-400 flex items-center justify-center gap-1"
      >
        📡 Offline - Using cached data
      </span>
    </div>

    <div class="p-4 border-t border-gray-800 text-sm text-gray-400">
      <div>v0.42.6-alpha</div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useOnline } from "@vueuse/core";
import {
  Squares2X2Icon,
  FolderIcon,
  DocumentTextIcon,
  CogIcon,
  ServerIcon,
  ChartBarIcon,
  XMarkIcon,
  LightBulbIcon,
  PresentationChartLineIcon,
  DocumentDuplicateIcon,
  SwatchIcon,
} from "@heroicons/vue/24/outline";

defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["close"]);

const route = useRoute();
const online = useOnline();
const isOffline = computed(() => !online.value);

const coreMenuItems = [
  { path: "/", aliases: ["/dashboard"], label: "Command Center", icon: Squares2X2Icon },
  { path: "/libraries", label: "Libraries", icon: FolderIcon },
  { path: "/history", label: "History", icon: DocumentTextIcon },
];

const classificationMenuItems = [
  { path: "/policies", label: "Policies", icon: DocumentDuplicateIcon },
  { path: "/presets", label: "Presets", icon: SwatchIcon },
  { path: "/tuning-suggestions", label: "Tuning", icon: LightBulbIcon },
];

const insightsMenuItems = [
  { path: "/statistics", label: "Statistics", icon: ChartBarIcon },
  {
    path: "/policy-stats",
    label: "Policy Stats",
    icon: PresentationChartLineIcon,
  },
];

const adminMenuItems = [
  { path: "/settings", label: "Settings", icon: CogIcon },
  { path: "/system", label: "System", icon: ServerIcon },
];

const navigationSections = computed(() => {
  return [
    { label: "Core", items: coreMenuItems },
    { label: "Classification", items: classificationMenuItems },
    { label: "Insights", items: insightsMenuItems },
    { label: "Admin", items: adminMenuItems },
  ];
});

const isActive = (path, aliases = []) => {
  if (path === "/") {
    return route.path === "/" || aliases.includes(route.path);
  }
  if (aliases.includes(route.path)) {
    return true;
  }
  return route.path.startsWith(path);
};
</script>

<style scoped>
@reference "../../style.css";

.section-header {
  @apply text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2 mt-2;
}

.nav-item {
  @apply text-gray-300 relative rounded-md text-sm;
}

.nav-item:hover {
  @apply bg-background-light;
}

.nav-item.active {
  @apply bg-background-light text-white;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: #3b82f6;
  border-radius: 0 2px 2px 0;
}
</style>
