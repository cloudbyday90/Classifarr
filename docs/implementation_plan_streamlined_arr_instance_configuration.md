# Streamlined Radarr and Sonarr Instance Setup (One-Pass Configuration with Shared Composable)

## Overview
This implementation plan defines the client-side changes required to streamline the *arr (Radarr and Sonarr) instance setup flow in Classifarr.

Additionally, this plan addresses architectural enhancement requests by utilizing **ES Modules (ESM)** and **Vue 3 Composables** to eliminate duplicate configuration logic across `Radarr.vue` and `Sonarr.vue`. Instead of having duplicate state and service logic in large singleton views, we will extract all instance management state, connection testing, and saving/transitioning logic into a single modular shared service composable: `useArrConfig.js`.

---

## Architectural Goals
1. **Modular Shared Services**: Move from large, redundant view components to a reusable composable (`useArrConfig.js`) that dynamically resolves API actions and manages state based on the *arr type.
2. **ESM-driven API Resolver**: Leverage named ES Module imports and dynamic configuration mappings to bind endpoints without code duplication.
3. **One-Pass Setup**: Automatically transition from "Add New" mode directly to "Edit" mode for the newly saved instance, enabling immediate mapping of root folders and media library sync.
4. **Responsive Layout**: Auto-scroll to the Library Mapping panel using Vue's `nextTick` once the new instance transitions into edit mode.
5. **Connection Testing UX Improvements**:
   - Provide a visual loading placeholder during connection testing.
   - Automatically select a default Quality Profile if one has not been specified yet.
   - Clean up error messages shown in toast alerts to avoid displaying unformatted JSON objects.

---

## Proposed Architectural Flow (ESM & Composable)

```
┌────────────────────────────────────────┐
│               ES Modules               │
│               (api/index.js)           │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│     Shared Modular Composable          │
│       (composables/useArrConfig.js)    │
│  - Form/UI State Management            │
│  - One-Pass Auto-Transition & Scroll   │
│  - API dispatch (Radarr vs Sonarr)     │
└──────────┬──────────────────┬──────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌──────────────────┐
│  Radarr View     │  │  Sonarr View     │
│  (Radarr.vue)    │  │  (Sonarr.vue)    │
│  - Unique fields │  │  - Unique fields │
│  - Markup template│  │  - Markup template│
└──────────────────┘  └──────────────────┘
```

---

## Technical Analysis

### 1. Dynamic API Mapping (ESM Resolver)
Within `useArrConfig.js`, we define a configuration registry that maps the `type` parameter (`'radarr'` or `'sonarr'`) to its corresponding ES module API calls. 
```javascript
import api from '@/api'

const configMethods = {
  radarr: {
    getConfig: api.getRadarrConfig,
    addConfig: api.addRadarrConfig,
    updateConfig: api.updateRadarrConfig,
    deleteConfig: api.deleteRadarrConfig,
    testConnection: api.testRadarrConnection,
    getQualityProfiles: api.getRadarrQualityProfiles,
    defaultName: 'Radarr',
    defaultPort: 7878,
    extraDefaults: {
      minimum_availability: 'released'
    }
  },
  sonarr: {
    getConfig: api.getSonarrConfig,
    addConfig: api.addSonarrConfig,
    updateConfig: api.updateSonarrConfig,
    deleteConfig: api.deleteSonarrConfig,
    testConnection: api.testSonarrConnection,
    getQualityProfiles: api.getSonarrQualityProfiles,
    defaultName: 'Sonarr',
    defaultPort: 8989,
    extraDefaults: {
      series_type: 'standard',
      monitor: 'all'
    }
  }
}
```

### 2. Auto-Transition and Smooth Scroll
Upon saving a new instance, the composable:
1. Dispatches the creation POST API request.
2. Updates local list configurations via `loadConfigs()`.
3. Finds the newly created configuration `id` in the refreshed list.
4. Transitions state directly to `isEditing = true` and `editingId = config.id`.
5. Triggers Vue's `nextTick` and queries for `.border-t.border-gray-700.pt-4` to execute a smooth `scrollIntoView` for the Library Mappings panel.

