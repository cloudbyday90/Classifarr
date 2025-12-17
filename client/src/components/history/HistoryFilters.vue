<template>
  <Card>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <FormField label="Type">
        <Select
          v-model="localFilters.type"
          :options="typeOptions"
          placeholder="All types"
          @update:modelValue="emit"
        />
      </FormField>
      
      <FormField label="Library">
        <Select
          v-model="localFilters.library"
          :options="libraryOptions"
          placeholder="All libraries"
          @update:modelValue="emit"
        />
      </FormField>
      
      <FormField label="Status">
        <Select
          v-model="localFilters.status"
          :options="statusOptions"
          placeholder="All statuses"
          @update:modelValue="emit"
        />
      </FormField>
      
      <FormField label="Date Range">
        <Input
          v-model="localFilters.dateRange"
          type="date"
          @update:modelValue="emit"
        />
      </FormField>
    </div>
    
    <div class="flex justify-end mt-4">
      <Button variant="secondary" size="sm" @click="reset">
        Reset Filters
      </Button>
    </div>
  </Card>
</template>

<script setup>
import { ref, watch } from 'vue'
import Card from '@/components/common/Card.vue'
import FormField from '@/components/settings/FormField.vue'
import Select from '@/components/common/Select.vue'
import Input from '@/components/common/Input.vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  filters: {
    type: Object,
    default: () => ({}),
  },
})

const emitUpdate = defineEmits(['update'])

const localFilters = ref({ ...props.filters })

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV Shows' },
]

const libraryOptions = [
  { value: '', label: 'All Libraries' },
]

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'ok', label: 'OK' },
  { value: 'corrected', label: 'Corrected' },
]

watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters }
})

const emit = () => {
  emitUpdate('update', localFilters.value)
}

const reset = () => {
  localFilters.value = {
    type: '',
    library: '',
    status: '',
    dateRange: '',
  }
  emit()
}
</script>
