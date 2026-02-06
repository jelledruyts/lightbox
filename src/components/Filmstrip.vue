<script setup lang="ts">
import { computed } from 'vue'
import type { ImageFile, TriageState } from '../types'
import ImageThumbnail from './ImageThumbnail.vue'

const props = defineProps<{
  images: ImageFile[]
  selectedIndices: Set<number>
  currentFocusIndex: number | null
  triageStates: Map<number, TriageState>
  filteredIndices: number[]
  colors: {
    bg: string
    bgSecondary: string
    border: string
    text: string
    textSecondary: string
    buttonBg: string
    buttonHoverBg: string
  }
}>()

const emit = defineEmits<{
  select: [index: number, event: MouseEvent]
  triageChange: [index: number, state: TriageState]
}>()

const filteredIndexSet = computed(() => new Set(props.filteredIndices))

function handleSelect(index: number, event: MouseEvent) {
  emit('select', index, event)
}

function handleTriageChange(index: number, state: TriageState) {
  emit('triageChange', index, state)
}
</script>

<template>
  <div :style="{ backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}`, width: '100%', overflow: 'hidden' }">
    <div data-filmstrip-scroll style="width: 100%; overflow-x: scroll; overflow-y: hidden; padding: 1rem; -webkit-overflow-scrolling: touch;">
      <div style="display: flex; gap: 0.5rem; width: max-content;">
        <ImageThumbnail
          v-for="(image, index) in images"
          v-show="filteredIndexSet.has(index)"
          :key="image.url"
          :image="image"
          :index="index"
          :is-selected="selectedIndices.has(index)"
          :is-focused="currentFocusIndex === index"
          :triage-state="triageStates.get(index)"
          @select="handleSelect"
          @triage-change="handleTriageChange"
        />
      </div>
    </div>
  </div>
</template>
