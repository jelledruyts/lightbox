import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ImageFile, GridLayout } from '../types'
import { calculateSmartLayout } from '../utils/layoutAlgorithm'

export function useSmartLayout(
  selectedImages: () => ImageFile[]
) {
  const viewportWidth = ref(0)
  const viewportHeight = ref(0)
  const viewerElement = ref<HTMLElement>()

  const layout = computed<GridLayout>(() => {
    return calculateSmartLayout(
      selectedImages(),
      viewportWidth.value,
      viewportHeight.value
    )
  })

  function updateDimensions() {
    if (viewerElement.value) {
      const rect = viewerElement.value.getBoundingClientRect()
      const newWidth = rect.width
      const newHeight = rect.height
      
      // Only update if we have valid, reasonable dimensions
      if (newWidth > 0 && newHeight > 0 && newWidth < 10000 && newHeight < 10000) {
        viewportWidth.value = newWidth
        viewportHeight.value = newHeight
      }
    }
  }

  let resizeTimeout: number
  function debouncedResize() {
    clearTimeout(resizeTimeout)
    resizeTimeout = window.setTimeout(updateDimensions, 150)
  }

  function setViewerElement(element: HTMLElement) {
    viewerElement.value = element
    setTimeout(updateDimensions, 50)
  }

  onMounted(() => {
    window.addEventListener('resize', debouncedResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', debouncedResize)
    clearTimeout(resizeTimeout)
  })

  return {
    layout,
    viewportWidth,
    viewportHeight,
    setViewerElement
  }
}
