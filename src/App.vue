<script setup lang="ts">
import { ref, onUnmounted, onMounted, computed, watch } from 'vue'
import Toolbar from './components/Toolbar.vue'
import ToolbarSelect from './components/ToolbarSelect.vue'
import Filmstrip from './components/Filmstrip.vue'
import ImageViewer from './components/ImageViewer.vue'
import ImagePane from './components/ImagePane.vue'
import ImageThumbnail from './components/ImageThumbnail.vue'
import StatusBar from './components/StatusBar.vue'
import { useImageLoader } from './composables/useImageLoader'
import { sortImages } from './utils/imageSorting'
import type { ImageFile, ImageSortOption, TriageState, ViewMode } from './types'

interface TriageHistoryEntry {
  changes: Array<{
    index: number
    previousState: TriageState | undefined
  }>
}

type Theme = 'system' | 'light' | 'dark'

interface SortOptionDefinition {
  value: ImageSortOption
  label: string
}

const { images, loadImages, cleanup } = useImageLoader()
const selectedIndices = ref<Set<number>>(new Set())
const selectionOrder = ref<number[]>([])
const lastSelectedIndex = ref<number | null>(null)
const currentFocusIndex = ref<number | null>(null)
const triageStates = ref<Map<number, TriageState>>(new Map())
const activeFilters = ref<Set<TriageState | 'untriaged'>>(new Set(['accepted', 'untriaged', 'rejected']))
const triageHistory = ref<TriageHistoryEntry[]>([])
const redoHistory = ref<TriageHistoryEntry[]>([])
const theme = ref<Theme>('system')
const folderHandle = ref<FileSystemDirectoryHandle | null>(null)
const viewMode = ref<ViewMode>('filmstrip')
const detailViewIndex = ref(0)
const detailZoom = ref(1)
const detailPanX = ref(0)
const detailPanY = ref(0)
const showHelpModal = ref(false)
const toolbarRef = ref<{ openFolder: () => void } | null>(null)
const showConfirmModal = ref(false)
const confirmModalMessage = ref('')
const confirmModalCallback = ref<(() => void) | null>(null)
const sortOption = ref<ImageSortOption>('date-taken')
const filmstripHeight = ref(128)
const isResizingFilmstrip = ref(false)
const filmstripResizeStartY = ref(0)
const filmstripResizeStartHeight = ref(128)

const MIN_FILMSTRIP_HEIGHT = 96
const MAX_FILMSTRIP_HEIGHT_RATIO = 0.45

const sortOptions: SortOptionDefinition[] = [
  { value: 'date-taken', label: 'Date taken' },
  { value: 'filename', label: 'Filename' }
]

function showConfirmation(message: string, onConfirm: () => void) {
  confirmModalMessage.value = message
  confirmModalCallback.value = onConfirm
  showConfirmModal.value = true
}

function handleConfirm() {
  showConfirmModal.value = false
  if (confirmModalCallback.value) {
    confirmModalCallback.value()
  }
  confirmModalCallback.value = null
}

function handleCancel() {
  showConfirmModal.value = false
  confirmModalCallback.value = null
}

function getMaxFilmstripHeight() {
  return Math.max(MIN_FILMSTRIP_HEIGHT, Math.round(window.innerHeight * MAX_FILMSTRIP_HEIGHT_RATIO))
}

function clampFilmstripHeight(height: number) {
  return Math.min(Math.max(Math.round(height), MIN_FILMSTRIP_HEIGHT), getMaxFilmstripHeight())
}