### 3. API Key Masking Resilience
When transitioning to edit mode, the client loads the configuration row returned by `loadConfigs()`. This row contains the masked API key (`******`).
If the user edits root folders or other settings and saves again, the client submits the masked API key.
The backend update resolver `buildArrUpdatePayload` in `arrConfigModel.mjs` handles this transparently:
```javascript
const resolvedApiKey = (body.api_key && !isMaskedToken(body.api_key))
  ? body.api_key
  : existing.api_key;
```
Connection testing also utilizes `isMaskedToken(api_key)` to resolve the real key from the database when a test is requested from the edit view. This means our one-pass transition is fully compatible with token masking and will not cause connection test or save failures due to API key masking.

### 4. Connection Testing & Quality Profiles
During the connection test in the creation flow, we immediately pull the quality profiles and root folders from the *arr instance. To streamline the setup:
- We bind `loadingProfiles` to show a "Loading..." placeholder in the Quality Profile select dropdown while the check is in progress.
- Once profiles return successfully, we attempt to auto-select the best matching profile (searching for `Any`, `Default`, or `Standard` first, then falling back to the first profile in the list) so the user doesn't have to manually select it.

---

## File-Level Change Plan

### Component 1: Shared Composable (NEW)
#### [NEW] [useArrConfig.js](file:///C:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/composables/useArrConfig.js)

Create the shared composable that manages instance configuration state and operations.

