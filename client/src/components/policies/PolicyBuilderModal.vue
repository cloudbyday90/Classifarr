<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal v-model="isOpen" :title="modalTitle" class="max-w-6xl">
    <div class="space-y-6">
      <!-- Library Context (read-only) with Lock Icon -->
      <div class="flex items-center gap-3 p-3 bg-background-light rounded-lg border border-gray-700">
        <span class="text-2xl">🔒</span>
        <div class="flex-1">
          <div class="text-sm text-gray-400">Library</div>
          <div class="font-medium">{{ currentLibrary?.name || 'Unknown Library' }}</div>
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
      <div v-if="suggestedPresets.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
            <span>✨</span> Suggested
          </h3>
          <button
            @click="addAllSuggested"
            class="text-xs px-2 py-1 bg-blue-500/20 text-primary rounded-sm hover:bg-blue-500/30 transition-colors"
          >
            + Add All
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="preset in suggestedPresets"
            :key="'suggested-' + preset.id"
            @click="togglePresetSelection(preset)"
            class="flex items-center gap-3 p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:bg-gray-800"
            :class="isPresetSelected(preset.id) 
              ? 'bg-green-500/10 border-success' 
              : 'bg-blue-500/10 border-primary'"
          >
            <div v-if="isPresetSelected(preset.id)" class="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center">
              <span class="text-white text-xs font-bold">✓</span>
            </div>
            <div v-else class="shrink-0 w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center hover:border-primary">
              <span class="text-gray-500 text-xs">+</span>
            </div>
            <span class="text-lg">{{ preset.icon || '📦' }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ preset.name }}</div>
              <div class="text-xs text-gray-400">
                Suggestion score: {{ preset.suggestion_score ?? preset.match_score ?? 0 }}
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
            @click="selectedCategory = cat.value"
            class="px-3 py-1.5 text-sm rounded-lg transition-colors"
            :class="selectedCategory === cat.value 
              ? 'bg-primary text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
          >
            {{ cat.label }} 
            <span v-if="cat.count" class="text-xs opacity-70">({{ cat.count }})</span>
          </button>
        </div>

        <!-- Search -->
        <input 
          v-model="searchQuery"
          type="search"
          placeholder="Search presets..."
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-primary focus:outline-hidden text-white placeholder-gray-500"
        />
      </div>

      <!-- Preset Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="preset in filteredAvailablePresets"
          :key="preset.id"
          @click="togglePresetSelection(preset)"
          class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-800"
          :class="isPresetSelected(preset.id) 
            ? 'bg-green-500/10 border-success' 
            : 'bg-background-light border-gray-700'"
        >
          <div v-if="isPresetSelected(preset.id)" class="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center">
            <span class="text-white text-xs font-bold">✓</span>
          </div>
          <div v-else class="shrink-0 w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center hover:border-primary">
            <span class="text-gray-500 text-xs">+</span>
          </div>
          <span class="text-lg">{{ preset.icon || '📦' }}</span>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ preset.name }}</div>
            <div class="text-xs text-gray-400 truncate">{{ preset.description || preset.category }}</div>
            <div
              v-if="preset.source !== 'custom'"
              class="text-[11px] text-gray-500 truncate"
            >
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
        
        <div v-if="filteredAvailablePresets.length === 0" class="col-span-2 text-center py-8 text-gray-400">
          No presets found matching your search
        </div>
      </div>

      <div class="border-t border-gray-700 my-4"></div>

      <!-- Preset Selection (was "Select Presets") -->
      <div class="space-y-4">
        
        <!-- Selected presets summary -->
        <div v-if="selectedPresets.length > 0" class="border border-gray-700 rounded-lg p-4">
          <h4 class="font-semibold mb-3">Selected Presets ({{ selectedPresets.length }})</h4>
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
                  @click="togglePresetCustomize(sp.id)"
                  class="text-xs px-2 py-1 border rounded-sm hover:bg-gray-700"
                  :class="expandedPresetIds.has(sp.id) ? 'border-primary text-primary' : 'border-gray-600 text-gray-400'"
                >
                  {{ expandedPresetIds.has(sp.id) ? '▲ Close' : '▼ Customize' }}
                </button>
                <input 
                  type="number" 
                  v-model.number="sp.weight" 
                  min="0.1" 
                  max="2" 
                  step="0.1"
                  class="w-16 px-2 py-1 bg-background border border-gray-700 rounded-sm text-center text-sm"
                />
                <button 
                  @click="removePreset(sp.id)" 
                  class="text-red-400 hover:text-red-300 text-xl leading-none"
                >
                  ×
                </button>
              </div>
              
              <!-- Customization panel -->
              <div v-if="expandedPresetIds.has(sp.id)" class="border-t border-gray-700 p-3 space-y-3 text-xs">
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
                      <button v-if="!isSignalRemoved(sp, 'certifications', 'include', cert)" @click="markSignalRemoved(sp, 'certifications', 'include', cert)" class="hover:text-red-400" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'certifications', 'include', cert)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Custom added signals -->
                    <span 
                      v-for="cert in getCustomSignalList(sp, 'certifications', 'include')" 
                      :key="'cust-inc-'+cert"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm"
                    >
                      + {{ cert }}
                      <button @click="removeCustomSignal(sp, 'certifications', 'include', cert)" class="hover:text-red-400">×</button>
                    </span>
                    <select @change="addCustomSignal(sp, 'certifications', $event)" class="px-2 py-0.5 bg-background border border-gray-700 rounded-sm">
                      <option value="">+ Add</option>
                      <optgroup label="Include">
                        <option v-for="r in availableRatings" :key="'inc-'+r" :value="'include:' + r">✓ {{ r }}</option>
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
                      <button v-if="!isSignalRemoved(sp, 'genres', 'prefer', g)" @click="markSignalRemoved(sp, 'genres', 'prefer', g)" class="hover:text-red-400" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'genres', 'prefer', g)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Excluded genres from base -->
                    <span 
                      v-for="g in getPresetBaseSignals(sp, 'genres', 'exclude')" 
                      :key="'base-exc-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'genres', 'exclude', g)}"
                    >
                      ✕ {{ g }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button v-if="!isSignalRemoved(sp, 'genres', 'exclude', g)" @click="markSignalRemoved(sp, 'genres', 'exclude', g)" class="hover:text-white" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'genres', 'exclude', g)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Custom added signals -->
                    <span 
                      v-for="g in getCustomSignalList(sp, 'genres', 'prefer')" 
                      :key="'cust-pref-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
                    >
                      + {{ g }}
                      <button @click="removeCustomSignal(sp, 'genres', 'prefer', g)" class="hover:text-red-400">×</button>
                    </span>
                    <select @change="addCustomSignal(sp, 'genres', $event)" class="px-2 py-0.5 bg-background border border-gray-700 rounded-sm">
                      <option value="">+ Add</option>
                      <optgroup label="Prefer">
                        <option v-for="g in availableGenres" :key="'pref-'+g" :value="'prefer:' + g">✓ {{ g }}</option>
                      </optgroup>
                      <optgroup label="Exclude">
                        <option v-for="g in availableGenres" :key="'exc-'+g" :value="'exclude:' + g">✕ {{ g }}</option>
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
                      <button v-if="!isSignalRemoved(sp, 'keywords', 'exclude', k)" @click="markSignalRemoved(sp, 'keywords', 'exclude', k)" class="hover:text-white" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'keywords', 'exclude', k)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Custom added keywords -->
                    <span 
                      v-for="k in getCustomSignalList(sp, 'keywords', 'require_any')" 
                      :key="'cust-req-'+k"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 rounded-sm"
                    >
                      + {{ k }}
                      <button @click="removeCustomSignal(sp, 'keywords', 'require_any', k)" class="hover:text-red-400">×</button>
                    </span>
                    <input 
                      type="text"
                      v-model="newKeyword"
                      @keydown.enter="addKeywordToPreset(sp)"
                      placeholder="+ keyword (Enter)"
                      class="w-32 px-2 py-0.5 bg-background border border-gray-700 rounded-sm"
                    />
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
                        <button @click="removeCustomSignal(sp, 'language', 'require_any', lang)" class="hover:text-red-400">×</button>
                      </span>
                      <span 
                        v-for="lang in getCustomSignalList(sp, 'language', 'exclude')" 
                        :key="'cust-lang-exc-' + lang"
                        class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded-sm"
                      >
                        + exclude {{ formatLanguageCode(lang) }}
                        <button @click="removeCustomSignal(sp, 'language', 'exclude', lang)" class="hover:text-white">×</button>
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-gray-400">Runtime mode:</span>
                      <button
                        @click="setPresetSignalStrict(sp, 'language', false)"
                        class="px-2 py-1 rounded-sm border transition-colors"
                        :class="getPresetSignalStrict(sp, 'language') ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-primary text-primary bg-primary/10'"
                      >
                        Advisory
                      </button>
                      <button
                        @click="setPresetSignalStrict(sp, 'language', true)"
                        class="px-2 py-1 rounded-sm border transition-colors"
                        :class="getPresetSignalStrict(sp, 'language') ? 'border-amber-400 text-amber-300 bg-amber-500/10' : 'border-gray-600 text-gray-400 hover:bg-gray-700'"
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
        <div v-if="selectedPresets.length > 1" class="border border-primary/30 rounded-lg p-4 bg-primary/5">
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
          @click="showAdvanced = !showAdvanced" 
          class="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
        >
          <span>{{ showAdvanced ? '▼' : '▶' }}</span>
          <span>⚙️ Advanced Settings</span>
        </button>
        
        <div v-if="showAdvanced" class="space-y-6 pl-6">
          <!-- Weights -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Scoring Weights</h3>
            <p class="text-sm text-gray-400">Adjust how much each factor contributes to the final score</p>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">
                  Presets: {{ Math.round(form.preset_weight * 100) }}%
                </label>
                <input 
                  type="range" 
                  v-model.number="form.preset_weight" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-2">
                  Patterns: {{ Math.round(form.pattern_weight * 100) }}%
                </label>
                <input 
                  type="range" 
                  v-model.number="form.pattern_weight" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-2">
                  RAG: {{ Math.round(form.rag_weight * 100) }}%
                </label>
                <input 
                  type="range" 
                  v-model.number="form.rag_weight" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-2">
                  History: {{ Math.round(form.history_weight * 100) }}%
                </label>
                <input 
                  type="range" 
                  v-model.number="form.history_weight" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  class="w-full"
                />
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
            <h3 class="text-lg font-semibold">Combination Mode</h3>
            <div class="space-y-2">
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  type="radio" 
                  v-model="form.combination_mode" 
                  value="best_match" 
                  class="w-4 h-4"
                />
                <div>
                  <div class="font-medium">Best Match</div>
                  <div class="text-xs text-gray-400">Use highest scoring preset</div>
                </div>
              </label>
              
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  type="radio" 
                  v-model="form.combination_mode" 
                  value="average" 
                  class="w-4 h-4"
                />
                <div>
                  <div class="font-medium">Average</div>
                  <div class="text-xs text-gray-400">Average all matching preset scores</div>
                </div>
              </label>
              
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  type="radio" 
                  v-model="form.combination_mode" 
                  value="weighted_average" 
                  class="w-4 h-4"
                />
                <div>
                  <div class="font-medium">Weighted Average</div>
                  <div class="text-xs text-gray-400">Use preset weights</div>
                </div>
              </label>
              
              <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
                <input 
                  type="radio" 
                  v-model="form.combination_mode" 
                  value="require_all" 
                  class="w-4 h-4"
                />
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
        <h3 class="text-lg font-semibold">Classification Thresholds</h3>
        
        <div>
          <label class="block text-sm font-medium mb-2">
            Auto-classify threshold: {{ form.auto_classify_threshold }}%
          </label>
          <input 
            type="range" 
            v-model.number="form.auto_classify_threshold" 
            min="50" 
            max="95" 
            class="w-full"
          />
          <p class="text-xs text-gray-400 mt-1">Items scoring above this will be auto-classified</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-2">
            Prompt threshold: {{ form.prompt_threshold }}%
          </label>
          <input 
            type="range" 
            v-model.number="form.prompt_threshold" 
            min="30" 
            max="80" 
            class="w-full"
          />
          <p class="text-xs text-gray-400 mt-1">Items scoring above this will prompt for confirmation</p>
        </div>
      </div>
    </div>

    <template #footer>
      <Button @click="$emit('close')" variant="ghost">Cancel</Button>
      <Button @click="save" variant="primary" :disabled="!isValid">
        {{ hasExistingPresets ? 'Save Policy' : 'Create Policy' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '@/api'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'

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

const hasExistingPresets = computed(() => {
  return props.policy?.presets?.length > 0 || selectedPresets.value.length > 0
})

const isEditing = computed(() => !!props.policy)

const form = ref({
  library_id: null,
  name: '',
  description: '',
  enabled: true,
  priority: 5,
  sort_order: 0,
  auto_classify_threshold: 85,
  prompt_threshold: 60,
  require_ai_validation: true,
  trust_patterns: true,
  trust_rag: true,
  trust_history: true,
  preset_weight: 0.40,
  pattern_weight: 0.30,
  rag_weight: 0.20,
  history_weight: 0.10,
  combination_mode: 'best_match',
})

const libraries = ref([])
const allPresets = ref([])
const selectedPresets = ref([])
const expandedPresetIds = ref(new Set())
const newKeyword = ref('')
const showAdvanced = ref(false)

// Preset selection state (integrated from PresetSelectionModal)
const suggestedPresets = ref([])
const searchQuery = ref('')
const selectedCategory = ref('all')
const presetMigrationNotice = ref(null)
const PRESET_MIGRATION_NOTICE_DISMISS_KEY = 'classifarr.presetMigrationNotice.dismissed'

// Available options for signal customization
const availableRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR']
const availableGenres = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western']

const totalWeight = computed(() => {
  return form.value.preset_weight + form.value.pattern_weight + 
         form.value.rag_weight + form.value.history_weight
})

// Current library object for suggestions
const currentLibrary = computed(() => {
  if (!form.value.library_id) return null
  return libraries.value.find(l => l.id === form.value.library_id) || { id: form.value.library_id, name: 'Unknown' }
})

const existingPresetIds = computed(() => {
  return selectedPresets.value.map(p => p.preset_id || p.id)
})

// Group libraries by media type
const movieLibraries = computed(() => 
  libraries.value.filter(lib => lib.media_type === 'movie' || lib.media_type === 'movies')
)
const tvLibraries = computed(() => 
  libraries.value.filter(lib => lib.media_type === 'tv' || lib.media_type === 'show' || lib.media_type === 'shows')
)
const otherLibraries = computed(() => 
  libraries.value.filter(lib => !['movie', 'movies', 'tv', 'show', 'shows'].includes(lib.media_type))
)

// Combined signals from all selected presets (union of all signals)
// Combined signals from all selected presets (union of all signals with source attribution)
const combinedSignals = computed(() => {
  // Early return if no presets selected
  if (!selectedPresets.value || selectedPresets.value.length === 0) {
    return {
      certifications: { include: [], exclude: [] },
      genres: { prefer: [], exclude: [], require_any: [] },
      keywords: { prefer: [], require_any: [], exclude: [] }
    }
  }
  
  // Storage for signals: { [value]: Set(sourceNames) }
  const trackers = {
    certifications: { include: {}, exclude: {} },
    genres: { prefer: {}, exclude: {}, require_any: {} },
    keywords: { prefer: {}, require_any: {}, exclude: {} }
  }
  
  for (const sp of selectedPresets.value) {
    // Find full preset data
    const fullPreset = allPresets.value.find(p => p.id === sp.id || p.id === sp.preset_id)
    if (!fullPreset?.signals) continue
    
    const removedSignals = sp.customSignals?.removed || {}
    
    // Helper to add signals respecting removals
    const addSignals = (signalType, key) => {
      const baseItems = fullPreset.signals[signalType]?.[key] || []
      const removedItems = removedSignals[signalType]?.[key] || []
      const customItems = sp.customSignals?.[signalType]?.[key] || []
      
      // Add base items that aren't removed
      for (const item of baseItems) {
        if (!removedItems.includes(item)) {
          if (!trackers[signalType][key][item]) trackers[signalType][key][item] = new Set()
          trackers[signalType][key][item].add(sp.name)
        }
      }
      // Add custom items
      for (const item of customItems) {
        if (!trackers[signalType][key][item]) trackers[signalType][key][item] = new Set()
        trackers[signalType][key][item].add(sp.name)
      }
    }
    
    // Certifications
    addSignals('certifications', 'include')
    addSignals('certifications', 'exclude')
    
    // Genres
    addSignals('genres', 'prefer')
    addSignals('genres', 'exclude')
    addSignals('genres', 'require_any')
    
    // Keywords
    addSignals('keywords', 'prefer')
    addSignals('keywords', 'require_any')
    addSignals('keywords', 'exclude')
  }
  
  // Convert trackers to sorted arrays of objects { value, sources: [] }
  const formatResults = (categoryMap) => {
    return Object.entries(categoryMap)
      .map(([value, sourcesSet]) => ({
        value,
        sources: Array.from(sourcesSet).sort()
      }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }

  return {
    certifications: {
      include: formatResults(trackers.certifications.include),
      exclude: formatResults(trackers.certifications.exclude)
    },
    genres: {
      prefer: formatResults(trackers.genres.prefer),
      exclude: formatResults(trackers.genres.exclude),
      require_any: formatResults(trackers.genres.require_any)
    },
    keywords: {
      prefer: formatResults(trackers.keywords.prefer),
      require_any: formatResults(trackers.keywords.require_any),
      exclude: formatResults(trackers.keywords.exclude)
    }
  }
})

// Category tabs (integrated from PresetSelectionModal)
const categoryTabs = computed(() => {
  const categories = [
    { value: 'all', label: 'All', count: allPresets.value.length }
  ];
  
  // Get unique categories from presets
  const categoryCounts = {};
  allPresets.value.forEach(p => {
    const cat = p.category || 'uncategorized';
    if (cat !== 'custom') {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });
  
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    categories.push({ 
      value: cat, 
      label: cat.charAt(0).toUpperCase() + cat.slice(1), 
      count 
    });
  });
  
  // Add "My Presets" tab for custom presets
  const customCount = allPresets.value.filter(p => p.source === 'custom').length;
  if (customCount > 0) {
    categories.push({ value: 'custom', label: 'My Presets', count: customCount });
  }
  
  return categories;
});

const presetUsageMap = computed(() => {
  const usageByPresetId = new Map();
  allPresets.value.forEach((preset) => {
    const parsedId = Number.parseInt(preset.id, 10);
    const parsedUsageCount = Number.parseInt(preset.usage_count, 10);
    if (Number.isFinite(parsedId) && parsedId > 0) {
      usageByPresetId.set(parsedId, Number.isFinite(parsedUsageCount) && parsedUsageCount > 0 ? parsedUsageCount : 0);
    }
  });
  return usageByPresetId;
});

const getPresetUsageCount = (preset) => {
  const directUsageCount = Number.parseInt(preset?.usage_count, 10);
  if (Number.isFinite(directUsageCount) && directUsageCount >= 0) {
    return directUsageCount;
  }

  const presetId = Number.parseInt(preset?.id ?? preset?.preset_id, 10);
  if (!Number.isFinite(presetId) || presetId < 1) {
    return 0;
  }

  return presetUsageMap.value.get(presetId) ?? 0;
};

const formatUsageLabel = (usageCount) => {
  const parsedCount = Number.parseInt(usageCount, 10);
  const count = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0;
  return `Used in ${count} ${count === 1 ? 'policy' : 'policies'}`;
};

const languageLabels = {
  da: 'Danish',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fi: 'Finnish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ka: 'Georgian',
  ko: 'Korean',
  no: 'Norwegian',
  pt: 'Portuguese',
  sv: 'Swedish',
  zh: 'Chinese'
}

const formatLanguageCode = (value) => {
  const code = String(value || '').toLowerCase()
  return languageLabels[code] || String(value || '').toUpperCase()
}

const hasRuntimeSemanticsWarning = (preset) => {
  return Array.isArray(preset?.suggestion_warnings) &&
    preset.suggestion_warnings.includes('runtime_semantics_review_recommended')
}

const getPresetRuntimeSemantics = (preset) => {
  return preset?.runtimeSemantics || preset?.runtime_semantics || null
}

const getPresetRuntimeBadge = (preset) => {
  const semantics = getPresetRuntimeSemantics(preset)
  if (semantics?.badge_label) {
    const toneClasses = {
      info: 'bg-primary/10 text-primary',
      warning: 'bg-amber-500/10 text-amber-300',
      review: 'bg-amber-500/10 text-amber-300'
    }

    return {
      label: semantics.badge_label,
      className: toneClasses[semantics.badge_tone] || 'bg-gray-700 text-gray-300'
    }
  }

  if (hasPresetLanguageSignals(preset)) {
    return {
      label: 'Advisory by default',
      className: 'bg-amber-500/10 text-amber-300'
    }
  }

  return null
}

const getPresetRuntimeSummary = (preset) => {
  const semantics = getPresetRuntimeSemantics(preset)
  if (semantics?.summary) {
    return semantics.summary
  }

  return 'Advisory presets only influence score. Strict presets can block mismatched languages from ranking.'
}

const parsePresetMigrationReport = (rawValue) => {
  if (!rawValue) {
    return null
  }

  try {
    const report = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    const droppedCount = Number.parseInt(report?.dropped_count, 10)

    if (!Number.isFinite(droppedCount) || droppedCount <= 0) {
      return null
    }

    const affectedPolicies = Number.parseInt(report?.affected_policy_count, 10)
    const droppedAttachments = Array.isArray(report?.dropped_attachments) ? report.dropped_attachments : []
    const previewNames = droppedAttachments
      .slice(0, 3)
      .map(attachment => attachment?.preset_name || attachment?.preset_key)
      .filter(Boolean)
    const reportVersion = String(
      report?.executed_at ||
      report?.migration ||
      `${droppedCount}:${affectedPolicies || 0}`
    )

    if (typeof window !== 'undefined' && window.localStorage?.getItem(PRESET_MIGRATION_NOTICE_DISMISS_KEY) === reportVersion) {
      return null
    }

    const summaryParts = [
      `${droppedCount} incompatible preset ${droppedCount === 1 ? 'attachment was' : 'attachments were'} removed automatically`,
      Number.isFinite(affectedPolicies) && affectedPolicies > 0
        ? `across ${affectedPolicies} ${affectedPolicies === 1 ? 'policy' : 'policies'}`
        : null
    ].filter(Boolean)

    return {
      version: reportVersion,
      summary: `${summaryParts.join(' ')}. Reapply corrected presets where needed.`,
      preview: previewNames.length > 0
        ? `Recently removed: ${previewNames.join(', ')}${droppedAttachments.length > previewNames.length ? ', …' : ''}`
        : ''
    }
  } catch (_error) {
    return null
  }
}

// Filtered available presets (not yet selected)
const filteredAvailablePresets = computed(() => {
  let presets = allPresets.value;
  
  // Filter out already selected presets
  const selectedIds = selectedPresets.value.map(p => p.id || p.preset_id);
  presets = presets.filter(p => !selectedIds.includes(p.id));
  
  // Filter by category
  if (selectedCategory.value !== 'all') {
    if (selectedCategory.value === 'custom') {
      presets = presets.filter(p => p.source === 'custom');
    } else {
      presets = presets.filter(p => p.category === selectedCategory.value);
    }
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    presets = presets.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    );
  }
  
  return presets;
});

const isValid = computed(() => {
  const hasBasicInfo = form.value.library_id && selectedPresets.value.length > 0
  const weightsValid = Math.abs(totalWeight.value - 1) <= 0.001
  return hasBasicInfo && weightsValid
})

watch(() => props.policy, (newPolicy) => {
  if (newPolicy) {
    // Load existing policy data
    form.value = {
      library_id: newPolicy.library_id,
      name: newPolicy.name,
      description: newPolicy.description || '',
      enabled: newPolicy.enabled !== false,
      priority: newPolicy.priority || 5,
      sort_order: newPolicy.sort_order || 0,
      auto_classify_threshold: newPolicy.auto_classify_threshold || 85,
      prompt_threshold: newPolicy.prompt_threshold || 60,
      require_ai_validation: newPolicy.require_ai_validation !== false,
      trust_patterns: newPolicy.trust_patterns !== false,
      trust_rag: newPolicy.trust_rag !== false,
      trust_history: newPolicy.trust_history !== false,
      preset_weight: newPolicy.preset_weight ?? 0.40,
      pattern_weight: newPolicy.pattern_weight ?? 0.30,
      rag_weight: newPolicy.rag_weight ?? 0.20,
      history_weight: newPolicy.history_weight ?? 0.10,
      combination_mode: newPolicy.combination_mode || 'best_match',
    }

    // Load selected presets
    if (newPolicy.presets) {
      selectedPresets.value = newPolicy.presets.map(p => ({
        id: p.id,
        preset_id: p.id,
        name: p.name,
        icon: p.icon,
        weight: p.weight || 1.0,
        customSignals: p.customSignals || p.custom_signals || null,
        runtimeSemantics: p.runtimeSemantics || p.runtime_semantics || null,
      }))
    }
  } else {
    resetForm()
  }
}, { immediate: true })

watch(() => props.libraryId, (newLibraryId) => {
  if (newLibraryId && !props.policy) {
    form.value.library_id = newLibraryId
  }
}, { immediate: true })

onMounted(async () => {
  await Promise.all([
    fetchLibraries(),
    fetchPresets(),
    fetchPresetMigrationNotice()
  ])
})

const fetchLibraries = async () => {
  try {
    const response = await api.get('/libraries')
    libraries.value = response.data
  } catch (error) {
    console.error('Failed to fetch libraries:', error)
  }
}

const fetchPresets = async () => {
  try {
    const response = await api.get('/policies/presets/all')
    allPresets.value = response.data
  } catch (error) {
    console.error('Failed to fetch presets:', error)
  }
}

const fetchPresetMigrationNotice = async () => {
  try {
    const response = await api.get('/settings')
    presetMigrationNotice.value = parsePresetMigrationReport(
      response?.data?.preset_semantics_v2_auto_drop_report
    )
  } catch (error) {
    console.error('Failed to fetch preset migration report:', error)
    presetMigrationNotice.value = null
  }
}

const dismissPresetMigrationNotice = () => {
  if (typeof window !== 'undefined' && presetMigrationNotice.value?.version) {
    window.localStorage?.setItem(
      PRESET_MIGRATION_NOTICE_DISMISS_KEY,
      presetMigrationNotice.value.version
    )
  }

  presetMigrationNotice.value = null
}

// Load suggestions when library changes
watch(() => form.value.library_id, async (newLibraryId) => {
  if (newLibraryId) {
    try {
      const response = await api.get(`/policies/presets/suggest/${newLibraryId}`)
      suggestedPresets.value = response.data.suggestions || []
    } catch (error) {
      console.error('Failed to fetch suggested presets:', error)
      suggestedPresets.value = []
    }
  } else {
    suggestedPresets.value = []
  }
}, { immediate: true })

// Preset selection functions (integrated from PresetSelectionModal)
const isPresetSelected = (presetId) => {
  return selectedPresets.value.some(p => (p.id === presetId || p.preset_id === presetId))
}

const togglePresetSelection = (preset) => {
  const id = preset.id || preset.preset_id
  const idx = selectedPresets.value.findIndex(p => (p.id === id || p.preset_id === id))
  
  if (idx >= 0) {
    // Remove preset
    selectedPresets.value.splice(idx, 1)
    expandedPresetIds.value.delete(id)
  } else {
    // Add preset, preserving original structure and ensuring both id fields are populated
    const normalizedId = preset.id ?? preset.preset_id
    const normalizedPresetId = preset.preset_id ?? preset.id
    
    selectedPresets.value.push({
      ...preset,
      id: normalizedId,
      preset_id: normalizedPresetId,
      weight: preset.weight ?? 1.0,
    })
  }
}

const addAllSuggested = () => {
  suggestedPresets.value.forEach(preset => {
    if (!isPresetSelected(preset.id)) {
      togglePresetSelection(preset)
    }
  })
}

const updatePresetWeight = (presetId, weight) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  if (preset) {
    preset.weight = weight
  }
}

const getPresetCustomSignals = (presetId) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  return preset?.customSignals || null
}