function stopFilmstripResize() {
  if (!isResizingFilmstrip.value) {
    return
  }

  isResizingFilmstrip.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function handleFilmstripResize(event: PointerEvent) {
  if (!isResizingFilmstrip.value) {
    return
  }

  const deltaY = event.clientY - filmstripResizeStartY.value
  filmstripHeight.value = clampFilmstripHeight(filmstripResizeStartHeight.value + deltaY)
}

function startFilmstripResize(event: PointerEvent) {
  if (viewMode.value !== 'filmstrip') {
    return
  }

  event.preventDefault()
  filmstripResizeStartY.value = event.clientY
  filmstripResizeStartHeight.value = filmstripHeight.value
  isResizingFilmstrip.value = true
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function remapIndex(index: number | null, indexMap: Map<number, number>) {
  if (index === null) {
    return null
  }

  return indexMap.get(index) ?? null
}

function remapIndexArray(indices: number[], indexMap: Map<number, number>) {
  return indices
    .map(index => indexMap.get(index))
    .filter((index): index is number => index !== undefined)
}

function remapIndexSet(indices: Set<number>, indexMap: Map<number, number>) {
  return new Set(remapIndexArray(Array.from(indices), indexMap))
}

function remapTriageStateMap(indexMap: Map<number, number>) {
  const nextTriageStates = new Map<number, TriageState>()

  for (const [index, state] of triageStates.value.entries()) {
    const nextIndex = indexMap.get(index)
    if (nextIndex !== undefined) {
      nextTriageStates.set(nextIndex, state)
    }
  }

  triageStates.value = nextTriageStates
}

function remapHistoryEntries(indexMap: Map<number, number>, historyEntries: TriageHistoryEntry[]) {
  return historyEntries.map(entry => ({
    changes: entry.changes
      .map(change => {
        const nextIndex = indexMap.get(change.index)
        return nextIndex === undefined
          ? null
          : {
              index: nextIndex,
              previousState: change.previousState
            }
      })
      .filter((change): change is TriageHistoryEntry['changes'][number] => change !== null)
  }))
}

function syncDetailViewIndex() {
  if (viewMode.value !== 'detail') {
    return
  }

  const selectedArray = Array.from(selectedIndices.value).sort((a, b) => a - b)
  if (selectedArray.length === 0 || currentFocusIndex.value === null) {
    detailViewIndex.value = 0
    return
  }

  const focusedIndex = selectedArray.indexOf(currentFocusIndex.value)
  detailViewIndex.value = focusedIndex >= 0 ? focusedIndex : 0
}

function applySort(nextSortOption: ImageSortOption) {
  if (images.value.length < 2) {
    return
  }

  const currentImages = [...images.value]
  const sortedImages = sortImages(currentImages, nextSortOption)

  if (sortedImages.every((image, index) => image === currentImages[index])) {
    return
  }

  const oldIndexByImage = new Map<ImageFile, number>()
  currentImages.forEach((image, index) => {
    oldIndexByImage.set(image, index)
  })

  const indexMap = new Map<number, number>()
  sortedImages.forEach((image, index) => {
    const previousIndex = oldIndexByImage.get(image)
    if (previousIndex !== undefined) {
      indexMap.set(previousIndex, index)
    }
  })

  images.value.splice(0, images.value.length, ...sortedImages)
  selectedIndices.value = remapIndexSet(selectedIndices.value, indexMap)
  selectionOrder.value = remapIndexArray(selectionOrder.value, indexMap)
  lastSelectedIndex.value = remapIndex(lastSelectedIndex.value, indexMap)
  currentFocusIndex.value = remapIndex(currentFocusIndex.value, indexMap)
  remapTriageStateMap(indexMap)
  triageHistory.value = remapHistoryEntries(indexMap, triageHistory.value)
  redoHistory.value = remapHistoryEntries(indexMap, redoHistory.value)
  syncDetailViewIndex()

  if (currentFocusIndex.value !== null) {
    scrollToImage(currentFocusIndex.value)
  }
}

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
    if (state !== 'untriaged') {
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
    const state = triageStates.value.get(index) || 'untriaged'
    return activeFilters.value.has(state)
  })
})