```javascript
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref, nextTick } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const configMethods = {
  radarr: {
    getConfig: api.getRadarrConfig,
    addConfig: api.addRadarrConfig,
    updateConfig: api.updateRadarrConfig,
    deleteConfig: api.deleteRadarrConfig,
    testConnection: api.testRadarrConnection,
    getQualityProfiles: api.getRadarrQualityProfiles,
    defaultName: 'Radarr',
    defaultPort: 7878,
    extraDefaults: {
      minimum_availability: 'released'
    }
  },
  sonarr: {
    getConfig: api.getSonarrConfig,
    addConfig: api.addSonarrConfig,
    updateConfig: api.updateSonarrConfig,
    deleteConfig: api.deleteSonarrConfig,
    testConnection: api.testSonarrConnection,
    getQualityProfiles: api.getSonarrQualityProfiles,
    defaultName: 'Sonarr',
    defaultPort: 8989,
    extraDefaults: {
      series_type: 'standard',
      monitor: 'all'
    }
  }
}

export function useArrConfig(type) {
  const methods = configMethods[type]
  if (!methods) {
    throw new Error(`Unsupported arr type: ${type}`)
  }

  const toast = useToast()
  
  const configs = ref([])
  const mediaServers = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const isEditing = ref(false)
  const isAddingNew = ref(false)
  const editingId = ref(null)
  const loadingProfiles = ref(false)
  const qualityProfiles = ref([])

  const getBaseForm = () => ({
    name: methods.defaultName,
    protocol: 'http',
    host: 'localhost',
    port: methods.defaultPort,
    base_path: '',
    api_key: '',
    verify_ssl: true,
    timeout: 30,
    media_server_id: null,
    quality_profile_id: null,
    ...methods.extraDefaults
  })

  const editForm = ref(getBaseForm())

  const resetForm = () => {
    editForm.value = getBaseForm()
    qualityProfiles.value = []
  }

  const loadMediaServers = async () => {
    try {
      mediaServers.value = await api.getMediaServers()
    } catch (error) {
      console.error('Failed to load media servers:', error)
    }
  }

  const loadConfigs = async () => {
    try {
      const response = await methods.getConfig()
      configs.value = response || []
    } catch (error) {
      console.error(`Failed to load ${type} configs:`, error)
      toast.error('Failed to load configurations')
    }
  }

  const getMediaServerName = (id) => {
    if (!id) return 'Not linked'
    const server = mediaServers.value.find(s => s.id === id)
    return server ? server.name : 'Unknown'
  }

  const startEditing = async (instance) => {
    editingId.value = instance.id
    isEditing.value = true
    isAddingNew.value = false
    
    // Support customized series/monitor values normalization for Sonarr
    let monitorValue = 'all'
    if (type === 'sonarr') {
      const val = instance.monitor
      if (val) {
        const map = { first: 'firstSeason', latest: 'latestSeason', lastSeason: 'latestSeason' }
        monitorValue = map[val] || val
      }
    }
    
    editForm.value = { 
      ...instance, 
      id: instance.id,
      ...(type === 'sonarr' ? { monitor: monitorValue } : {})
    }

    loadingProfiles.value = true
    try {
      const response = await methods.getQualityProfiles(instance.id)
      qualityProfiles.value = response || []
    } catch (e) {
      console.warn('Failed to load quality profiles:', e)
    } finally {
      loadingProfiles.value = false
    }
  }

  const startAddingNew = () => {
    resetForm()
    isAddingNew.value = true
    isEditing.value = false
    editingId.value = null
  }

  const cancelEdit = () => {
    isEditing.value = false
    editingId.value = null
    resetForm()
  }

  const testConnection = async (showToast = true) => {
    loading.value = true
    loadingProfiles.value = true
    try {
      const response = await methods.testConnection(editForm.value)
      if (response.data.success) {
        if (showToast) toast.success('Connection successful!')
        if (response.data.data?.qualityProfiles) {
          const profiles = response.data.data.qualityProfiles
          qualityProfiles.value = profiles
          
          // Auto-select a quality profile if none is currently selected
          if (!editForm.value.quality_profile_id && profiles.length > 0) {
            const bestMatch = profiles.find(p => {
              const name = (p.name || '').toLowerCase()
              return name === 'any' || name === 'default' || name === 'standard'
            })
            editForm.value.quality_profile_id = bestMatch ? bestMatch.id : profiles[0].id
          }
        }
      } else {
        const errorMsg = response.data.error?.message || response.data.error || 'Connection failed'
        if (showToast) toast.error(errorMsg)
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Connection test failed'
      if (showToast) toast.error(errorMsg)
    } finally {
      loading.value = false
      loadingProfiles.value = false
    }
  }

  const testConnectionFor = async (instance) => {
    loading.value = true
    try {
      const response = await methods.testConnection(instance)
      if (response.data.success) {
        toast.success(`${instance.name || methods.defaultName}: Connection successful!`)
      } else {
        toast.error(response.data.error || 'Connection failed')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Connection test failed')
    } finally {
      loading.value = false
    }
  }

  const saveConfig = async () => {
    saving.value = true
    try {
      await methods.updateConfig(editingId.value, editForm.value)
      toast.success('Settings saved!')
      isEditing.value = false
      editingId.value = null
      await loadConfigs()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save settings')
    } finally {
      saving.value = false
    }
  }

  const saveNewConfig = async () => {
    saving.value = true
    try {
      const response = await methods.addConfig(editForm.value)
      const newConfig = response.data
      
      toast.success(`${methods.defaultName} instance added!`)
      isAddingNew.value = false
      await loadConfigs()
      
      const savedInstance = configs.value.find(c => c.id === newConfig.id)
      if (savedInstance) {
        await startEditing(savedInstance)
        toast.info('Configure root folders and library mappings below.')
        
        await nextTick()
        const element = document.querySelector('.border-t.border-gray-700.pt-4')
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } else {
        resetForm()
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add instance')
    } finally {
      saving.value = false
    }
  }

  const deleteConfig = async (id) => {
    if (!confirm(`Are you sure you want to delete this ${methods.defaultName} instance?`)) return
    try {
      await methods.deleteConfig(id)
      toast.success('Instance deleted')
      await loadConfigs()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete')
    }
  }

  return {
    configs,
    mediaServers,
    loading,
    saving,
    isEditing,
    isAddingNew,
    editingId,
    loadingProfiles,
    qualityProfiles,
    editForm,
    resetForm,
    loadMediaServers,
    loadConfigs,
    getMediaServerName,
    startEditing,
    startAddingNew,
    cancelEdit,
    testConnection,
    testConnectionFor,
    saveConfig,
    saveNewConfig,
    deleteConfig
  }
}
```

---

### Component 2: Radarr Settings View
#### [MODIFY] [Radarr.vue](file:///C:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/settings/Radarr.vue)

Refactor the component's script section to import and invoke the new `useArrConfig` composable. Remove duplicate functions and state definitions.

