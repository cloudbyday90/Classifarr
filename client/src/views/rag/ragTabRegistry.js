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
