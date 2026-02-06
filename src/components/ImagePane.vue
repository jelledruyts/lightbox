<script setup lang="ts">
import { ref } from 'vue'
import type { ZoomPanState, TriageState } from '../types'

const props = defineProps<{
  imageUrl: string
  imageName: string
  imageIndex: number
  width: number
  height: number
  x: number
  y: number
  triageState?: TriageState
}>()

const emit = defineEmits<{
  triageChange: [index: number, state: TriageState]
  deselect: [index: number]
}>()

const zoomPan = ref<ZoomPanState>({
  zoom: 1,
  panX: 0,
  panY: 0
})

const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  zoomPan.value.zoom = Math.max(0.1, Math.min(5, zoomPan.value.zoom * delta))
}

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  isDragging.value = true
  dragStart.value = {
    x: event.clientX - zoomPan.value.panX,
    y: event.clientY - zoomPan.value.panY
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  zoomPan.value.panX = event.clientX - dragStart.value.x
  zoomPan.value.panY = event.clientY - dragStart.value.y
}

function handleMouseUp() {
  isDragging.value = false
}

function resetView() {
  zoomPan.value = { zoom: 1, panX: 0, panY: 0 }
}

function zoomIn() {
  zoomPan.value.zoom = Math.min(5, zoomPan.value.zoom * 1.2)
}

function zoomOut() {
  zoomPan.value.zoom = Math.max(0.1, zoomPan.value.zoom / 1.2)
}

function handleTriageClick(state: TriageState) {
  emit('triageChange', props.imageIndex, state)
}

</script>

<template>
  <div
    :style="{
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      width: width + 'px',
      height: height + 'px',
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#2d2d2d',
      transform: `scale(${zoomPan.zoom})`,
      transformOrigin: 'center',
      cursor: isDragging ? 'grabbing' : 'grab'
    }"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <!-- Controls -->
    <div 
      :style="{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        display: 'flex',
        gap: '4px'
      }"
    >
      <button @click="zoomIn" style="padding: 4px 8px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 4px; cursor: pointer;" title="Zoom in">+</button>
      <button @click="zoomOut" style="padding: 4px 8px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 4px; cursor: pointer;" title="Zoom out">−</button>
      <button @click="resetView" style="padding: 4px 8px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 4px; cursor: pointer;" title="Reset">⟲</button>
    </div>
    
    <!-- Image name -->
    <div style="position: absolute; top: 8px; left: 8px; padding: 4px 8px; background: rgba(0,0,0,0.7); color: white; border-radius: 4px; font-size: 12px;">
      {{ imageName }}
    </div>
    
    <!-- Deselect button -->
    <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%);">
      <button
        @click="emit('deselect', imageIndex)"
        title="Deselect this image"
        style="padding: 4px 12px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
      >✕ Deselect</button>
    </div>
    
    <!-- Triage controls -->
    <div :style="{
      position: 'absolute',
      top: '8px',
      right: '8px',
      display: 'flex',
      gap: '4px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '4px',
      padding: '4px'
    }">
      <button
        @click="handleTriageClick('accepted')"
        :title="'Accept'"
        :style="{
          width: '28px',
          height: '28px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: triageState === 'accepted' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
          color: triageState === 'accepted' ? 'white' : '#d1d5db',
          transition: 'all 0.2s'
        }"
      >✓</button>
      <button
        @click="handleTriageClick('unset')"
        :title="'Clear triage'"
        :style="{
          width: '28px',
          height: '28px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: !triageState || triageState === 'unset' ? '#6b7280' : 'rgba(255, 255, 255, 0.1)',
          color: !triageState || triageState === 'unset' ? 'white' : '#d1d5db',
          transition: 'all 0.2s'
        }"
      >○</button>
      <button
        @click="handleTriageClick('rejected')"
        :title="'Reject'"
        :style="{
          width: '28px',
          height: '28px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
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
</template>
