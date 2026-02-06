<script setup lang="ts">
import { ref, onUnmounted, onMounted, computed, watch } from 'vue'
import FolderSelector from './components/FolderSelector.vue'
import Filmstrip from './components/Filmstrip.vue'
import ImageViewer from './components/ImageViewer.vue'
import { useImageLoader } from './composables/useImageLoader'
import type { TriageState } from './types'

interface TriageHistoryEntry {
  changes: Array<{
    index: number
    previousState: TriageState | undefined
  }>
}

type Theme = 'system' | 'light' | 'dark'

const { images, loadImages, cleanup } = useImageLoader()
const selectedIndices = ref<Set<number>>(new Set())
const selectionOrder = ref<number[]>([])
const lastSelectedIndex = ref<number | null>(null)
const currentFocusIndex = ref<number | null>(null)
const triageStates = ref<Map<number, TriageState>>(new Map())
const activeFilters = ref<Set<TriageState | 'unset'>>(new Set(['accepted', 'unset', 'rejected']))
const triageHistory = ref<TriageHistoryEntry[]>([])
const redoHistory = ref<TriageHistoryEntry[]>([])
const theme = ref<Theme>('system')
const folderHandle = ref<FileSystemDirectoryHandle | null>(null)

const isDarkMode = computed(() => {
  if (theme.value === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return theme.value === 'dark'
})

const colors = computed(() => {
  if (isDarkMode.value) {
    return {
      bg: '#1f2937',
      bgSecondary: '#374151',
      border: '#4b5563',
      text: '#f3f4f6',
      textSecondary: '#d1d5db',
      buttonBg: '#4b5563',
      buttonHoverBg: '#6b7280'
    }
  } else {
    return {
      bg: '#f3f4f6',
      bgSecondary: '#e5e7eb',
      border: '#d1d5db',
      text: '#374151',
      textSecondary: '#6b7280',
      buttonBg: '#e5e7eb',
      buttonHoverBg: '#d1d5db'
    }
  }
})

function saveTriageStates() {
  if (!folderHandle.value) return
  
  const folderName = folderHandle.value.name
  const triageData: Record<string, TriageState> = {}
  
  // Only save accepted and rejected states
  for (const [index, state] of triageStates.value.entries()) {
    if (state !== 'unset') {
      const image = images.value[index]
      if (image) {
        const filePath = image.file.webkitRelativePath || image.name
        triageData[filePath] = state
      }
    }
  }
  
  // Save to localStorage with folder-specific key
  const storageKey = `lightbox-triage-${folderName}`
  localStorage.setItem(storageKey, JSON.stringify(triageData))
}

function loadTriageStates() {
  if (!folderHandle.value) return
  
  const folderName = folderHandle.value.name
  const storageKey = `lightbox-triage-${folderName}`
  const saved = localStorage.getItem(storageKey)
  
  if (!saved) return
  
  try {
    const triageData: Record<string, TriageState> = JSON.parse(saved)
    
    // Map file paths to indices
    for (let i = 0; i < images.value.length; i++) {
      const image = images.value[i]
      const filePath = image.file.webkitRelativePath || image.name
      
      if (triageData[filePath]) {
        triageStates.value.set(i, triageData[filePath])
      }
    }
  } catch (error) {
    console.error('Failed to load triage states:', error)
  }
}

// Update document data-theme attribute for scrollbars
watch(theme, (newTheme) => {
  if (newTheme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', newTheme)
  }
}, { immediate: true })

// Save active filters to localStorage whenever they change
watch(activeFilters, (filters) => {
  const filtersArray = Array.from(filters)
  localStorage.setItem('lightbox-filters', JSON.stringify(filtersArray))
}, { deep: true })

const filteredIndices = computed(() => {
  return Array.from({ length: images.value.length }, (_, i) => i).filter(index => {
    const state = triageStates.value.get(index) || 'unset'
    return activeFilters.value.has(state)
  })
})

function toggleFilter(filter: TriageState | 'unset') {
  if (activeFilters.value.has(filter)) {
    activeFilters.value.delete(filter)
  } else {
    activeFilters.value.add(filter)
  }
  
  // Remove any selected images that are now filtered out
  const selectedToRemove: number[] = []
  let maxRemovedIndex = -1
  
  selectedIndices.value.forEach(index => {
    const state = triageStates.value.get(index) || 'unset'
    if (!activeFilters.value.has(state)) {
      selectedToRemove.push(index)
      maxRemovedIndex = Math.max(maxRemovedIndex, index)
    }
  })
  
  selectedToRemove.forEach(index => {
    selectedIndices.value.delete(index)
    selectionOrder.value = selectionOrder.value.filter(i => i !== index)
  })
  
  // If all selections were removed and we have visible images, select the next one after the highest removed index
  if (selectedIndices.value.size === 0 && filteredIndices.value.length > 0) {
    const nextVisible = maxRemovedIndex >= 0 
      ? (filteredIndices.value.find(i => i > maxRemovedIndex) || filteredIndices.value[0])
      : filteredIndices.value[0]
    
    selectedIndices.value.add(nextVisible)
    selectionOrder.value.push(nextVisible)
    lastSelectedIndex.value = nextVisible
    currentFocusIndex.value = nextVisible
    scrollToImage(nextVisible)
  }
}

function setAllFilters() {
  activeFilters.value = new Set(['accepted', 'unset', 'rejected'])
}

function toggleTheme() {
  const themes: Theme[] = ['system', 'light', 'dark']
  const currentIndex = themes.indexOf(theme.value)
  theme.value = themes[(currentIndex + 1) % themes.length]
  localStorage.setItem('theme', theme.value)
}

function getThemeIcon() {
  if (theme.value === 'system') return '◐'
  if (theme.value === 'light') return '☀'
  return '☾'
}

async function handleFolderSelected(files: File[], dirHandle: FileSystemDirectoryHandle) {
  cleanup()
  selectedIndices.value.clear()
  selectionOrder.value = []
  lastSelectedIndex.value = null
  currentFocusIndex.value = null
  triageStates.value.clear()
  triageHistory.value = []
  redoHistory.value = []
  folderHandle.value = dirHandle
  
  await loadImages(files)
  
  // Load saved triage states after images are loaded
  loadTriageStates()
  
  if (images.value.length > 0) {
    selectedIndices.value.add(0)
    selectionOrder.value.push(0)
    lastSelectedIndex.value = 0
    currentFocusIndex.value = 0
  }
}

function handleImageSelect(index: number, event: MouseEvent) {
  if (event.shiftKey && lastSelectedIndex.value !== null) {
    const start = Math.min(lastSelectedIndex.value, index)
    const end = Math.max(lastSelectedIndex.value, index)
    for (let i = start; i <= end; i++) {
      if (!selectedIndices.value.has(i)) {
        selectedIndices.value.add(i)
        selectionOrder.value.push(i)
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedIndices.value.has(index)) {
      selectedIndices.value.delete(index)
      selectionOrder.value = selectionOrder.value.filter(i => i !== index)
    } else {
      selectedIndices.value.add(index)
      selectionOrder.value.push(index)
    }
  } else {
    selectedIndices.value.clear()
    selectionOrder.value = [index]
    selectedIndices.value.add(index)
  }
  
  lastSelectedIndex.value = index
  currentFocusIndex.value = index
}

function handleKeyDown(event: KeyboardEvent) {
  if (images.value.length === 0) return
  
  // Select All with Ctrl+A
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    event.preventDefault()
    selectAll()
    return
  }
  
  // Clear Selection with Ctrl+D
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault()
    clearSelection()
    return
  }
  
  // Toggle filter for Accepted with Ctrl+P
  if ((event.ctrlKey || event.metaKey) && (event.key === 'p' || event.key === 'P')) {
    event.preventDefault()
    toggleFilter('accepted')
    return
  }
  
  // Toggle filter for Rejected with Ctrl+X
  if ((event.ctrlKey || event.metaKey) && (event.key === 'x' || event.key === 'X')) {
    event.preventDefault()
    toggleFilter('rejected')
    return
  }
  
  // Toggle filter for Unset with Ctrl+U
  if ((event.ctrlKey || event.metaKey) && (event.key === 'u' || event.key === 'U')) {
    event.preventDefault()
    toggleFilter('unset')
    return
  }
  
  // Undo with Ctrl+Z
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault()
    undoTriageChange()
    return
  }
  
  // Redo with Ctrl+Y
  if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
    event.preventDefault()
    redoTriageChange()
    return
  }
  
  // Triage keyboard shortcuts (apply to all selected)
  if (event.key === 'p' || event.key === 'P') {
    event.preventDefault()
    if (currentFocusIndex.value !== null) {
      handleTriageChange(currentFocusIndex.value, 'accepted', true)
    }
    return
  }
  
  if (event.key === 'x' || event.key === 'X') {
    event.preventDefault()
    if (currentFocusIndex.value !== null) {
      handleTriageChange(currentFocusIndex.value, 'rejected', true)
    }
    return
  }
  
  if (event.key === 'u' || event.key === 'U') {
    event.preventDefault()
    if (currentFocusIndex.value !== null) {
      handleTriageChange(currentFocusIndex.value, 'unset', true)
    }
    return
  }
  
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    
    if (filteredIndices.value.length === 0) return
    
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const currentFilteredIndex = filteredIndices.value.indexOf(currentFocusIndex.value ?? 0)
    let newFilteredIndex = currentFilteredIndex + direction
    
    // Wrap around within filtered indices
    if (newFilteredIndex < 0) newFilteredIndex = filteredIndices.value.length - 1
    if (newFilteredIndex >= filteredIndices.value.length) newFilteredIndex = 0
    
    const newIndex = filteredIndices.value[newFilteredIndex]
    currentFocusIndex.value = newIndex
    
    if (event.shiftKey) {
      // Expand selection
      if (lastSelectedIndex.value !== null) {
        const start = Math.min(lastSelectedIndex.value, newIndex)
        const end = Math.max(lastSelectedIndex.value, newIndex)
        
        // Add all indices in range that are also filtered
        for (let i = start; i <= end; i++) {
          if (filteredIndices.value.includes(i) && !selectedIndices.value.has(i)) {
            selectedIndices.value.add(i)
            selectionOrder.value.push(i)
          }
        }
      }
    } else {
      // Select only this image
      selectedIndices.value.clear()
      selectionOrder.value = [newIndex]
      selectedIndices.value.add(newIndex)
      lastSelectedIndex.value = newIndex
    }
    
    // Scroll to the focused image
    scrollToImage(newIndex)
  }
}

