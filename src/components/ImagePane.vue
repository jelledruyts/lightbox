<script setup lang="ts">
import { ref } from 'vue'
import type { TriageState } from '../types'

const props = defineProps<{
  imageUrl: string
  imageName: string
  imageIndex: number
  width: number
  height: number
  x: number
  y: number
  triageState?: TriageState
  sharedZoom: number
  sharedPanX: number
  sharedPanY: number
  isDetailView?: boolean
  colors?: {
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
  zoomChange: [zoom: number]
  panChange: [panX: number, panY: number]
  resetZoom: []
}>()

const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const isHovered = ref(false)
const containerRef = ref<HTMLElement>()

function constrainPan(panX: number, panY: number, zoom: number) {
  if (zoom <= 1) {
    return { panX: 0, panY: 0 }
  }
  
  // Get container dimensions
  let width = props.width
  let height = props.height
  
  // In detail view, use actual container dimensions
  if (props.isDetailView && containerRef.value) {
    width = containerRef.value.clientWidth
    height = containerRef.value.clientHeight
  }
  
  // Calculate maximum pan distance based on zoom level and container size
  const maxPanX = (width * (zoom - 1)) / 2
  const maxPanY = (height * (zoom - 1)) / 2
  
  return {
    panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, panY))
  }
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(1, Math.min(5, props.sharedZoom * delta))
  
  // If zooming out to 1, reset pan to 0
  if (newZoom === 1) {
    emit('panChange', 0, 0)
  } else {
    // Constrain existing pan to new zoom level
    const constrained = constrainPan(props.sharedPanX, props.sharedPanY, newZoom)
    emit('panChange', constrained.panX, constrained.panY)
  }
  
  emit('zoomChange', newZoom)
}

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  isDragging.value = true
  dragStart.value = {
    x: event.clientX - props.sharedPanX,
    y: event.clientY - props.sharedPanY
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  const newPanX = event.clientX - dragStart.value.x
  const newPanY = event.clientY - dragStart.value.y
  
  // Constrain pan to keep image within bounds
  const constrained = constrainPan(newPanX, newPanY, props.sharedZoom)
  emit('panChange', constrained.panX, constrained.panY)
}

function handleMouseUp() {
  isDragging.value = false
}

function handleMouseLeave() {
  isDragging.value = false
}

function handleClick(event: MouseEvent) {
  // Only handle if Ctrl/Cmd is pressed and not dragging
  if ((event.ctrlKey || event.metaKey) && !isDragging.value) {
    event.stopPropagation()
    emit('deselect', props.imageIndex)
  }
}

function resetView() {
  emit('resetZoom')
}

function zoomIn() {
  const newZoom = Math.min(5, props.sharedZoom * 1.2)
  
  // Constrain pan to new zoom level
  const constrained = constrainPan(props.sharedPanX, props.sharedPanY, newZoom)
  emit('panChange', constrained.panX, constrained.panY)
  emit('zoomChange', newZoom)
}

function zoomOut() {
  const newZoom = Math.max(1, props.sharedZoom / 1.2)
  
  // If zooming out to 1, reset pan to 0
  if (newZoom === 1) {
    emit('panChange', 0, 0)
  } else {
    // Constrain pan to new zoom level
    const constrained = constrainPan(props.sharedPanX, props.sharedPanY, newZoom)
    emit('panChange', constrained.panX, constrained.panY)
  }
  
  emit('zoomChange', newZoom)
}

function handleTriageClick(state: TriageState) {
  emit('triageChange', props.imageIndex, state)
}

</script>

<template>
  <div
    ref="containerRef"
    :style="{
      position: isDetailView ? 'static' : 'absolute',
      left: isDetailView ? 'auto' : x + 'px',
      top: isDetailView ? 'auto' : y + 'px',
      width: isDetailView ? '100%' : width + 'px',
      height: isDetailView ? '100%' : height + 'px',
      overflow: 'hidden',
      backgroundColor: colors?.bgSecondary || '#2d2d2d'
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div
      :style="{
        width: '100%',
        height: '100%',
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transform: `translate(${sharedPanX}px, ${sharedPanY}px) scale(${sharedZoom})`,
        transformOrigin: 'center',
        cursor: isDragging ? 'grabbing' : 'grab'
      }"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      @click="handleClick"
    >
    </div>
    
    <!-- Controls -->
    <div 
      v-show="isHovered"
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
    
    <!-- Triage state indicator -->
    <div 
      v-if="triageState && triageState !== 'untriaged'"
      :style="{
        position: 'absolute',
        top: '8px',
        left: '8px',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        backgroundColor: triageState === 'accepted' ? '#10b981' : '#ef4444',
        color: 'white'
      }"
    >{{ triageState === 'accepted' ? '✓' : '✗' }}</div>
    
    <!-- Triage controls -->
    <div v-show="isHovered" :style="{
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
        @click="handleTriageClick('untriaged')"
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
          backgroundColor: !triageState || triageState === 'untriaged' ? '#6b7280' : 'rgba(255, 255, 255, 0.1)',
          color: !triageState || triageState === 'untriaged' ? 'white' : '#d1d5db',
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