const updatePresetSignals = (presetId, signals) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  if (preset) {
    preset.customSignals = signals
  }
}

const removePreset = (presetId) => {
  const index = selectedPresets.value.findIndex(p => p.preset_id === presetId || p.id === presetId)
  if (index >= 0) {
    selectedPresets.value.splice(index, 1)
  }
  // Close customization panel if this preset was expanded
  expandedPresetIds.value.delete(presetId)
}

// Toggle customization panel for a preset
const togglePresetCustomize = (presetId) => {
  if (expandedPresetIds.value.has(presetId)) {
    expandedPresetIds.value.delete(presetId)
  } else {
    expandedPresetIds.value.add(presetId)
  }
  // Force reactivity update
  expandedPresetIds.value = new Set(expandedPresetIds.value)
}

// Get list of custom signal items for a preset
const getCustomSignalList = (preset, signalType, key) => {
  return preset.customSignals?.[signalType]?.[key] || []
}

// Add a custom signal item
const addCustomSignal = (preset, signalType, event) => {
  const value = event.target.value
  if (!value) return
  event.target.value = ''
  
  const [action, item] = value.split(':')
  
  // Initialize customSignals structure if needed
  if (!preset.customSignals) preset.customSignals = {}
  if (!preset.customSignals[signalType]) preset.customSignals[signalType] = {}
  if (!preset.customSignals[signalType][action]) preset.customSignals[signalType][action] = []
  
  // Add if not already present
  if (!preset.customSignals[signalType][action].includes(item)) {
    preset.customSignals[signalType][action].push(item)
  }
  cleanupCustomSignals(preset)
}

