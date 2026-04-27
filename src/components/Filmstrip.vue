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
  height: number
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
const thumbnailHeight = computed(() => Math.max(props.height - 32, 56))

function handleSelect(index: number, event: MouseEvent) {
  emit('select', index, event)
}

function handleTriageChange(index: number, state: TriageState) {
  emit('triageChange', index, state)
}
</script>

<template>
  <div :style="{ backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}`, width: '100%', overflow: 'hidden', height: `${height}px` }">
    <div
      data-filmstrip-scroll
      :style="{ width: '100%', height: '100%', overflowX: 'scroll', overflowY: 'hidden', padding: '1rem', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' }"
    >
      <div :style="{ display: 'flex', gap: '0.5rem', width: 'max-content', alignItems: 'center', minHeight: '100%' }">
        <ImageThumbnail
          v-for="(image, index) in images"
          v-show="filteredIndexSet.has(index)"
          :key="image.url"
          :image="image"
          :index="index"
          :is-selected="selectedIndices.has(index)"
          :is-focused="currentFocusIndex === index"
          :triage-state="triageStates.get(index)"
          :thumbnail-height="thumbnailHeight"
          @select="handleSelect"
          @triage-change="handleTriageChange"
        />
      </div>
    </div>
  </div>
</template>