function scrollToImage(index: number) {
  // Wait a tick for DOM to update, then scroll
  setTimeout(() => {
    const filmstripElement = document.querySelector('[data-filmstrip-scroll]')
    const imageElements = document.querySelectorAll('[data-image-index]')
    
    if (filmstripElement && imageElements[index]) {
      const imageElement = imageElements[index] as HTMLElement
      imageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, 0)
}

function selectAll() {
  selectedIndices.value.clear()
  selectionOrder.value = []
  images.value.forEach((_, index) => {
    selectedIndices.value.add(index)
    selectionOrder.value.push(index)
  })
}

function clearSelection() {
  selectedIndices.value.clear()
  selectionOrder.value = []
}

function handleImageDeselect(index: number) {
  selectedIndices.value.delete(index)
  selectionOrder.value = selectionOrder.value.filter(i => i !== index)
  
  // If we deselected the last image and there are still visible images, select the next one
  if (selectedIndices.value.size === 0 && filteredIndices.value.length > 0) {
    const nextVisible = filteredIndices.value.find(i => i > index) || filteredIndices.value[0]
    if (nextVisible !== undefined) {
      selectedIndices.value.add(nextVisible)
      selectionOrder.value.push(nextVisible)
      lastSelectedIndex.value = nextVisible
      currentFocusIndex.value = nextVisible
      scrollToImage(nextVisible)
    }
  }
}

function handleTriageChange(index: number, state: TriageState, applyToSelection: boolean = false) {
  // Apply to all selected images if requested (keyboard shortcuts)
  const indicesToChange = applyToSelection && selectedIndices.value.has(index)
    ? Array.from(selectedIndices.value) 
    : [index]
  
  // Save current states to history
  const changes = indicesToChange.map(idx => ({
    index: idx,
    previousState: triageStates.value.get(idx)
  }))
  triageHistory.value.push({ changes })
  
  // Clear redo history when making a new change
  redoHistory.value = []
  
  // Apply new state to all
  for (const idx of indicesToChange) {
    if (state === 'unset') {
      triageStates.value.delete(idx)
    } else {
      triageStates.value.set(idx, state)
    }
  }
  
  // Handle filtering and selection updates
  for (const idx of indicesToChange) {
    const newState = triageStates.value.get(idx) || 'unset'
    const isFilteredOut = !activeFilters.value.has(newState)
    
    if (isFilteredOut && selectedIndices.value.has(idx)) {
      // Remove from selection
      selectedIndices.value.delete(idx)
      selectionOrder.value = selectionOrder.value.filter(i => i !== idx)
      
      // Clear focus if this was the focused image
      if (currentFocusIndex.value === idx) {
        const nextVisible = filteredIndices.value.find(i => i > idx) || filteredIndices.value[0]
        currentFocusIndex.value = nextVisible !== undefined ? nextVisible : null
      }
    }
  }
  
  // If all selected images were filtered out, select the next visible one
  if (selectedIndices.value.size === 0 && filteredIndices.value.length > 0) {
    const maxChangedIndex = Math.max(...indicesToChange)
    const nextVisible = filteredIndices.value.find(i => i > maxChangedIndex) || filteredIndices.value[0]
    
    if (nextVisible !== undefined) {
      selectedIndices.value.add(nextVisible)
      selectionOrder.value.push(nextVisible)
      lastSelectedIndex.value = nextVisible
      currentFocusIndex.value = nextVisible
      scrollToImage(nextVisible)
    }
  }
  
  // Save triage states to localStorage
  saveTriageStates()
}

function undoTriageChange() {
  if (triageHistory.value.length === 0) return
  
  const entry = triageHistory.value.pop()!
  
  // Save current states to redo history
  const redoChanges = entry.changes.map(change => ({
    index: change.index,
    previousState: triageStates.value.get(change.index)
  }))
  redoHistory.value.push({ changes: redoChanges })
  
  // Restore previous states
  for (const change of entry.changes) {
    if (change.previousState === undefined) {
      triageStates.value.delete(change.index)
    } else {
      triageStates.value.set(change.index, change.previousState)
    }
  }
  
  // Save triage states after undo
  saveTriageStates()
}

function redoTriageChange() {
  if (redoHistory.value.length === 0) return
  
  const entry = redoHistory.value.pop()!
  
  // Save current states to undo history
  const undoChanges = entry.changes.map(change => ({
    index: change.index,
    previousState: triageStates.value.get(change.index)
  }))
  triageHistory.value.push({ changes: undoChanges })
  
  // Apply redo states
  for (const change of entry.changes) {
    if (change.previousState === undefined) {
      triageStates.value.delete(change.index)
    } else {
      triageStates.value.set(change.index, change.previousState)
    }
  }
  
  // Save triage states after redo
  saveTriageStates()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  
  // Load saved filters
  const savedFilters = localStorage.getItem('lightbox-filters')
  if (savedFilters) {
    try {
      const filtersArray = JSON.parse(savedFilters) as (TriageState | 'unset')[]
      activeFilters.value = new Set(filtersArray)
    } catch (error) {
      console.error('Failed to load saved filters:', error)
    }
  }
  
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') as Theme | null
  if (savedTheme && ['system', 'light', 'dark'].includes(savedTheme)) {
    theme.value = savedTheme
  }
  
  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleThemeChange = () => {
    if (theme.value === 'system') {
      // Trigger re-computation by accessing isDarkMode
      isDarkMode.value
    }
  }
  mediaQuery.addEventListener('change', handleThemeChange)
  
  onUnmounted(() => {
    mediaQuery.removeEventListener('change', handleThemeChange)
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  cleanup()
})
</script>

<template>
  <div :style="{ height: '100vh', display: 'grid', gridTemplateRows: 'auto auto 1fr', overflow: 'hidden', backgroundColor: colors.bg, color: colors.text }">
    <FolderSelector :colors="colors" @folder-selected="handleFolderSelected">
      <template #actions>
        <button
          v-if="images.length > 0"
          @click="selectAll"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: colors.buttonBg,
            color: colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
          @mouseover="$event.currentTarget.style.backgroundColor = colors.buttonHoverBg"
          @mouseout="$event.currentTarget.style.backgroundColor = colors.buttonBg"
        >
          Select All
        </button>
        <button
          v-if="selectedIndices.size > 0"
          @click="clearSelection"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: colors.buttonBg,
            color: colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
          @mouseover="$event.currentTarget.style.backgroundColor = colors.buttonHoverBg"
          @mouseout="$event.currentTarget.style.backgroundColor = colors.buttonBg"
        >
          Clear Selection
        </button>
        <button
          v-if="images.length > 0 && triageHistory.length > 0"
          @click="undoTriageChange"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: colors.buttonBg,
            color: colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
          @mouseover="$event.currentTarget.style.backgroundColor = colors.buttonHoverBg"
          @mouseout="$event.currentTarget.style.backgroundColor = colors.buttonBg"
          title="Undo last triage (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          v-if="images.length > 0 && redoHistory.length > 0"
          @click="redoTriageChange"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: colors.buttonBg,
            color: colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
          @mouseover="$event.currentTarget.style.backgroundColor = colors.buttonHoverBg"
          @mouseout="$event.currentTarget.style.backgroundColor = colors.buttonBg"
          title="Redo last undo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
        
        <div v-if="images.length > 0" :style="{ width: '1px', height: '24px', backgroundColor: colors.border, margin: '0 0.5rem' }"></div>
        
        <button
          @click="toggleTheme"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: colors.buttonBg,
            color: colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
          @mouseover="$event.currentTarget.style.backgroundColor = colors.buttonHoverBg"
          @mouseout="$event.currentTarget.style.backgroundColor = colors.buttonBg"
          :title="`Theme: ${theme}`"
        >
          {{ getThemeIcon() }}
        </button>
        
        <div v-if="images.length > 0" :style="{ width: '1px', height: '24px', backgroundColor: colors.border, margin: '0 0.5rem' }"></div>
        
        <button
          v-if="images.length > 0"
          @click="setAllFilters"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: activeFilters.size === 3 ? '#3b82f6' : colors.buttonBg,
            color: activeFilters.size === 3 ? 'white' : colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
        >
          All
        </button>
        <button
          v-if="images.length > 0"
          @click="toggleFilter('accepted')"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: activeFilters.has('accepted') ? '#10b981' : colors.buttonBg,
            color: activeFilters.has('accepted') ? 'white' : colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
        >
          ✓ Accepted
        </button>
        <button
          v-if="images.length > 0"
          @click="toggleFilter('unset')"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: activeFilters.has('unset') ? '#6b7280' : colors.buttonBg,
            color: activeFilters.has('unset') ? 'white' : colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
        >
          ○ Unset
        </button>
        <button
          v-if="images.length > 0"
          @click="toggleFilter('rejected')"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: activeFilters.has('rejected') ? '#ef4444' : colors.buttonBg,
            color: activeFilters.has('rejected') ? 'white' : colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
        >
          ✗ Rejected
        </button>
      </template>
    </FolderSelector>
    <Filmstrip
      :images="images"
      :selected-indices="selectedIndices"
      :current-focus-index="currentFocusIndex"
      :triage-states="triageStates"
      :filtered-indices="filteredIndices"
      :colors="colors"
      @select="handleImageSelect"
      @triage-change="handleTriageChange"
    />
    <ImageViewer
      :images="images"
      :selected-indices="selectedIndices"
      :selection-order="selectionOrder"
      :triage-states="triageStates"
      :colors="colors"
      @triage-change="handleTriageChange"
      @deselect="handleImageDeselect"
    />
  </div>
</template>