// Remove a custom signal item
const removeCustomSignal = (preset, signalType, key, item) => {
  if (preset.customSignals?.[signalType]?.[key]) {
    preset.customSignals[signalType][key] = preset.customSignals[signalType][key].filter(i => i !== item)
  }
  cleanupCustomSignals(preset)
}

// Get base signals from the preset's original signals definition
const getPresetBaseSignals = (selectedPreset, signalType, key) => {
  // Find the full preset data from allPresets
  const fullPreset = allPresets.value.find(p => p.id === selectedPreset.id || p.id === selectedPreset.preset_id)
  if (!fullPreset?.signals?.[signalType]?.[key]) return []
  return fullPreset.signals[signalType][key] || []
}

const getPresetBaseSignalConfig = (selectedPreset, signalType) => {
  const fullPreset = allPresets.value.find(p => p.id === selectedPreset.id || p.id === selectedPreset.preset_id)
  return fullPreset?.signals?.[signalType] || null
}

const hasPresetLanguageSignals = (preset) => {
  const baseConfig = getPresetBaseSignalConfig(preset, 'language')
  const customConfig = preset.customSignals?.language
  return Boolean(
    baseConfig?.require_any?.length ||
    baseConfig?.exclude?.length ||
    customConfig?.require_any?.length ||
    customConfig?.exclude?.length
  )
}

