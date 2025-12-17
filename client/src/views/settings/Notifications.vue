<template>
  <SettingsSection
    title="Notifications"
    description="Configure Discord webhook for notifications"
  >
    <Card>
      <Alert
        v-if="tested && testSuccess"
        variant="success"
        title="Test Successful"
        message="Test notification sent successfully"
        class="mb-6"
      />
      
      <div class="space-y-4">
        <FormField
          label="Discord Webhook URL"
          help="Webhook URL from Discord channel settings"
        >
          <Input
            v-model="config.webhookUrl"
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
          />
        </FormField>
        
        <FormField
          label="Enable Notifications"
          help="Send notifications to Discord"
        >
          <Toggle v-model="config.enabled" />
        </FormField>
        
        <FormField
          label="Notify on Classification"
          help="Send notification when media is classified"
        >
          <Toggle v-model="config.notifyOnClassification" :disabled="!config.enabled" />
        </FormField>
        
        <FormField
          label="Notify on Errors"
          help="Send notification when errors occur"
        >
          <Toggle v-model="config.notifyOnError" :disabled="!config.enabled" />
        </FormField>
      </div>
      
      <div class="mt-6 flex justify-end space-x-3">
        <Button variant="secondary" :loading="testing" @click="testWebhook">
          Send Test Notification
        </Button>
        <Button variant="primary" :loading="saving" @click="save">
          Save Configuration
        </Button>
      </div>
    </Card>
  </SettingsSection>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as settingsApi from '@/api/settings'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import Card from '@/components/common/Card.vue'
import Alert from '@/components/common/Alert.vue'
import FormField from '@/components/settings/FormField.vue'
import Input from '@/components/common/Input.vue'
import Toggle from '@/components/common/Toggle.vue'
import Button from '@/components/common/Button.vue'

const config = ref({
  webhookUrl: '',
  enabled: false,
  notifyOnClassification: true,
  notifyOnError: true,
})

const saving = ref(false)
const testing = ref(false)
const tested = ref(false)
const testSuccess = ref(false)

onMounted(async () => {
  try {
    const settings = await settingsApi.getSettings()
    if (settings.notifications) {
      config.value = { ...config.value, ...settings.notifications }
    }
  } catch (error) {
    console.error('Error loading config:', error)
  }
})

const testWebhook = async () => {
  testing.value = true
  tested.value = false
  try {
    const result = await settingsApi.testDiscordWebhook(config.value.webhookUrl)
    testSuccess.value = result.success
    tested.value = true
  } catch (error) {
    console.error('Error testing webhook:', error)
    testSuccess.value = false
    tested.value = true
  } finally {
    testing.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    await settingsApi.updateSettings({ notifications: config.value })
  } catch (error) {
    console.error('Error saving config:', error)
  } finally {
    saving.value = false
  }
}
</script>
