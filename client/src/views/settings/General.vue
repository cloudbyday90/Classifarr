<template>
  <SettingsSection
    title="General Settings"
    description="Basic application configuration"
  >
    <Card>
      <div class="space-y-4">
        <FormField
          label="Application Name"
          help="Display name for the application"
        >
          <Input v-model="settings.appName" placeholder="Classifarr" />
        </FormField>
        
        <FormField
          label="Theme"
          help="Interface theme (currently only dark mode is supported)"
        >
          <Select
            v-model="settings.theme"
            :options="themeOptions"
            disabled
          />
        </FormField>
        
        <FormField
          label="Auto-Classification"
          help="Automatically classify new media when detected"
        >
          <Toggle v-model="settings.autoClassify" />
        </FormField>
        
        <FormField
          label="Classification Interval"
          help="How often to scan for new media (in minutes)"
        >
          <Input
            v-model.number="settings.scanInterval"
            type="number"
            placeholder="60"
          />
        </FormField>
      </div>
      
      <div class="mt-6 flex justify-end">
        <Button variant="primary" :loading="saving" @click="save">
          Save Settings
        </Button>
      </div>
    </Card>
  </SettingsSection>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import * as settingsApi from '@/api/settings'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import Card from '@/components/common/Card.vue'
import FormField from '@/components/settings/FormField.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Button from '@/components/common/Button.vue'

const appStore = useAppStore()

const settings = ref({
  appName: 'Classifarr',
  theme: 'dark',
  autoClassify: true,
  scanInterval: 60,
})

const saving = ref(false)

const themeOptions = [
  { value: 'dark', label: 'Dark' },
]

onMounted(async () => {
  try {
    const data = await settingsApi.getSettings()
    settings.value = { ...settings.value, ...data }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
})

const save = async () => {
  saving.value = true
  try {
    await settingsApi.updateSettings(settings.value)
    appStore.appName = settings.value.appName
  } catch (error) {
    console.error('Error saving settings:', error)
  } finally {
    saving.value = false
  }
}
</script>