const cleanupCustomSignals = (preset) => {
  if (!preset?.customSignals || typeof preset.customSignals !== 'object') return

  for (const [signalType, config] of Object.entries(preset.customSignals)) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) continue

    for (const [key, value] of Object.entries(config)) {
      if (Array.isArray(value) && value.length === 0) {
        delete config[key]
      }
    }

    if (Object.keys(config).length === 0) {
      delete preset.customSignals[signalType]
    }
  }

  if (Object.keys(preset.customSignals).length === 0) {
    preset.customSignals = null
  }
}

const getPresetSignalStrict = (preset, signalType) => {
  if (typeof preset?.customSignals?.[signalType]?.strict === 'boolean') {
    return preset.customSignals[signalType].strict
  }

  return getPresetBaseSignalConfig(preset, signalType)?.strict === true
}

const setPresetSignalStrict = (preset, signalType, strict) => {
  if (!preset.customSignals) preset.customSignals = {}
  if (!preset.customSignals[signalType]) preset.customSignals[signalType] = {}

  const baseStrict = getPresetBaseSignalConfig(preset, signalType)?.strict === true
  if (strict === baseStrict) {
    delete preset.customSignals[signalType].strict
  } else {
    preset.customSignals[signalType].strict = strict
  }

  cleanupCustomSignals(preset)
}

