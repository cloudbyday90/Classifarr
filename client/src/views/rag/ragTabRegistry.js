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

import AdvancedTab from './AdvancedTab.vue'
import BackfillTab from './BackfillTab.vue'
import GraphTab from './GraphTab.vue'
import ImageEmbeddingsTab from './ImageEmbeddingsTab.vue'
import OverviewTab from './OverviewTab.vue'
import TextEmbeddingsTab from './TextEmbeddingsTab.vue'

export const ragTabs = [
  { id: 'overview', label: 'Overview', icon: '📊', component: OverviewTab },
  { id: 'text', label: 'Text Embeddings', icon: '🔤', component: TextEmbeddingsTab },
  { id: 'images', label: 'Image Embeddings', icon: '🖼️', component: ImageEmbeddingsTab },
  { id: 'backfill', label: 'Backfill', icon: '⏱️', component: BackfillTab },
  { id: 'graph', label: 'Graph', icon: '🕸️', component: GraphTab },
  { id: 'advanced', label: 'Advanced', icon: '⚙️', component: AdvancedTab },
]

const ragTabMap = new Map(ragTabs.map((tab) => [tab.id, tab]))

export function hasRagTab(tabId) {
  return ragTabMap.has(tabId)
}

export function normalizeRagTabId(tabId) {
  return hasRagTab(tabId) ? tabId : 'overview'
}

export function resolveRagTabComponent(tabId) {
  return ragTabMap.get(tabId)?.component
}
