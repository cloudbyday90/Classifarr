<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  Licensed under GPL-3.0
-->

<template>
  <div class="live-feed">
    <div
      v-if="items.length === 0"
      class="empty-feed"
    >
      <p>No recent activity</p>
    </div>
    <div
      v-for="item in items"
      :key="`${item.type}-${item.id}`"
      class="feed-item"
      :class="item.type"
    >
      <div class="feed-icon">
        <span v-if="item.type === 'decision'">{{ item.was_correction ? '🔄' : '✅' }}</span>
        <span v-else-if="item.type === 'pattern'">🔗</span>
        <span v-else-if="item.type === 'suggestion'">💡</span>
      </div>
      <div class="feed-content">
        <span class="feed-title">{{ item.title }}</span>
        <span class="feed-meta">
          <span v-if="item.policy_name">{{ item.policy_name }}</span>
          <span v-if="item.library_name">→ {{ item.library_name }}</span>
          <span
            v-if="item.type === 'decision' && item.was_correction"
            class="correction-badge"
          >
            Correction
          </span>
        </span>
      </div>
      <div class="feed-time">
        {{ formatTime(item.created_at) }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LiveFeed',
  props: {
    items: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    }
  }
};
</script>

<style scoped>
.live-feed {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
  overflow: hidden;
}

.empty-feed {
  padding: 40px;
  text-align: center;
  color: #9ca3af;
}

.feed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #374151;
  transition: background 0.2s;
}

.feed-item:last-child {
  border-bottom: none;
}

.feed-item:hover {
  background: #374151;
}

.feed-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.feed-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.feed-title {
  font-weight: 500;
  color: #f9fafb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-meta {
  font-size: 14px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 8px;
}

.correction-badge {
  background: #78350f;
  color: #fef3c7;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
}

.feed-time {
  font-size: 14px;
  color: #6b7280;
  flex-shrink: 0;
}
</style>