// Check if a base signal has been marked as removed
const isSignalRemoved = (preset, signalType, key, item) => {
  return preset.customSignals?.removed?.[signalType]?.[key]?.includes(item) || false
}

// Mark a base signal as removed
const markSignalRemoved = (preset, signalType, key, item) => {
  if (!preset.customSignals) preset.customSignals = {}
  if (!preset.customSignals.removed) preset.customSignals.removed = {}
  if (!preset.customSignals.removed[signalType]) preset.customSignals.removed[signalType] = {}
  if (!preset.customSignals.removed[signalType][key]) preset.customSignals.removed[signalType][key] = []
  
  if (!preset.customSignals.removed[signalType][key].includes(item)) {
    preset.customSignals.removed[signalType][key].push(item)
  }
  cleanupCustomSignals(preset)
}

// Restore a previously removed base signal
const unmarkSignalRemoved = (preset, signalType, key, item) => {
  if (preset.customSignals?.removed?.[signalType]?.[key]) {
    preset.customSignals.removed[signalType][key] = 
      preset.customSignals.removed[signalType][key].filter(i => i !== item)
  }
  cleanupCustomSignals(preset)
}

// Add keyword to preset
const addKeywordToPreset = (preset) => {
  const keyword = newKeyword.value.trim().toLowerCase()
  if (!keyword) return
  newKeyword.value = ''
  
  // Initialize customSignals structure if needed
  if (!preset.customSignals) preset.customSignals = {}
  if (!preset.customSignals.keywords) preset.customSignals.keywords = {}
  if (!preset.customSignals.keywords.require_any) preset.customSignals.keywords.require_any = []
  
  // Add if not already present
  if (!preset.customSignals.keywords.require_any.includes(keyword)) {
    preset.customSignals.keywords.require_any.push(keyword)
  }
  cleanupCustomSignals(preset)
}

