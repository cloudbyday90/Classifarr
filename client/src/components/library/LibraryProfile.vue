<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <div
    class="library-profile"
    :aria-busy="loading || regenerating"
  >
    <div class="profile-header">
      <h3 class="font-semibold text-lg flex items-center gap-2">
        <span>📊</span> Library Profile
      </h3>
      <button
        :disabled="loading || regenerating"
        aria-describedby="library-profile-regeneration-help"
        class="btn btn-sm btn-ghost"
        type="button"
        @click="regenerateProfile"
      >
        <span v-if="regenerating">Regenerating...</span>
        <span v-else>Regenerate profile</span>
      </button>
    </div>

    <p
      id="library-profile-regeneration-help"
      class="profile-maintenance-help"
    >
      Normal profile generation is server-managed. Regenerate only after an intentional library sync or metadata correction.
    </p>

    <p
      v-if="statusMessage"
      class="profile-status"
      role="status"
    >
      {{ statusMessage }}
    </p>

    <p
      v-if="error"
      class="profile-status profile-status-error"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      v-if="loading"
      class="text-center py-4 text-gray-400"
    >
      Loading profile...
    </div>

    <div
      v-else-if="!profile"
      class="empty-state"
    >
      <p>No profile yet.</p>
      <p class="text-sm text-gray-300">
        The server-managed lifecycle will generate a profile when it has usable synced library data.
      </p>
    </div>

    <div
      v-else
      class="profile-content"
    >
      <!-- Summary -->
      <div class="summary-box">
        <p>
          This library contains <strong>{{ profile.item_count }}</strong> items.
          <span
            v-if="profile.enriched_count < profile.item_count"
            class="text-yellow-400"
          >
            ({{ profile.enriched_count }} enriched)
          </span>
        </p>
        <p class="text-xs text-gray-300 mt-1">
          Last updated: {{ formatDate(profile.last_generated_at) }}
        </p>
      </div>

      <LibraryProfileCoverage :observation="profile.observation_summary" />

      <!-- Rating Distribution -->
      <div
        v-if="hasData(profile.rating_distribution)"
        class="section"
      >
        <h4 class="section-title">
          Rating Distribution
        </h4>
        <div class="distribution-bars">
          <div 
            v-for="(pct, rating) in sortedRatings" 
            :key="rating" 
            class="bar-row"
          >
            <span class="bar-label">{{ rating }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: pct + '%' }"
              />
            </div>
            <span class="bar-value">{{ pct }}%</span>
          </div>
        </div>
      </div>

      <!-- Genre Distribution (Top 5) -->
      <div
        v-if="hasData(profile.genre_distribution)"
        class="section"
      >
        <h4 class="section-title">
          Top Genres
        </h4>
        <div class="tag-list">
          <span 
            v-for="(pct, genre) in topGenres" 
            :key="genre" 
            class="tag tag-genre"
          >
            {{ genre }} ({{ pct }}%)
          </span>
        </div>
      </div>

      <!-- Studio Distribution (Top 5) -->
      <div
        v-if="hasData(profile.studio_distribution)"
        class="section"
      >
        <h4 class="section-title">
          Top Studios
        </h4>
        <div class="tag-list">
          <span 
            v-for="(pct, studio) in topStudios" 
            :key="studio" 
            class="tag tag-studio"
          >
            {{ studio }} ({{ pct }}%)
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, toRef } from 'vue'
import LibraryProfileCoverage from './LibraryProfileCoverage.vue'
import { useLibraryProfileMaintenance } from '@/composables/useLibraryProfileMaintenance'

const props = defineProps({
  libraryId: { type: Number, required: true }
})

const {
  profile,
  loading,
  regenerating,
  error,
  statusMessage,
  loadProfile,
  regenerateProfile,
} = useLibraryProfileMaintenance({
  libraryId: toRef(props, 'libraryId'),
})

const sortedRatings = computed(() => {
  if (!profile.value?.rating_distribution) return {}
  return Object.fromEntries(
    Object.entries(profile.value.rating_distribution)
      .sort((a, b) => b[1] - a[1])
  )
})

const topGenres = computed(() => {
  if (!profile.value?.genre_distribution) return {}
  return Object.fromEntries(
    Object.entries(profile.value.genre_distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  )
})

const topStudios = computed(() => {
  if (!profile.value?.studio_distribution) return {}
  return Object.fromEntries(
    Object.entries(profile.value.studio_distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  )
})

const hasData = (obj) => obj && Object.keys(obj).length > 0

const formatDate = (date) => {
  if (!date) return 'Never'
  return new Date(date).toLocaleString()
}

onMounted(loadProfile)
</script>

<style scoped>
.library-profile {
  background: var(--bg-secondary, #1e1e2e);
  border-radius: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border-color, #313244);
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color, #313244);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted, #6c7086);
}

.profile-maintenance-help {
  margin: 0 0 0.75rem;
  color: var(--text-secondary, #a6adc8);
  font-size: 0.75rem;
}

.profile-status {
  margin: 0 0 0.75rem;
  border: 1px solid rgba(137, 180, 250, 0.5);
  border-radius: 0.375rem;
  background: rgba(137, 180, 250, 0.1);
  color: #b4d0fb;
  padding: 0.5rem 0.625rem;
  font-size: 0.75rem;
}

.profile-status-error {
  border-color: rgba(243, 139, 168, 0.6);
  background: rgba(243, 139, 168, 0.12);
  color: #f8b4c4;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-box {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.section {
  padding-top: 0.5rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--text-secondary, #a6adc8);
}

.distribution-bars {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bar-label {
  width: 4rem;
  font-size: 0.75rem;
  text-align: right;
}

.bar-track {
  flex: 1;
  height: 1rem;
  background: var(--bg-tertiary, #313244);
  border-radius: 0.25rem;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #89b4fa, #74c7ec);
  transition: width 0.3s ease;
}

.bar-value {
  width: 2.5rem;
  font-size: 0.75rem;
  text-align: right;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
}

.tag-genre {
  background: rgba(137, 180, 250, 0.2);
  color: #89b4fa;
}

.tag-studio {
  background: rgba(166, 227, 161, 0.2);
  color: #a6e3a1;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color, #313244);
  color: var(--text-secondary, #a6adc8);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.75rem;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
