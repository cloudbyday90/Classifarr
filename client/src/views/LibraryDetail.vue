<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <Button @click="$router.back()" variant="secondary">← Back</Button>
      <h1 class="text-2xl font-bold">{{ library?.name || 'Library' }}</h1>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading library...
    </div>

    <div v-else-if="library" class="space-y-6">
      <Card title="Library Configuration">
        <div class="grid grid-cols-2 gap-4">
          <Input v-model="library.name" label="Name" disabled />
          <Input v-model.number="library.priority" label="Priority" type="number" />
          <Select
            v-model="library.arr_type"
            label="ARR Type"
            :options="[
              { label: 'Radarr', value: 'radarr' },
              { label: 'Sonarr', value: 'sonarr' },
            ]"
            placeholder="Select ARR type"
          />
          <div class="flex items-end">
            <Button @click="saveLibrary" :loading="saving">Save Changes</Button>
          </div>
        </div>
      </Card>

      <Card title="Classification Rules">
        <div class="space-y-4">
          <div>
            <h4 class="font-medium mb-2">Label-based Rules</h4>
            <p class="text-sm text-gray-400 mb-4">
              Configure which content should be included or excluded from this library
            </p>
            <Button @click="$router.push(`/rule-builder/${library.id}`)">
              ✨ AI Rule Builder
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'

const route = useRoute()
const router = useRouter()

const library = ref(null)
const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
  try {
    const response = await api.getLibrary(route.params.id)
    library.value = response.data
  } catch (error) {
    console.error('Failed to load library:', error)
    alert('Failed to load library')
    router.push('/libraries')
  } finally {
    loading.value = false
  }
})

const saveLibrary = async () => {
  saving.value = true
  try {
    await api.updateLibrary(library.value.id, {
      priority: library.value.priority,
      arr_type: library.value.arr_type,
    })
    alert('Library updated successfully')
  } catch (error) {
    console.error('Failed to save library:', error)
    alert('Failed to save library: ' + error.message)
  } finally {
    saving.value = false
  }
}
</script>