const resetForm = () => {
  form.value = {
    library_id: props.libraryId || null,
    name: '',
    description: '',
    enabled: true,
    priority: 5,
    sort_order: 0,
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    preset_weight: 0.40,
    pattern_weight: 0.30,
    rag_weight: 0.20,
    history_weight: 0.10,
    combination_mode: 'best_match',
  }
  selectedPresets.value = []
}

const save = async () => {
  if (!isValid.value) return

  // Auto-generate policy name if not set
  let policyName = form.value.name
  if (!policyName && currentLibrary.value && selectedPresets.value.length > 0) {
    policyName = `${currentLibrary.value.name} Policy`
  }
  
  // Auto-generate description if not set and we have presets
  let policyDescription = form.value.description
  if (!policyDescription && selectedPresets.value.length > 0) {
    const presetNames = selectedPresets.value.map(p => p.name).join(', ')
    policyDescription = `Policy for ${presetNames}`
  }

  const policyData = {
    ...form.value,
    name: policyName,
    description: policyDescription,
    presets: selectedPresets.value.map(p => ({
      preset_id: p.preset_id || p.id,
      weight: p.weight || 1.0,
      customSignals: p.customSignals || null,
    })),
  }

  try {
    await emit('save', policyData)
  } catch (error) {
    console.error('Failed to save policy:', error)
    alert('Failed to save policy: ' + error.message)
  }
}
</script>
