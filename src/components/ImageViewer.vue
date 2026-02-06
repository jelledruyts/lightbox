<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type { ImageFile, TriageState } from '../types'
import { useSmartLayout } from '../composables/useSmartLayout'
import ImagePane from './ImagePane.vue'

const props = defineProps<{
  images: ImageFile[]
  selectedIndices: Set<number>
  selectionOrder: number[]
  triageStates: Map<number, TriageState>
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
  triageChange: [index: number, state: TriageState]
  deselect: [index: number]
}>()

const viewerRef = ref<HTMLElement>()

const selectedImages = computed(() => {
  return props.selectionOrder.map(index => props.images[index])
})

const { layout, setViewerElement } = useSmartLayout(() => selectedImages.value)

onMounted(() => {
  if (viewerRef.value) {
    setViewerElement(viewerRef.value)
  }
})

function handleTriageChange(index: number, state: TriageState) {
  emit('triageChange', index, state)
}

function handleDeselect(index: number) {
  emit('deselect', index)
}
</script>

<template>
  <div ref="viewerRef" :style="{ position: 'relative', width: '100%', height: '100%', backgroundColor: colors.bgSecondary, overflow: 'hidden' }">
    <div v-if="selectedIndices.size === 0" :style="{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textSecondary }">
      <div style="text-align: center;">
        <p style="font-size: 1.125rem; margin-bottom: 0.5rem;">No images selected</p>
        <p style="font-size: 0.875rem;">Click on images in the filmstrip to view them here</p>
      </div>
    </div>
    
    <ImagePane
      v-for="(image, index) in selectedImages"
      :key="image.url"
      :image-url="image.url"
      :image-name="image.name"
      :image-index="selectionOrder[index]"
      :triage-state="triageStates.get(selectionOrder[index])"
      :width="layout.positions[index]?.width || 0"
      :height="layout.positions[index]?.height || 0"
      :x="layout.positions[index]?.x || 0"
      :y="layout.positions[index]?.y || 0"
      @triage-change="handleTriageChange"
      @deselect="handleDeselect"
    />
  </div>
</template>
