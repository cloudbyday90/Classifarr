<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal
    v-model="isOpen"
    :title="modalTitle"
    class="max-w-6xl"
  >
    <div class="space-y-6">
      <!-- Library Context (read-only) with Lock Icon -->
      <div class="flex items-center gap-3 p-3 bg-background-light rounded-lg border border-gray-700">
        <span class="text-2xl">🔒</span>
        <div class="flex-1">
          <div class="text-sm text-gray-400">
            Library
          </div>
          <div class="font-medium">
            {{ currentLibrary?.name || 'Unknown Library' }}
          </div>
        </div>
      </div>

      <div
        v-if="presetMigrationNotice"
        class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <span class="text-xl leading-none">⚠️</span>
            <div class="space-y-2">
              <div class="font-medium text-amber-200">
                Legacy preset attachments were auto-dropped after upgrade
              </div>
              <p class="text-sm text-amber-100/90">
                {{ presetMigrationNotice.summary }}
              </p>
              <p
                v-if="presetMigrationNotice.preview"
                class="text-xs text-amber-100/80"
              >
                {{ presetMigrationNotice.preview }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs px-2 py-1 rounded-sm border border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
            @click="dismissPresetMigrationNotice"
          >
            Dismiss
          </button>
        </div>
      </div>

      <!-- Suggested Presets Section -->
      <div
        v-if="suggestedPresets.length > 0"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
            <span>✨</span> Suggested
          </h3>
          <button
            class="text-xs px-2 py-1 bg-blue-500/20 text-primary rounded-sm hover:bg-blue-500/30 transition-colors"
            @click="addAllSuggested"
          >
            + Add All
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="preset in suggestedPresets"
            :key="'suggested-' + preset.id"
            class="flex items-center gap-3 p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:bg-gray-800"
            :class="isPresetSelected(preset.id) 
              ? 'bg-green-500/10 border-success' 
              : 'bg-blue-500/10 border-primary'"
            @click="togglePresetSelection(preset)"
          >
            <div
              v-if="isPresetSelected(preset.id)"
              class="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center"
            >
              <span class="text-white text-xs font-bold">✓</span>
            </div>
            <div
              v-else
              class="shrink-0 w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center hover:border-primary"
            >
              <span class="text-gray-500 text-xs">+</span>
            </div>
            <span class="text-lg">{{ preset.icon || '📦' }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">
                {{ preset.name }}
              </div>
              <div class="text-xs text-gray-400">
                Suggestion score: {{ preset.suggestion_score ?? preset.match_score ?? 0 }}
              </div>
              <div
                v-if="preset.source === 'custom'"
                class="text-[11px] text-blue-300"
              >
                My Preset
              </div>
              <div
                v-if="hasRuntimeSemanticsWarning(preset)"
                class="text-[11px] text-amber-400"
              >
                Review runtime behavior
              </div>
              <div class="text-[11px] text-gray-500 truncate">
                {{ formatUsageLabel(getPresetUsageCount(preset)) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in categoryTabs"
            :key="cat.value"
            class="px-3 py-1.5 text-sm rounded-lg transition-colors"
            :class="selectedCategory === cat.value 
              ? 'bg-primary text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
            @click="selectedCategory = cat.value"
          >
            {{ cat.label }} 
            <span
              v-if="cat.count"
              class="text-xs opacity-70"
            >({{ cat.count }})</span>
          </button>
        </div>

        <!-- Search -->
        <input 
          v-model="searchQuery"
          type="search"
          placeholder="Search presets..."
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-primary focus:outline-hidden text-white placeholder-gray-500"
        >
      </div>

      <!-- Preset Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="preset in filteredAvailablePresets"
          :key="preset.id"
          class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-800"
          :class="isPresetSelected(preset.id) 
            ? 'bg-green-500/10 border-success' 
            : 'bg-background-light border-gray-700'"
          @click="togglePresetSelection(preset)"
        >
          <div
            v-if="isPresetSelected(preset.id)"
            class="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center"
          >
            <span class="text-white text-xs font-bold">✓</span>
          </div>
          <div
            v-else
            class="shrink-0 w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center hover:border-primary"
          >
            <span class="text-gray-500 text-xs">+</span>
          </div>
          <span class="text-lg">{{ preset.icon || '📦' }}</span>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">
              {{ preset.name }}
            </div>
            <div class="text-xs text-gray-400 truncate">
              {{ preset.description || preset.category }}
            </div>
            <div class="text-[11px] text-gray-500 truncate">
              {{ formatUsageLabel(getPresetUsageCount(preset)) }}
            </div>
          </div>
          <span 
            v-if="preset.source === 'custom'" 
            class="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded-sm"
          >
            Custom
          </span>
        </div>
        
        <div
          v-if="filteredAvailablePresets.length === 0"
          class="col-span-2 text-center py-8 text-gray-400"
        >
          No presets found matching your search
        </div>
      </div>

      <div class="border-t border-gray-700 my-4" />

      <PolicyIntentEditor
        :selected-presets="selectedPresets"
        :all-presets="allPresets"
        :intent-draft="intentDraft"
        :available-genres="availableGenres"
        :available-ratings="availableRatings"
        @draft-add-signal="addIntentSignal"
        @draft-set-signal-config="setIntentSignalConfig"
        @draft-clear-signal-config="clearIntentSignalConfig"
      />

      <!-- Starter template details backed by legacy preset storage -->
      <div class="space-y-4">
        <!-- Selected starter template summary -->
        <div
          v-if="selectedPresets.length > 0"
          class="border border-gray-700 rounded-lg p-4"
        >
          <h4 class="font-semibold mb-3">
            Starter Templates ({{ selectedPresets.length }})
          </h4>
          <div class="space-y-3">
            <div 
              v-for="sp in selectedPresets" 
              :key="sp.id" 
              class="bg-background-light rounded-lg overflow-hidden"
            >
              <!-- Preset header row -->
              <div class="flex items-center gap-3 text-sm p-3">
                <span class="text-lg">{{ sp.icon || '📦' }}</span>
                <span class="flex-1 font-medium">{{ sp.name }}</span>
                <span
                  v-if="getPresetRuntimeBadge(sp)"
                  class="text-[11px] px-2 py-0.5 rounded-full"
                  :class="getPresetRuntimeBadge(sp).className"
                >
                  {{ getPresetRuntimeBadge(sp).label }}
                </span>
                <button 
                  class="text-xs px-2 py-1 border rounded-sm hover:bg-gray-700"
                  :class="expandedPresetIds.has(sp.id) ? 'border-primary text-primary' : 'border-gray-600 text-gray-400'"
                  @click="togglePresetCustomize(sp.id)"
                >
                  {{ expandedPresetIds.has(sp.id) ? '▲ Close details' : '▼ Details' }}
                </button>
                <input 
                  v-model.number="sp.weight" 
                  type="number" 
                  min="0.1" 
                  max="2" 
                  step="0.1"
                  class="w-16 px-2 py-1 bg-background border border-gray-700 rounded-sm text-center text-sm"
                >
                <button 
                  class="text-red-400 hover:text-red-300 text-xl leading-none" 
                  @click="removePreset(sp.id)"
                >
                  ×
                </button>
              </div>
              
              <!-- Advanced template details panel -->
              <div
                v-if="expandedPresetIds.has(sp.id)"
                class="border-t border-gray-700 p-3 space-y-3 text-xs"
              >
                <!-- Content Ratings -->
                <div>
                  <label class="font-medium text-gray-300 block mb-1">Content Ratings:</label>
                  <div class="flex flex-wrap gap-1">
                    <!-- Base preset signals (can be removed) -->
                    <span 
                      v-for="cert in getPresetBaseSignals(sp, 'certifications', 'include')" 
                      :key="'base-inc-'+cert"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'certifications', 'include', cert)}"
                    >
                      {{ cert }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button
                        v-if="!isSignalRemoved(sp, 'certifications', 'include', cert)"
                        class="hover:text-red-400"
                        title="Remove"
                        @click="markSignalRemoved(sp, 'certifications', 'include', cert)"
                      >×</button>
                      <button
                        v-else
                        class="hover:text-green-400"
                        title="Restore"
                        @click="unmarkSignalRemoved(sp, 'certifications', 'include', cert)"
                      >↩</button>
                    </span>
                    <!-- Custom added signals -->
                    <span 
                      v-for="cert in getCustomSignalList(sp, 'certifications', 'include')" 
                      :key="'cust-inc-'+cert"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm"
                    >
                      + {{ cert }}
                      <button
                        class="hover:text-red-400"
                        @click="removeCustomSignal(sp, 'certifications', 'include', cert)"
                      >×</button>
                    </span>
                    <select
                      class="px-2 py-0.5 bg-background border border-gray-700 rounded-sm"
                      @change="addCustomSignal(sp, 'certifications', $event)"
                    >
                      <option value="">
                        + Add
                      </option>
                      <optgroup label="Include">
                        <option
                          v-for="r in availableRatings"
                          :key="'inc-'+r"
                          :value="'include:' + r"
                        >
                          ✓ {{ r }}
                        </option>
                      </optgroup>
                    </select>
                  </div>
                </div>
                
                <!-- Genres -->
                <div>
                  <label class="font-medium text-gray-300 block mb-1">Genres:</label>
                  <div class="flex flex-wrap gap-1">
                    <!-- Base preset signals (can be removed) -->
                    <span 
                      v-for="g in getPresetBaseSignals(sp, 'genres', 'prefer')" 
                      :key="'base-pref-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'genres', 'prefer', g)}"
                    >
                      {{ g }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button
                        v-if="!isSignalRemoved(sp, 'genres', 'prefer', g)"
                        class="hover:text-red-400"
                        title="Remove"
                        @click="markSignalRemoved(sp, 'genres', 'prefer', g)"
                      >×</button>
                      <button
                        v-else
                        class="hover:text-green-400"
                        title="Restore"
                        @click="unmarkSignalRemoved(sp, 'genres', 'prefer', g)"
                      >↩</button>
                    </span>
                    <!-- Excluded genres from base -->
                    <span 
                      v-for="g in getPresetBaseSignals(sp, 'genres', 'exclude')" 
                      :key="'base-exc-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'genres', 'exclude', g)}"
                    >
                      ✕ {{ g }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button
                        v-if="!isSignalRemoved(sp, 'genres', 'exclude', g)"
                        class="hover:text-white"
                        title="Remove"
                        @click="markSignalRemoved(sp, 'genres', 'exclude', g)"
                      >×</button>
                      <button
                        v-else
                        class="hover:text-green-400"
                        title="Restore"
                        @click="unmarkSignalRemoved(sp, 'genres', 'exclude', g)"
                      >↩</button>
                    </span>
                    <!-- Custom added signals -->
                    <span 
                      v-for="g in getCustomSignalList(sp, 'genres', 'prefer')" 
                      :key="'cust-pref-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
                    >
                      + {{ g }}
                      <button
                        class="hover:text-red-400"
                        @click="removeCustomSignal(sp, 'genres', 'prefer', g)"
                      >×</button>
                    </span>
                    <select
                      class="px-2 py-0.5 bg-background border border-gray-700 rounded-sm"
                      @change="addCustomSignal(sp, 'genres', $event)"
                    >
                      <option value="">
                        + Add
                      </option>
                      <optgroup label="Prefer">
                        <option
                          v-for="g in availableGenres"
                          :key="'pref-'+g"
                          :value="'prefer:' + g"
                        >
                          ✓ {{ g }}
                        </option>
                      </optgroup>
                      <optgroup label="Exclude">
                        <option
                          v-for="g in availableGenres"
                          :key="'exc-'+g"
                          :value="'exclude:' + g"
                        >
                          ✕ {{ g }}
                        </option>
                      </optgroup>
                    </select>
                  </div>
                </div>
                
                <!-- Keywords -->
                <div>
                  <label class="font-medium text-gray-300 block mb-1">Keywords:</label>
                  <div class="flex flex-wrap gap-1">
                    <!-- Excluded keywords from base -->
                    <span 
                      v-for="k in getPresetBaseSignals(sp, 'keywords', 'exclude')" 
                      :key="'base-exc-'+k"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'keywords', 'exclude', k)}"
                    >
                      ✕ {{ k }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button
                        v-if="!isSignalRemoved(sp, 'keywords', 'exclude', k)"
                        class="hover:text-white"
                        title="Remove"
                        @click="markSignalRemoved(sp, 'keywords', 'exclude', k)"
                      >×</button>
                      <button
                        v-else
                        class="hover:text-green-400"
                        title="Restore"
                        @click="unmarkSignalRemoved(sp, 'keywords', 'exclude', k)"
                      >↩</button>
                    </span>
                    <!-- Custom added keywords -->
                    <span 
                      v-for="k in getCustomSignalList(sp, 'keywords', 'require_any')" 
                      :key="'cust-req-'+k"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
                    >
                      + {{ k }}
                      <button
                        class="hover:text-red-400"
                        @click="removeCustomSignal(sp, 'keywords', 'require_any', k)"
                      >×</button>
                    </span>
                    <input 
                      v-model="newKeyword"
                      type="text"
                      placeholder="+ keyword (Enter)"
                      class="w-32 px-2 py-0.5 bg-background border border-gray-700 rounded-sm"
                      @keydown.enter="addKeywordToPreset(sp)"
                    >
                  </div>
                </div>

                <div v-if="hasPresetLanguageSignals(sp)">
                  <label class="font-medium text-gray-300 block mb-1">Language / Regional:</label>
                  <div class="space-y-2">
                    <div class="flex flex-wrap gap-1">
                      <span 
                        v-for="lang in getPresetBaseSignals(sp, 'language', 'require_any')" 
                        :key="'base-lang-req-' + lang"
                        class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm"
                      >
                        {{ formatLanguageCode(lang) }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      </span>
                      <span 
                        v-for="lang in getPresetBaseSignals(sp, 'language', 'exclude')" 
                        :key="'base-lang-exc-' + lang"
                        class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
                      >
                        ✕ {{ formatLanguageCode(lang) }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      </span>
                      <span 
                        v-for="lang in getCustomSignalList(sp, 'language', 'require_any')" 
                        :key="'cust-lang-req-' + lang"
                        class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
                      >
                        + {{ formatLanguageCode(lang) }}
                        <button
                          class="hover:text-red-400"
                          @click="removeCustomSignal(sp, 'language', 'require_any', lang)"
                        >×</button>
                      </span>
                      <span 
                        v-for="lang in getCustomSignalList(sp, 'language', 'exclude')" 
                        :key="'cust-lang-exc-' + lang"
                        class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
                      >
                        + exclude {{ formatLanguageCode(lang) }}
                        <button
                          class="hover:text-white"
                          @click="removeCustomSignal(sp, 'language', 'exclude', lang)"
                        >×</button>
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-gray-400">Runtime mode:</span>
                      <button
                        class="px-2 py-1 rounded-sm border transition-colors"
                        :class="getPresetSignalStrict(sp, 'language') ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-primary text-primary bg-primary/10'"
                        @click="setPresetSignalStrict(sp, 'language', false)"
                      >
                        Advisory
                      </button>
                      <button
                        class="px-2 py-1 rounded-sm border transition-colors"
                        :class="getPresetSignalStrict(sp, 'language') ? 'border-amber-400 text-amber-300 bg-amber-500/10' : 'border-gray-600 text-gray-400 hover:bg-gray-700'"
                        @click="setPresetSignalStrict(sp, 'language', true)"
                      >
                        Strict
                      </button>
                    </div>
                    <p class="text-[11px] text-gray-500">
                      {{ getPresetRuntimeSummary(sp) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Combined Signals Summary (when multiple presets selected) -->
        <div
          v-if="selectedPresets.length > 1"
          class="border border-primary/30 rounded-lg p-4 bg-primary/5"
        >
          <h4 class="font-semibold mb-3 flex items-center gap-2">
            <span class="text-primary">🔗</span>
            Combined Signals ({{ selectedPresets.length }} presets)
          </h4>
          <div class="space-y-3 text-sm">
            <!-- Combined Content Ratings -->
            <div v-if="combinedSignals.certifications.include.length">
              <label class="font-medium text-gray-300 block mb-1">Content Ratings (included):</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.certifications.include" 
                  :key="'comb-cert-'+item.value"
                  class="px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Genres (Prefer) -->
            <div v-if="combinedSignals.genres.prefer.length">
              <label class="font-medium text-gray-300 block mb-1">Preferred Genres:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.genres.prefer" 
                  :key="'comb-genre-'+item.value"
                  class="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Genres (Exclude) -->
            <div v-if="combinedSignals.genres.exclude.length">
              <label class="font-medium text-gray-300 block mb-1">Excluded Genres:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.genres.exclude" 
                  :key="'comb-exc-'+item.value"
                  class="px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  ✕ {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Keywords (Excluded) -->
            <!-- Combined Keywords (Preferred) -->
            <div v-if="combinedSignals.keywords.prefer.length">
              <label class="font-medium text-gray-300 block mb-1">Preferred Keywords:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.keywords.prefer" 
                  :key="'comb-pref-'+item.value"
                  class="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Keywords (Excluded) -->
            <div v-if="combinedSignals.keywords.exclude.length">
              <label class="font-medium text-gray-300 block mb-1">Excluded Keywords:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.keywords.exclude" 
                  :key="'comb-kw-'+item.value"
                  class="px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  ✕ {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Keywords (Required) -->
            <div v-if="combinedSignals.keywords.require_any.length">
              <label class="font-medium text-gray-300 block mb-1">Required Keywords (any match):</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.keywords.require_any" 
                  :key="'comb-req-'+item.value"
                  class="px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced Settings (Collapsible) -->
      <div class="space-y-4">
        <button 
          class="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors" 
          @click="showAdvanced = !showAdvanced"
        >
          <span>{{ showAdvanced ? '▼' : '▶' }}</span>
          <span>⚙️ Advanced Settings</span>
        </button>
        
        <div
          v-if="showAdvanced"
          class="space-y-6 pl-6"
        >
          <!-- Weights -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">
              Scoring Weights
            </h3>
            <p class="text-sm text-gray-400">
              Adjust how much each factor contributes to the final score
            </p>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">
                  Presets: {{ Math.round(form.preset_weight * 100) }}%
                </label>
                <input 
                  v-model.number="form.preset_weight" 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-2">
                  Profile: {{ Math.round(form.profile_weight * 100) }}%
                </label>
                <input 
                  v-model.number="form.profile_weight" 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                >
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">
                  Patterns: {{ Math.round(form.pattern_weight * 100) }}%
                </label>
                <input 
                  v-model.number="form.pattern_weight" 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-2">
                  RAG: {{ Math.round(form.rag_weight * 100) }}%
                </label>
                <input 
                  v-model.number="form.rag_weight" 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-2">
                  History: {{ Math.round(form.history_weight * 100) }}%
                </label>
                <input 
                  v-model.number="form.history_weight" 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                >
              </div>
            </div>
            
            <div 
              class="text-sm p-3 rounded-lg"
              :class="Math.abs(totalWeight - 1) > 0.001 ? 'bg-yellow-900/20 text-yellow-400' : 'bg-green-900/20 text-green-400'"
            >
              Total: {{ Math.round(totalWeight * 100) }}% 
              <span v-if="Math.abs(totalWeight - 1) > 0.001">(should equal 100%)</span>
              <span v-else>✓</span>
            </div>
          </div>

          <!-- Combination Mode -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">
              Combination Mode
            </h3>
            <div class="space-y-2">
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  v-model="form.combination_mode" 
                  type="radio" 
                  value="best_match" 
                  class="w-4 h-4"
                >
                <div>
                  <div class="font-medium">Best Match</div>
                  <div class="text-xs text-gray-400">Use highest scoring preset</div>
                </div>
              </label>
              
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  v-model="form.combination_mode" 
                  type="radio" 
                  value="average" 
                  class="w-4 h-4"
                >
                <div>
                  <div class="font-medium">Average</div>
                  <div class="text-xs text-gray-400">Average all matching preset scores</div>
                </div>
              </label>
              
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  v-model="form.combination_mode" 
                  type="radio" 
                  value="weighted_average" 
                  class="w-4 h-4"
                >
                <div>
                  <div class="font-medium">Weighted Average</div>
                  <div class="text-xs text-gray-400">Use preset weights</div>
                </div>
              </label>
              
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  v-model="form.combination_mode" 
                  type="radio" 
                  value="require_all" 
                  class="w-4 h-4"
                >
                <div>
                  <div class="font-medium">Require All</div>
                  <div class="text-xs text-gray-400">All presets must match</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Classification Thresholds -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">
          Classification Thresholds
        </h3>
        
        <div>
          <label class="block text-sm font-medium mb-2">
            Auto-classify threshold: {{ form.auto_classify_threshold }}%
          </label>
          <input 
            v-model.number="form.auto_classify_threshold" 
            type="range" 
            min="50" 
            max="95" 
            class="w-full"
          >
          <p class="text-xs text-gray-400 mt-1">
            Items scoring above this will be auto-classified
          </p>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-2">
            Prompt threshold: {{ form.prompt_threshold }}%
          </label>
          <input 
            v-model.number="form.prompt_threshold" 
            type="range" 
            min="30" 
            max="80" 
            class="w-full"
          >
          <p class="text-xs text-gray-400 mt-1">
            Items scoring above this will prompt for confirmation
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        variant="ghost"
        @click="$emit('close')"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        :disabled="!isValid"
        @click="save"
      >
        {{ hasExistingPresets ? 'Save Policy' : 'Create Policy' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted, toRef } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import { usePolicyBuilderCombinedSignals } from '@/composables/usePolicyBuilderCombinedSignals'
import { usePolicyBuilderReferenceData } from '@/composables/usePolicyBuilderReferenceData'
import { usePolicyBuilderState } from '@/composables/usePolicyBuilderState'
import { usePolicyBuilderTemplateSignals } from '@/composables/usePolicyBuilderTemplateSignals'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  policy: {
    type: Object,
    default: null,
  },
  libraryId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'close'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const modalTitle = computed(() => {
  const libraryName = currentLibrary.value?.name || 'New'
  return `${libraryName} Policy`
})

const showAdvanced = ref(false)

const referenceData = usePolicyBuilderReferenceData()
const {
  libraries,
  allPresets,
  suggestedPresets,
  searchQuery,
  selectedCategory,
  presetMigrationNotice,
  categoryTabs,
  availableRatings,
  availableGenres,
  getFilteredAvailablePresets,
  getPresetUsageCount,
  formatUsageLabel,
  loadInitialData,
  dismissPresetMigrationNotice,
  watchSuggestedPresets,
} = referenceData

const {
  form,
  selectedPresets,
  intentDraft,
  expandedPresetIds,
  totalWeight,
  currentLibrary,
  hasExistingPresets,
  isValid,
  isPresetSelected,
  togglePresetSelection,
  addAllSuggested: addPresetSuggestions,
  removePreset,
  togglePresetCustomize,
  getCustomSignalList,
  addCustomSignal,
  removeCustomSignal,
  addIntentSignal,
  setIntentSignalConfig,
  setIntentSignalMetadata,
  setIntentSignalRemoval,
  clearIntentSignalConfig,
  cleanupCustomSignals,
  buildSavePayload,
} = usePolicyBuilderState({
  policy: toRef(props, 'policy'),
  libraryId: toRef(props, 'libraryId'),
  libraries,
})

const {
  newKeyword,
  getPresetBaseSignals,
  getPresetBaseSignalConfig,
  hasPresetLanguageSignals,
  hasRuntimeSemanticsWarning,
  getPresetRuntimeBadge,
  getPresetRuntimeSummary,
  getPresetSignalStrict,
  isSignalRemoved,
  addKeywordToPreset,
  formatLanguageCode,
} = usePolicyBuilderTemplateSignals({
  allPresets,
  cleanupCustomSignals,
})

const {
  combinedSignals,
} = usePolicyBuilderCombinedSignals({
  selectedPresets,
  allPresets,
})

// Filtered available presets (not yet selected)
const filteredAvailablePresets = computed(() => {
  return getFilteredAvailablePresets(selectedPresets.value)
})

onMounted(loadInitialData)

watchSuggestedPresets(computed(() => form.value.library_id))

const addAllSuggested = () => {
  addPresetSuggestions(suggestedPresets.value)
}

const getSelectedPresetId = (preset) => preset?.preset_id ?? preset?.id ?? null

const setPresetSignalStrict = (preset, signalType, strict) => {
  setIntentSignalMetadata({
    presetId: getSelectedPresetId(preset),
    signalType,
    metadata: { strict },
    baseMetadata: {
      strict: getPresetBaseSignalConfig(preset, signalType)?.strict === true,
    },
  })
}

const markSignalRemoved = (preset, signalType, key, value) => {
  setIntentSignalRemoval({
    presetId: getSelectedPresetId(preset),
    signalType,
    key,
    value,
    removed: true,
  })
}

const unmarkSignalRemoved = (preset, signalType, key, value) => {
  setIntentSignalRemoval({
    presetId: getSelectedPresetId(preset),
    signalType,
    key,
    value,
    removed: false,
  })
}

const save = async () => {
  if (!isValid.value) return

  const policyData = buildSavePayload()

  try {
    await emit('save', policyData)
  } catch (error) {
    console.error('Failed to save policy:', error)
    alert('Failed to save policy: ' + error.message)
  }
}
</script>
