<script setup lang="ts">
import { computed } from 'vue'
import type { ImageFile, TriageState } from '../types'

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

function handleClick(index: number, event: MouseEvent) {
  emit('select', index, event)
}

function handleTriageClick(index: number, state: TriageState, event: MouseEvent) {
  event.stopPropagation()
  emit('triageChange', index, state)
}
</script>

<template>
  <div :style="{ backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}`, width: '100%', overflow: 'hidden' }">
    <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', fontSize: '0.875rem', color: colors.textSecondary }">
      <span v-if="images.length > 0">Showing {{ filteredIndices.length }} of {{ images.length }} images, {{ selectedIndices.size }} selected</span>
      <span v-else>No images loaded</span>
    </div>
    <div data-filmstrip-scroll style="width: 100%; overflow-x: scroll; overflow-y: hidden; padding: 0 1rem 1rem 1rem; -webkit-overflow-scrolling: touch;">
      <div style="display: flex; gap: 0.5rem; width: max-content;">
        <div
          v-for="(image, index) in images"
          v-show="filteredIndexSet.has(index)"
          :key="image.url"
          :data-image-index="index"
          @click="handleClick(index, $event)"
          :style="{
            flexShrink: 0,
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.2s',
            height: '96px',
            padding: '4px',
            backgroundColor: selectedIndices.has(index) ? '#3b82f6' : (currentFocusIndex === index ? '#93c5fd' : 'transparent'),
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }"
        >
          <div :style="{
            backgroundColor: 'white',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            position: 'relative'
          }">
            <img
              :src="image.url"
              :alt="image.name"
              :title="image.name"
              :style="{
                height: '88px',
                width: 'auto',
                maxWidth: '150px',
                objectFit: 'contain',
                display: 'block',
                pointerEvents: 'none'
              }"
            />
            <div :style="{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              display: 'flex',
              gap: '2px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '4px',
              padding: '2px'
            }">
            <button
              @click="handleTriageClick(index, 'accepted', $event)"
              :title="'Accept'"
              :style="{
                width: '20px',
                height: '20px',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: triageStates.get(index) === 'accepted' ? '#10b981' : 'transparent',
                color: triageStates.get(index) === 'accepted' ? 'white' : '#d1d5db',
                transition: 'all 0.2s'
              }"
            >✓</button>
            <button
              @click="handleTriageClick(index, 'unset', $event)"
              :title="'Clear triage'"
              :style="{
                width: '20px',
                height: '20px',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: triageStates.get(index) === undefined ? '#6b7280' : 'transparent',
                color: triageStates.get(index) === undefined ? 'white' : '#d1d5db',
                transition: 'all 0.2s'
              }"
            >○</button>
            <button
              @click="handleTriageClick(index, 'rejected', $event)"
              :title="'Reject'"
              :style="{
                width: '20px',
                height: '20px',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: triageStates.get(index) === 'rejected' ? '#ef4444' : 'transparent',
                color: triageStates.get(index) === 'rejected' ? 'white' : '#d1d5db',
                transition: 'all 0.2s'
              }"
            >✗</button>
          </div>
          </div>
        </div>
      </div>
      <div v-if="images.length === 0" :style="{ color: colors.textSecondary, fontSize: '0.875rem', padding: '2rem 0' }">
        Click "Open Folder" to get started.
      </div>
    </div>
  </div>
</template>
