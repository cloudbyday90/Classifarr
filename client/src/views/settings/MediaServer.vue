<template>
  <SettingsSection
    title="Media Server"
    description="Configure connection to Plex, Emby, or Jellyfin"
  >
    <Card>
      <Alert
        v-if="mediaServerStore.connected"
        variant="success"
        title="Connected"
        message="Successfully connected to media server"
        class="mb-6"
      />
      
      <div class="space-y-4">
        <FormField
          label="Server Type"
          help="Select your media server platform"
          required
        >
          <Select
            v-model="config.type"
            :options="serverTypes"
            placeholder="Select server type"
          />
        </FormField>
        
        <FormField
          label="Server URL"
          help="Full URL to your media server (e.g., http://localhost:32400)"
          required
        >
          <Input
            v-model="config.url"
            type="url"
            placeholder="http://localhost:32400"
          />
        </FormField>
        
        <FormField
          label="API Key / Token"
          help="Authentication token for your media server"
          required
        >
          <Input
            v-model="config.apiKey"
            type="password"
            placeholder="Enter API key"
          />
        </FormField>
      </div>
      
      <div class="mt-6 flex justify-end space-x-3">
        <ConnectionTest
          :on-test="testConnection"
          :connected="mediaServerStore.connected"
        />
        <Button variant="primary" :loading="saving" @click="save">
          Save Configuration
        </Button>
      </div>
    </Card>
  </SettingsSection>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useMediaServerStore } from '@/stores/mediaServer'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import Card from '@/components/common/Card.vue'
import Alert from '@/components/common/Alert.vue'
import FormField from '@/components/settings/FormField.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Button from '@/components/common/Button.vue'
import ConnectionTest from '@/components/settings/ConnectionTest.vue'

const mediaServerStore = useMediaServerStore()

const config = ref({
  type: '',
  url: '',
  apiKey: '',
})

const saving = ref(false)

const serverTypes = [
  { value: 'plex', label: 'Plex' },
  { value: 'emby', label: 'Emby' },
  { value: 'jellyfin', label: 'Jellyfin' },
]

onMounted(async () => {
  try {
    await mediaServerStore.fetchConfig()
    config.value = {
      type: mediaServerStore.serverType || '',
      url: mediaServerStore.serverUrl || '',
      apiKey: mediaServerStore.apiKey || '',
    }
  } catch (error) {
    console.error('Error loading config:', error)
  }
})

const testConnection = async () => {
  await mediaServerStore.testConnection()
}

const save = async () => {
  saving.value = true
  try {
    await mediaServerStore.saveConfig(config.value)
  } catch (error) {
    console.error('Error saving config:', error)
  } finally {
    saving.value = false
  }
}
</script>
