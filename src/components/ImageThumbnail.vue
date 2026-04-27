<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ImageFile, TriageState } from '../types'

const props = defineProps<{
  image: ImageFile
  index: number
  isSelected: boolean
  isFocused: boolean
  triageState?: TriageState
  thumbnailHeight?: number
}>()

const emit = defineEmits<{
  select: [index: number, event: MouseEvent]
  triageChange: [index: number, state: TriageState]
}>()

const isHovered = ref(false)
const containerHeight = computed(() => props.thumbnailHeight ?? 96)
const imageHeight = computed(() => Math.max(containerHeight.value - 8, 48))
const maxImageWidth = computed(() => Math.round(imageHeight.value * 1.7))

function handleClick(event: MouseEvent) {
  emit('select', props.index, event)
}

function handleTriageClick(state: TriageState, event: MouseEvent) {
  event.stopPropagation()
  emit('triageChange', props.index, state)
}
</script>

<template>
  <div
    :data-image-index="index"
    :title="image.name"
    @click="handleClick"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    :style="{
      flexShrink: 0,
      cursor: 'pointer',
      borderRadius: '4px',
      transition: 'all 0.2s',
      height: `${containerHeight}px`,
      padding: '4px',
      backgroundColor: isSelected ? '#3b82f6' : (isFocused ? '#93c5fd' : 'transparent'),
      display: 'flex',
      alignItems: 'center',
      position: 'relative'
    }"
  >
    <div :style="{
      backgroundColor: 'transparent',
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
          height: `${imageHeight}px`,
          width: 'auto',
          maxWidth: `${maxImageWidth}px`,
          objectFit: 'contain',
          display: 'block',
          pointerEvents: 'none'
        }"
      />
      <div
        :style="{
          position: 'absolute',
          bottom: '4px',
          left: '4px',
          padding: '1px 4px',
          borderRadius: '999px',
          backgroundColor: 'rgba(17, 24, 39, 0.7)',
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: '10px',
          lineHeight: '1.2',
          fontWeight: '500'
        }"
      >
        {{ index + 1 }}
      </div>
      <!-- Triage state indicator -->
      <div 
        v-if="triageState && triageState !== 'untriaged'"
        :style="{
          position: 'absolute',
          top: '4px',
          left: '4px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 'bold',
          backgroundColor: triageState === 'accepted' ? '#10b981' : '#ef4444',
          color: 'white'
        }"
      >{{ triageState === 'accepted' ? '✓' : '✗' }}</div>
      <div v-show="isHovered" :style="{
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
        @click="handleTriageClick('accepted', $event)"
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
          backgroundColor: triageState === 'accepted' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
          color: triageState === 'accepted' ? 'white' : '#d1d5db',
          transition: 'all 0.2s'
        }"
      >✓</button>
      <button
        @click="handleTriageClick('untriaged', $event)"
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
          backgroundColor: !triageState || triageState === 'untriaged' ? '#6b7280' : 'rgba(255, 255, 255, 0.1)',
          color: !triageState || triageState === 'untriaged' ? 'white' : '#d1d5db',
          transition: 'all 0.2s'
        }"
      >○</button>
      <button
        @click="handleTriageClick('rejected', $event)"
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
          backgroundColor: triageState === 'rejected' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
          color: triageState === 'rejected' ? 'white' : '#d1d5db',
          transition: 'all 0.2s'
        }"
      >✗</button>
      </div>
    </div>
  </div>
</template>