```vue
<script setup>
import PasswordInput from '@/components/common/PasswordInput.vue'
import LibraryMappingPanel from '@/components/settings/LibraryMappingPanel.vue'
import { useArrConfig } from '@/composables/useArrConfig'
import { onMounted } from 'vue'

const availabilityOptions = [
  { value: 'announced', label: 'Announced' },
  { value: 'inCinemas', label: 'In Cinemas' },
  { value: 'released', label: 'Released' },
  { value: 'preDB', label: 'PreDB' }
]

const {
  configs,
  mediaServers,
  loading,
  saving,
  isEditing,
  isAddingNew,
  editingId,
  loadingProfiles,
  qualityProfiles,
  editForm,
  loadMediaServers,
  loadConfigs,
  getMediaServerName,
  startEditing,
  startAddingNew,
  cancelEdit,
  testConnection,
  testConnectionFor,
  saveConfig,
  saveNewConfig,
  deleteConfig
} = useArrConfig('radarr')

onMounted(async () => {
  await loadMediaServers()
  await loadConfigs()
})
</script>
```

---

### Component 3: Sonarr Settings View
#### [MODIFY] [Sonarr.vue](file:///C:/Users/Moreland/Repositories/Classifarr/Classifarr/client/src/views/settings/Sonarr.vue)

Refactor the component's script section to import and invoke the new `useArrConfig` composable. Remove duplicate functions and state definitions.

```vue
<script setup>
import PasswordInput from '@/components/common/PasswordInput.vue'
import LibraryMappingPanel from '@/components/settings/LibraryMappingPanel.vue'
import { useArrConfig } from '@/composables/useArrConfig'
import { onMounted } from 'vue'

const seriesTypeOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'daily', label: 'Daily' },
  { value: 'anime', label: 'Anime' }
]

const seasonMonitoringOptions = [
  { value: 'all', label: 'All Episodes' },
  { value: 'future', label: 'Future Seasons' },
  { value: 'missing', label: 'Missing Episodes' },
  { value: 'existing', label: 'Existing Episodes' },
  { value: 'recent', label: 'Recent Episodes' },
  { value: 'pilot', label: 'Pilot Only' },
  { value: 'firstSeason', label: 'First Season' },
  { value: 'latestSeason', label: 'Latest Season' },
  { value: 'none', label: 'None' }
]

const {
  configs,
  mediaServers,
  loading,
  saving,
  isEditing,
  isAddingNew,
  editingId,
  loadingProfiles,
  qualityProfiles,
  editForm,
  loadMediaServers,
  loadConfigs,
  getMediaServerName,
  startEditing,
  startAddingNew,
  cancelEdit,
  testConnection,
  testConnectionFor,
  saveConfig,
  saveNewConfig,
  deleteConfig
} = useArrConfig('sonarr')

onMounted(async () => {
  await loadMediaServers()
  await loadConfigs()
})
</script>
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Masked api_key tokens are overwritten during update** | High | Resolved: The server-side API handler check `isMaskedToken(body.api_key)` handles masked updates by reusing the existing database credentials automatically. |
| **Dynamic property differences (e.g. Sonarr monitor normalization)** | Medium | Resolved: The composable detects and adjusts specific properties (such as series monitoring types) depending on whether the `type` parameter is `sonarr` or `radarr`. |

---

## Verification Plan

### Automated Linting
Run front-end validation checks before testing manual deployment.
```bash
npm --prefix client run lint
```

### Manual Verification Checklist

#### TC-01: Radarr One-Pass Creation and Transition
- **Preconditions**: Linked Media Server is active.
- **Steps**:
  1. Navigate to **Settings -> Radarr**.
  2. Click **Add Radarr Instance**.
  3. Fill in connection details and link a media server.
  4. Save instance.
- **Expected Results**:
  - Automatically transitions to edit form.
  - Page scrolls smoothly to the **Library Mappings** panel.
  - Quality profiles and folders populate successfully.

#### TC-02: Sonarr One-Pass Creation and Transition
- **Preconditions**: Linked Media Server is active.
- **Steps**:
  1. Navigate to **Settings -> Sonarr**.
  2. Click **Add Sonarr Instance**.
  3. Fill in connection details and link a media server.
  4. Save instance.
- **Expected Results**:
  - Automatically transitions to edit form.
  - Page scrolls smoothly to mappings.

#### TC-03: Connection Test and API Key Masking
- **Preconditions**: Setup from TC-01/TC-02 active.
- **Steps**:
  1. Inspect edit form; observe that the `api_key` input is masked.
  2. Click **Test Connection** within the edit form.
- **Expected Results**:
  - Test completes successfully (proving the backend correctly maps the masked token to the stored API key).
