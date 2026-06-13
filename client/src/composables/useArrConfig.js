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

        // Auto-save on successful test
        if (editingId.value) {
          await methods.updateConfig(editingId.value, editForm.value)
          toast.success('Connection successful! Settings auto-saved.')
          await loadConfigs()
        } else {
          toast.success('Connection successful! Instance saved.')
          await saveNewConfig(true)
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

  const saveNewConfig = async (fromAutoSave = false) => {
    saving.value = true
    try {
      const response = await methods.addConfig(editForm.value)
      const newConfig = response.data
      
      if (!fromAutoSave) {
        toast.success(`${methods.defaultName} instance added!`)
      }
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
      if (!fromAutoSave) {
        toast.error(error.response?.data?.error || 'Failed to add instance')
      } else {
        console.error('Auto-save failed:', error)
      }
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
