<template>
  <Card :class="['hover:shadow-xl transition-all cursor-pointer', disabled ? 'opacity-60' : '']">
    <div class="flex items-start justify-between">
      <div class="flex items-start space-x-3 flex-1">
        <component :is="typeIcon" class="w-8 h-8 text-primary flex-shrink-0 mt-1" />
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-text mb-1">{{ library.name }}</h3>
          <p class="text-text-muted text-sm mb-2 truncate">{{ library.path }}</p>
          <div class="flex items-center space-x-2">
            <Badge :variant="library.enabled ? 'success' : 'default'">
              {{ library.enabled ? 'Enabled' : 'Disabled' }}
            </Badge>
            <Badge variant="primary">{{ library.type }}</Badge>
            <span v-if="library.itemCount" class="text-text-muted text-sm">
              {{ library.itemCount }} items
            </span>
          </div>
        </div>
      </div>
      <Toggle v-model="enabled" @update:modelValue="$emit('toggle', library.id, $event)" />
    </div>
  </Card>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Toggle from '@/components/common/Toggle.vue'
import { FilmIcon, TvIcon, MusicalNoteIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  library: {
    type: Object,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['toggle'])

const enabled = ref(props.library.enabled)

watch(() => props.library.enabled, (newVal) => {
  enabled.value = newVal
})

const typeIcon = computed(() => {
  const icons = {
    movie: FilmIcon,
    tv: TvIcon,
    music: MusicalNoteIcon,
  }
  return icons[props.library.type] || FilmIcon
})
</script>