function toggleFilter(filter: TriageState | 'untriaged') {
  if (activeFilters.value.has(filter)) {
    activeFilters.value.delete(filter)
  } else {
    activeFilters.value.add(filter)
  }
  
  // Remove any selected images that are now filtered out
  const selectedToRemove: number[] = []
  let maxRemovedIndex = -1
  
  selectedIndices.value.forEach(index => {
    const state = triageStates.value.get(index) || 'untriaged'
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
  activeFilters.value = new Set(['accepted', 'untriaged', 'rejected'])
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

function toggleViewMode() {
  if (viewMode.value === 'filmstrip') {
    viewMode.value = 'grid'
  } else if (viewMode.value === 'grid') {
    viewMode.value = 'detail'
  } else {
    viewMode.value = 'filmstrip'
  }
}

function getViewModeIcon() {
  if (viewMode.value === 'filmstrip') return '▦'
  if (viewMode.value === 'grid') return '▬'
  return '◉'
}

// Detail view navigation
function navigateDetailView(direction: number) {
  const selectedArray = Array.from(selectedIndices.value).sort((a, b) => a - b)
  if (selectedArray.length === 0) return
  
  detailViewIndex.value = (detailViewIndex.value + direction + selectedArray.length) % selectedArray.length
  currentFocusIndex.value = selectedArray[detailViewIndex.value]
}

function handleDetailZoomChange(newZoom: number) {
  detailZoom.value = newZoom
}

function handleDetailPanChange(panX: number, panY: number) {
  detailPanX.value = panX
  detailPanY.value = panY
}

function resetDetailZoom() {
  detailZoom.value = 1
  detailPanX.value = 0
  detailPanY.value = 0
}

function handleDetailViewDeselect(index: number) {
  // Remove from selection
  selectedIndices.value.delete(index)
  selectionOrder.value = selectionOrder.value.filter(i => i !== index)
  
  // If there are still selected images, navigate to the next one
  if (selectedIndices.value.size > 0) {
    const selectedArray = Array.from(selectedIndices.value).sort((a, b) => a - b)
    // Stay at the same position if possible, or go to the previous one
    if (detailViewIndex.value >= selectedArray.length) {
      detailViewIndex.value = selectedArray.length - 1
    }
    currentFocusIndex.value = selectedArray[detailViewIndex.value]
  } else {
    // No more selected images, exit detail view
    viewMode.value = 'filmstrip'
    currentFocusIndex.value = null
  }
}

// Computed properties for button states
const canSelectAll = computed(() => {
  return images.value.length > 0 && selectedIndices.value.size < filteredIndices.value.length
})

const canClearSelection = computed(() => {
  return selectedIndices.value.size > 0
})

const canUndo = computed(() => {
  return triageHistory.value.length > 0
})

const canRedo = computed(() => {
  return redoHistory.value.length > 0
})

const canDelete = computed(() => {
  return selectedIndices.value.size > 0 && folderHandle.value !== null
})

const canDeleteRejected = computed(() => {
  if (!folderHandle.value) return false
  // Check if there are any rejected images
  for (let i = 0; i < images.value.length; i++) {
    if (triageStates.value.get(i) === 'rejected') {
      return true
    }
  }
  return false
})

async function deleteSelectedImages() {
  if (selectedIndices.value.size === 0 || !folderHandle.value) return
  
  const count = selectedIndices.value.size
  const fileNames = Array.from(selectedIndices.value)
    .map(idx => images.value[idx].name)
    .slice(0, 5)
  const displayNames = fileNames.join(', ') + (count > 5 ? `, and ${count - 5} more` : '')
  
  const message = `Are you sure you want to permanently delete ${count} image${count > 1 ? 's' : ''}?\n\n${displayNames}\n\nThis cannot be undone.`
  
  showConfirmation(message, async () => {
    try {
    // Request write permission for the directory
    if (!folderHandle.value) return
    const permission = await (folderHandle.value as any).requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') {
      alert('Permission to delete files was denied. Please grant write permission to delete files.')
      return
    }
    
    const indicesToDelete = Array.from(selectedIndices.value)
    
    // Delete files from disk
    for (const index of indicesToDelete) {
      const fileName = images.value[index].name
      try {
        await folderHandle.value.removeEntry(fileName)
      } catch (error) {
        console.error(`Failed to delete ${fileName}:`, error)
        alert(`Failed to delete ${fileName}. Error: ${(error as Error).message}`)
        return
      }
    }
    
    // Remove from images array and update indices
    const remainingImages = images.value.filter((_, idx) => !indicesToDelete.includes(idx))
    
    // Clear deleted images from state
    indicesToDelete.forEach(idx => {
      triageStates.value.delete(idx)
    })
    
    // Rebuild the images and states with new indices
    images.value.splice(0, images.value.length, ...remainingImages)
    
    // Rebuild triage states with updated indices
    const newTriageStates = new Map<number, TriageState>()
    let newIndex = 0
    for (let oldIndex = 0; oldIndex < images.value.length + indicesToDelete.length; oldIndex++) {
      if (!indicesToDelete.includes(oldIndex)) {
        const state = triageStates.value.get(oldIndex)
        if (state) {
          newTriageStates.set(newIndex, state)
        }
        newIndex++
      }
    }
    triageStates.value = newTriageStates
    
    // Clear selection
    selectedIndices.value.clear()
    selectionOrder.value = []
    
    // Select next visible image
    if (filteredIndices.value.length > 0) {
      const nextIndex = filteredIndices.value[0]
      selectedIndices.value.add(nextIndex)
      selectionOrder.value.push(nextIndex)
      lastSelectedIndex.value = nextIndex
      currentFocusIndex.value = nextIndex
    } else {
      lastSelectedIndex.value = null
      currentFocusIndex.value = null
    }
    
    // Save updated triage states
    saveTriageStates()
    } catch (error) {
      console.error('Error deleting files:', error)
      alert('Failed to delete files. Make sure you have permission.')
    }
  })
}

async function deleteRejectedImages() {
  if (!folderHandle.value) return
  
  // Find all rejected images
  const rejectedIndices: number[] = []
  for (let i = 0; i < images.value.length; i++) {
    if (triageStates.value.get(i) === 'rejected') {
      rejectedIndices.push(i)
    }
  }
  
  if (rejectedIndices.length === 0) return
  
  const count = rejectedIndices.length
  const fileNames = rejectedIndices
    .slice(0, 5)
    .map(idx => images.value[idx].name)
  const displayNames = fileNames.join(', ') + (count > 5 ? `, and ${count - 5} more` : '')
  
  const message = `Are you sure you want to permanently delete ${count} rejected image${count > 1 ? 's' : ''}?\n\n${displayNames}\n\nThis cannot be undone.`
  
  showConfirmation(message, async () => {
    try {
    // Request write permission for the directory
    if (!folderHandle.value) return
    const permission = await (folderHandle.value as any).requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') {
      alert('Permission to delete files was denied. Please grant write permission to delete files.')
      return
    }
    
    // Delete files from disk
    for (const index of rejectedIndices) {
      const fileName = images.value[index].name
      try {
        await folderHandle.value.removeEntry(fileName)
      } catch (error) {
        console.error(`Failed to delete ${fileName}:`, error)
        alert(`Failed to delete ${fileName}. Error: ${(error as Error).message}`)
        return
      }
    }
    
    // Remove from images array
    const remainingImages = images.value.filter((_, idx) => !rejectedIndices.includes(idx))
    
    // Rebuild triage states with updated indices
    const newTriageStates = new Map<number, TriageState>()
    let newIndex = 0
    for (let oldIndex = 0; oldIndex < images.value.length; oldIndex++) {
      if (!rejectedIndices.includes(oldIndex)) {
        const state = triageStates.value.get(oldIndex)
        if (state) {
          newTriageStates.set(newIndex, state)
        }
        newIndex++
      }
    }
    
    // Update state
    images.value.splice(0, images.value.length, ...remainingImages)
    triageStates.value = newTriageStates
    
    // Clear selection if any selected images were deleted
    const newSelectedIndices = new Set<number>()
    const newSelectionOrder: number[] = []
    
    for (const oldIndex of selectedIndices.value) {
      if (!rejectedIndices.includes(oldIndex)) {
        // Calculate new index
        const newIdx = oldIndex - rejectedIndices.filter(ri => ri < oldIndex).length
        newSelectedIndices.add(newIdx)
        newSelectionOrder.push(newIdx)
      }
    }
    
    selectedIndices.value = newSelectedIndices
    selectionOrder.value = newSelectionOrder
    
    // Update focus index
    if (currentFocusIndex.value !== null && !rejectedIndices.includes(currentFocusIndex.value)) {
      currentFocusIndex.value = currentFocusIndex.value - rejectedIndices.filter(ri => ri < currentFocusIndex.value!).length
    } else {
      currentFocusIndex.value = null
    }
    
    // Update last selected index
    if (lastSelectedIndex.value !== null && !rejectedIndices.includes(lastSelectedIndex.value)) {
      lastSelectedIndex.value = lastSelectedIndex.value - rejectedIndices.filter(ri => ri < lastSelectedIndex.value!).length
    } else {
      lastSelectedIndex.value = null
    }
    
    // If nothing is selected after deletion, select first visible
    if (selectedIndices.value.size === 0 && filteredIndices.value.length > 0) {
      const nextIndex = filteredIndices.value[0]
      selectedIndices.value.add(nextIndex)
      selectionOrder.value.push(nextIndex)
      lastSelectedIndex.value = nextIndex
      currentFocusIndex.value = nextIndex
    }
    
    // Save updated triage states
    saveTriageStates()
    } catch (error) {
      console.error('Error deleting rejected files:', error)
      alert('Failed to delete files. Make sure you have permission.')
    }
  })
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
  
  await loadImages(files, sortOption.value)
  
  // Load saved triage states after images are loaded
  loadTriageStates()
  
  if (images.value.length > 0) {
    // Select first visible image (respecting active filters)
    const firstVisibleIndex = filteredIndices.value[0]
    if (firstVisibleIndex !== undefined) {
      selectedIndices.value.add(firstVisibleIndex)
      selectionOrder.value.push(firstVisibleIndex)
      lastSelectedIndex.value = firstVisibleIndex
      currentFocusIndex.value = firstVisibleIndex
    }
  }
}

function handleSortOptionChange(nextSortOption: string) {
  if (nextSortOption !== 'date-taken' && nextSortOption !== 'filename') {
    return
  }

  sortOption.value = nextSortOption
  applySort(nextSortOption)
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
  // Close help dialog with Escape
  if (event.key === 'Escape') {
    if (showConfirmModal.value) {
      event.preventDefault()
      handleCancel()
      return
    }
    if (showHelpModal.value) {
      event.preventDefault()
      showHelpModal.value = false
      return
    }
  }
  
  // Show help dialog with ?
  if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    showHelpModal.value = true
    return
  }
  
  // Open folder with O
  if ((event.key === 'o' || event.key === 'O') && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    toolbarRef.value?.openFolder()
    return
  }
  
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
  
  // Toggle filter for Untriaged with Ctrl+U
  if ((event.ctrlKey || event.metaKey) && (event.key === 'u' || event.key === 'U')) {
    event.preventDefault()
    toggleFilter('untriaged')
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
  
  // Toggle view mode with V
  if (event.key === 'v' || event.key === 'V') {
    event.preventDefault()
    toggleViewMode()
    return
  }
  
  // Switch to Compare view with C
  if (event.key === 'c' || event.key === 'C') {
    event.preventDefault()
    viewMode.value = 'filmstrip'
    return
  }
  
  // Switch to Grid view with G
  if (event.key === 'g' || event.key === 'G') {
    event.preventDefault()
    viewMode.value = 'grid'
    return
  }
  
  // Switch to Detail view with D
  if (event.key === 'd' || event.key === 'D') {
    event.preventDefault()
    viewMode.value = 'detail'
    detailViewIndex.value = 0
    return
  }
  
  // Delete selected images with Delete key
  if (event.key === 'Delete' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    deleteSelectedImages()
    return
  }
  
  // Delete rejected images with Ctrl+Delete
  if (event.key === 'Delete' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    deleteRejectedImages()
    return
  }
  
  // Home key - select first image
  if (event.key === 'Home') {
    event.preventDefault()
    if (filteredIndices.value.length > 0) {
      const firstIndex = filteredIndices.value[0]
      currentFocusIndex.value = firstIndex
      selectedIndices.value.clear()
      selectionOrder.value = [firstIndex]
      selectedIndices.value.add(firstIndex)
      lastSelectedIndex.value = firstIndex
      scrollToImage(firstIndex)
    }
    return
  }
  
  // End key - select last image
  if (event.key === 'End') {
    event.preventDefault()
    if (filteredIndices.value.length > 0) {
      const lastIndex = filteredIndices.value[filteredIndices.value.length - 1]
      currentFocusIndex.value = lastIndex
      selectedIndices.value.clear()
      selectionOrder.value = [lastIndex]
      selectedIndices.value.add(lastIndex)
      lastSelectedIndex.value = lastIndex
      scrollToImage(lastIndex)
    }
    return
  }
  
  // Triage keyboard shortcuts (apply to all selected, except in detail view)
  if (event.key === 'p' || event.key === 'P') {
    event.preventDefault()
    if (currentFocusIndex.value !== null) {
      const currentState = triageStates.value.get(currentFocusIndex.value) || 'untriaged'
      const newState = currentState === 'accepted' ? 'untriaged' : 'accepted'
      const applyToAll = viewMode.value !== 'detail'
      handleTriageChange(currentFocusIndex.value, newState, applyToAll)
    }
    return
  }
  
  if (event.key === 'x' || event.key === 'X') {
    event.preventDefault()
    if (currentFocusIndex.value !== null) {
      const currentState = triageStates.value.get(currentFocusIndex.value) || 'untriaged'
      const newState = currentState === 'rejected' ? 'untriaged' : 'rejected'
      const applyToAll = viewMode.value !== 'detail'
      handleTriageChange(currentFocusIndex.value, newState, applyToAll)
    }
    return
  }
  
  if (event.key === 'u' || event.key === 'U') {
    event.preventDefault()
    if (currentFocusIndex.value !== null) {
      const applyToAll = viewMode.value !== 'detail'
      handleTriageChange(currentFocusIndex.value, 'untriaged', applyToAll)
    }
    return
  }
  
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    
    // In detail view, navigate through selected images
    if (viewMode.value === 'detail') {
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      navigateDetailView(direction)
      return
    }
    
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
    if (state === 'untriaged') {
      triageStates.value.delete(idx)
    } else {
      triageStates.value.set(idx, state)
    }
  }
  
  // Handle filtering and selection updates
  for (const idx of indicesToChange) {
    const newState = triageStates.value.get(idx) || 'untriaged'
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

// Watch for view mode changes to set proper focus in detail view
watch(viewMode, (newMode) => {
  if (newMode === 'detail') {
    const selectedArray = Array.from(selectedIndices.value).sort((a, b) => a - b)
    if (selectedArray.length > 0) {
      detailViewIndex.value = 0
      currentFocusIndex.value = selectedArray[0]
    }
  }
})

watch(sortOption, (nextSortOption) => {
  localStorage.setItem('lightbox-sort', nextSortOption)
})

watch(filmstripHeight, (height) => {
  localStorage.setItem('lightbox-filmstrip-height', String(clampFilmstripHeight(height)))
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('pointermove', handleFilmstripResize)
  window.addEventListener('pointerup', stopFilmstripResize)
  window.addEventListener('pointercancel', stopFilmstripResize)
  
  // Load saved filters
  const savedFilters = localStorage.getItem('lightbox-filters')
  if (savedFilters) {
    try {
      const filtersArray = JSON.parse(savedFilters) as (TriageState | 'untriaged')[]
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

  const savedSortOption = localStorage.getItem('lightbox-sort')
  if (savedSortOption === 'date-taken' || savedSortOption === 'filename') {
    sortOption.value = savedSortOption
  }

  const savedFilmstripHeight = localStorage.getItem('lightbox-filmstrip-height')
  if (savedFilmstripHeight !== null) {
    const parsedFilmstripHeight = Number(savedFilmstripHeight)
    if (Number.isFinite(parsedFilmstripHeight)) {
      filmstripHeight.value = clampFilmstripHeight(parsedFilmstripHeight)
    }
  } else {
    filmstripHeight.value = clampFilmstripHeight(filmstripHeight.value)
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
  window.removeEventListener('pointermove', handleFilmstripResize)
  window.removeEventListener('pointerup', stopFilmstripResize)
  window.removeEventListener('pointercancel', stopFilmstripResize)
  stopFilmstripResize()
  cleanup()
})
</script>

<template>
  <div :style="{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: colors.bg, color: colors.text }">
    <Toolbar ref="toolbarRef" :colors="colors" @folder-selected="handleFolderSelected">
      <template #actions>
        <ToolbarSelect
          label="Sort"
          :model-value="sortOption"
          :options="sortOptions"
          :colors="colors"
          @update:model-value="handleSortOptionChange"
        />
        <button
          v-if="images.length > 0"
          @click="selectAll"
          :disabled="!canSelectAll"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: canSelectAll ? colors.buttonBg : colors.border,
            color: canSelectAll ? colors.text : colors.textSecondary,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: canSelectAll ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap',
            opacity: canSelectAll ? '1' : '0.5'
          }"
          @mouseover="canSelectAll && (($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg)"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = canSelectAll ? colors.buttonBg : colors.border"
          title="Select all images (Ctrl+A)"
        >
          ☐+
        </button>
        <button
          v-if="images.length > 0"
          @click="clearSelection"
          :disabled="!canClearSelection"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: canClearSelection ? colors.buttonBg : colors.border,
            color: canClearSelection ? colors.text : colors.textSecondary,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: canClearSelection ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap',
            opacity: canClearSelection ? '1' : '0.5'
          }"
          @mouseover="canClearSelection && (($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg)"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = canClearSelection ? colors.buttonBg : colors.border"
          title="Clear selection (Ctrl+D)"
        >
          ☐-
        </button>
        <button
          v-if="images.length > 0"
          @click="deleteSelectedImages"
          :disabled="!canDelete"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: canDelete ? '#dc2626' : colors.border,
            color: canDelete ? 'white' : colors.textSecondary,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: canDelete ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap',
            opacity: canDelete ? '1' : '0.5'
          }"
          @mouseover="canDelete && (($event.currentTarget as HTMLElement).style.backgroundColor = '#b91c1c')"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = canDelete ? '#dc2626' : colors.border"
          title="Delete selected images (Delete)"
        >
          🗑
        </button>
        <button
          v-if="images.length > 0"
          @click="deleteRejectedImages"
          :disabled="!canDeleteRejected"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: canDeleteRejected ? '#dc2626' : colors.border,
            color: canDeleteRejected ? 'white' : colors.textSecondary,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: canDeleteRejected ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap',
            opacity: canDeleteRejected ? '1' : '0.5'
          }"
          @mouseover="canDeleteRejected && (($event.currentTarget as HTMLElement).style.backgroundColor = '#b91c1c')"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = canDeleteRejected ? '#dc2626' : colors.border"
          title="Delete rejected images (Ctrl+Delete)"
        >
          🗑✗
        </button>
        <button
          v-if="images.length > 0"
          @click="undoTriageChange"
          :disabled="!canUndo"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: canUndo ? colors.buttonBg : colors.border,
            color: canUndo ? colors.text : colors.textSecondary,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap',
            opacity: canUndo ? '1' : '0.5'
          }"
          @mouseover="canUndo && (($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg)"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = canUndo ? colors.buttonBg : colors.border"
          title="Undo last triage (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          v-if="images.length > 0"
          @click="redoTriageChange"
          :disabled="!canRedo"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: canRedo ? colors.buttonBg : colors.border,
            color: canRedo ? colors.text : colors.textSecondary,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap',
            opacity: canRedo ? '1' : '0.5'
          }"
          @mouseover="canRedo && (($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg)"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = canRedo ? colors.buttonBg : colors.border"
          title="Redo last undo (Ctrl+Y)"
        >
          ↷
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
          @click="toggleFilter('untriaged')"
          :style="{
            padding: '0.5rem 1rem',
            backgroundColor: activeFilters.has('untriaged') ? '#6b7280' : colors.buttonBg,
            color: activeFilters.has('untriaged') ? 'white' : colors.text,
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }"
        >
          ○ Untriaged
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
        
        <!-- Spacer to push theme and help buttons to the right -->
        <div :style="{ flex: '1' }"></div>
        
        <!-- View mode button (conditional) -->
        <button
          v-if="images.length > 0"
          @click="toggleViewMode"
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
          @mouseover="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonBg"
          :title="`View: ${viewMode}`"
        >
          {{ getViewModeIcon() }}
        </button>
        
        <!-- Theme button (always visible) -->
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
          @mouseover="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonBg"
          :title="`Theme: ${theme}`"
        >
          {{ getThemeIcon() }}
        </button>
        
        <!-- Help button (always visible) -->
        <button
          @click="showHelpModal = true"
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
          @mouseover="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonBg"
          title="Keyboard shortcuts"
        >
          ?
        </button>
      </template>
    </Toolbar>
    
    <!-- Welcome Screen (when no folder loaded) -->
    <div v-if="images.length === 0" :style="{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: '2rem' }">
      <div :style="{ maxWidth: '600px', textAlign: 'center' }">
        <h1 :style="{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem', color: colors.text }">
          Lightbox
        </h1>
        <p :style="{ fontSize: '1.25rem', lineHeight: '1.8', color: colors.textSecondary, marginBottom: '2rem' }">
          A fast image comparison and triage tool. Open a folder to view and compare your images side-by-side. Everything runs locally in your browser—nothing is ever sent to the internet.
        </p>
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }">
          <div :style="{ display: 'flex', gap: '1rem', alignItems: 'center', color: colors.text }">
            <span :style="{ fontSize: '1.5rem' }">📁</span>
            <span>Browse and select multiple images</span>
          </div>
          <div :style="{ display: 'flex', gap: '1rem', alignItems: 'center', color: colors.text }">
            <span :style="{ fontSize: '1.5rem' }">🔍</span>
            <span>Compare images side-by-side with synchronized zoom</span>
          </div>
          <div :style="{ display: 'flex', gap: '1rem', alignItems: 'center', color: colors.text }">
            <span :style="{ fontSize: '1.5rem' }">✓</span>
            <span>Triage images as accepted, rejected, or untriaged</span>
          </div>
          <div :style="{ display: 'flex', gap: '1rem', alignItems: 'center', color: colors.text }">
            <span :style="{ fontSize: '1.5rem' }">⌨️</span>
            <span>Fast keyboard shortcuts for efficient workflow</span>
          </div>
        </div>
        <button
          @click="toolbarRef?.openFolder()"
          :style="{
            padding: '1rem 2rem',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.125rem',
            fontWeight: '600',
            transition: 'background-color 0.2s',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }"
          @mouseover="($event.currentTarget as HTMLElement).style.backgroundColor = '#1d4ed8'"
          @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = '#2563eb'"
        >
          Open Folder to Get Started
        </button>
        <p :style="{ marginTop: '1.5rem', fontSize: '0.875rem', color: colors.textSecondary }">
          Press <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontFamily: 'monospace' }">?</kbd> for keyboard shortcuts
        </p>
      </div>
    </div>
    
    <!-- Filmstrip + Viewer Mode -->
    <div v-else-if="viewMode === 'filmstrip'" :style="{ flex: '1 1 0', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', backgroundColor: colors.bgSecondary }">
      <Filmstrip
        :images="images"
        :selected-indices="selectedIndices"
        :current-focus-index="currentFocusIndex"
        :triage-states="triageStates"
        :filtered-indices="filteredIndices"
        :height="filmstripHeight"
        :colors="colors"
        @select="handleImageSelect"
        @triage-change="handleTriageChange"
      />
      <div
        @pointerdown="startFilmstripResize"
        :title="'Drag to resize filmstrip'"
        :style="{
          flexShrink: 0,
          height: '10px',
          cursor: 'row-resize',
          backgroundColor: isResizingFilmstrip ? colors.buttonHoverBg : colors.bgSecondary,
          borderTop: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none'
        }"
      >
        <div :style="{ width: '3rem', height: '2px', borderRadius: '999px', backgroundColor: colors.textSecondary, opacity: isResizingFilmstrip ? '1' : '0.6' }"></div>
      </div>
      <div :style="{ flex: '1 1 0', overflow: 'hidden', minHeight: 0, position: 'relative' }">
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
    </div>
    
    <!-- Grid View Mode -->
    <div v-else-if="viewMode === 'grid'" :style="{ flex: '1', overflow: 'auto', padding: '0.5rem', backgroundColor: colors.bgSecondary }">
      <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', maxWidth: '100%', justifyItems: 'center' }">
        <ImageThumbnail
          v-for="(image, index) in images"
          v-show="filteredIndices.includes(index)"
          :key="image.url"
          :image="image"
          :index="index"
          :is-selected="selectedIndices.has(index)"
          :is-focused="currentFocusIndex === index"
          :triage-state="triageStates.get(index)"
          @select="handleImageSelect"
          @triage-change="(idx, state) => handleTriageChange(idx, state, false)"
          @mouseenter="currentFocusIndex = index"
          @mouseleave="currentFocusIndex = null"
        />
      </div>
    </div>
    
    <!-- Detail View Mode -->
    <div v-else-if="viewMode === 'detail'" :style="{ flex: '1', display: 'flex', flexDirection: 'column', backgroundColor: colors.bgSecondary, position: 'relative', overflow: 'hidden', padding: '0.5rem' }">
      <div v-if="selectedIndices.size === 0" :style="{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textSecondary, fontSize: '1.125rem' }">
        No images selected. Select images to view in detail mode.
      </div>
      <div v-else :style="{ position: 'relative', width: '100%', height: '100%' }">
        <!-- Navigation buttons -->
        <button
          v-if="selectedIndices.size > 1"
          @click="navigateDetailView(-1)"
          :style="{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '1rem',
            backgroundColor: colors.buttonBg,
            color: colors.text,
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '1.5rem',
            opacity: '0.8',
            transition: 'opacity 0.2s',
            zIndex: 10,
            width: '3rem',
            height: '3rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }"
          @mouseover="($event.currentTarget as HTMLElement).style.opacity = '1'"
          @mouseout="($event.currentTarget as HTMLElement).style.opacity = '0.8'"
          title="Previous image (Left arrow)"
        >
          ‹
        </button>
        
        <button
          v-if="selectedIndices.size > 1"
          @click="navigateDetailView(1)"
          :style="{
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '1rem',
            backgroundColor: colors.buttonBg,
            color: colors.text,
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '1.5rem',
            opacity: '0.8',
            transition: 'opacity 0.2s',
            zIndex: 10,
            width: '3rem',
            height: '3rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }"
          @mouseover="($event.currentTarget as HTMLElement).style.opacity = '1'"
          @mouseout="($event.currentTarget as HTMLElement).style.opacity = '0.8'"
          title="Next image (Right arrow)"
        >
          ›
        </button>
        
        <!-- Current image with zoom/pan support -->
        <ImagePane
          v-if="currentFocusIndex !== null"
          :image-url="images[currentFocusIndex].url"
          :image-name="images[currentFocusIndex].name"
          :camera-model="images[currentFocusIndex].cameraModel"
          :image-index="currentFocusIndex"
          :sequence-number="currentFocusIndex + 1"
          :triage-state="triageStates.get(currentFocusIndex)"
          :width="0"
          :height="0"
          :x="0"
          :y="0"
          :shared-zoom="detailZoom"
          :shared-pan-x="detailPanX"
          :shared-pan-y="detailPanY"
          :is-detail-view="true"
          :colors="colors"
          @deselect="handleDetailViewDeselect"
          @triage-change="(idx, state) => handleTriageChange(idx, state, false)"
          @zoom-change="handleDetailZoomChange"
          @pan-change="handleDetailPanChange"
          @reset-zoom="resetDetailZoom"
        />
      </div>
    </div>
    
    <StatusBar
      :total-images="images.length"
      :filtered-count="filteredIndices.length"
      :selected-count="selectedIndices.size"
      :colors="colors"
    />
    
    <!-- Help Modal -->
    <div
      v-if="showHelpModal"
      @click="showHelpModal = false"
      :style="{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }"
    >
      <div
        @click.stop
        :style="{
          backgroundColor: colors.bg,
          color: colors.text,
          borderRadius: '0.5rem',
          padding: '2rem',
          width: '800px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }"
      >
        <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }">
          <h2 :style="{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }">Keyboard Shortcuts</h2>
          <button
            @click="showHelpModal = false"
            :style="{
              background: 'none',
              border: 'none',
              color: colors.text,
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0',
              width: '2rem',
              height: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }"
            title="Close"
          >
            ×
          </button>
        </div>
        
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }">
          <!-- File Operations -->
          <div>
            <h3 :style="{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#8b5cf6' }">File Operations</h3>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Open folder</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">O</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Delete selected images</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Delete</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Delete rejected images</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + Delete</kbd>
              </div>
            </div>
          </div>
          
          <!-- Navigation -->
          <div>
            <h3 :style="{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#3b82f6' }">Navigation</h3>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Navigate images</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">← →</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Expand selection</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Shift + ← →</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>First image</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Home</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Last image</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">End</kbd>
              </div>
            </div>
          </div>
          
          <!-- Selection -->
          <div>
            <h3 :style="{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#10b981' }">Selection</h3>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Select all</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + A</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Clear selection</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + D</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Toggle selection</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + Click</kbd>
              </div>
            </div>
          </div>
          
          <!-- Triage -->
          <div>
            <h3 :style="{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#f59e0b' }">Triage</h3>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Mark as accepted</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">P</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Mark as rejected</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">X</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Mark as untriaged</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">U</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Undo</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + Z</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Redo</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + Y</kbd>
              </div>
            </div>
          </div>
          
          <!-- Filters -->
          <div>
            <h3 :style="{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#a855f7' }">Filters</h3>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Toggle accepted filter</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + P</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Toggle rejected filter</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + X</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Toggle untriaged filter</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Ctrl + U</kbd>
              </div>
            </div>
          </div>
          
          <!-- View -->
          <div>
            <h3 :style="{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#ec4899' }">View</h3>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Toggle view mode</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">V</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Compare view</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">C</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Grid view</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">G</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Detail view</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">D</kbd>
              </div>
            </div>
          </div>
          
          <!-- Help -->
          <div>
            <h3 :style="{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#6b7280' }">Help</h3>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Show keyboard shortcuts</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">?</kbd>
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between' }">
                <span>Close dialog</span>
                <kbd :style="{ padding: '0.25rem 0.5rem', backgroundColor: colors.bgSecondary, borderRadius: '0.25rem', fontSize: '0.875rem' }">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Confirmation Modal -->
    <div
      v-if="showConfirmModal"
      @click="handleCancel"
      :style="{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }"
    >
      <div
        @click.stop
        :style="{
          backgroundColor: colors.bg,
          color: colors.text,
          borderRadius: '0.5rem',
          padding: '2rem',
          width: '500px',
          maxWidth: '90vw',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }"
      >
        <h2 :style="{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 'bold' }">Confirm Deletion</h2>
        <p :style="{ margin: '0 0 1.5rem 0', whiteSpace: 'pre-line', lineHeight: '1.5' }">{{ confirmModalMessage }}</p>
        
        <div :style="{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }">
          <button
            @click="handleCancel"
            :style="{
              padding: '0.5rem 1.5rem',
              backgroundColor: colors.buttonBg,
              color: colors.text,
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'background-color 0.2s'
            }"
            @mouseover="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg"
            @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonBg"
          >
            Cancel
          </button>
          <button
            @click="handleConfirm"
            :style="{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#dc2626',
              color: 'white',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }"
            @mouseover="($event.currentTarget as HTMLElement).style.backgroundColor = '#b91c1c'"
            @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = '#dc2626'"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
