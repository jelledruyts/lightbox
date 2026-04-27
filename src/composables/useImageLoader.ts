import { ref } from 'vue'
import type { ImageFile, ImageSortOption } from '../types'
import { extractImageMetadata } from '../utils/imageMetadata'
import { sortImages } from '../utils/imageSorting'

export function useImageLoader() {
  const images = ref<ImageFile[]>([])
  const isLoading = ref(false)

  async function loadImages(files: File[], sortOption: ImageSortOption) {
    isLoading.value = true
    const loadedImages: ImageFile[] = []

    for (const file of files) {
      try {
        const url = URL.createObjectURL(file)
        const [aspectRatio, metadata] = await Promise.all([
          getImageAspectRatio(url),
          extractImageMetadata(file)
        ])
        
        loadedImages.push({
          file,
          url,
          name: file.name,
          aspectRatio,
          dateTaken: metadata.dateTaken,
          cameraModel: metadata.cameraModel
        })
      } catch (error) {
        console.error(`Failed to load image ${file.name}:`, error)
      }
    }

    images.value = sortImages(loadedImages, sortOption)
    isLoading.value = false
  }

  function getImageAspectRatio(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve(img.width / img.height)
      }
      img.onerror = reject
      img.src = url
    })
  }

  function cleanup() {
    images.value.forEach(img => URL.revokeObjectURL(img.url))
    images.value = []
  }

  return {
    images,
    isLoading,
    loadImages,
    cleanup
  }
}
