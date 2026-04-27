import type { ExportedFolderState, ImageFile, ImageFilterState, ImageSortOption, TriageState } from '../types'

const validImageStates = new Set<TriageState>(['accepted', 'rejected', 'untriaged'])
const validSortOptions = new Set<ImageSortOption>(['date-taken', 'filename'])

export function getImageStateKey(image: ImageFile) {
  return image.file.webkitRelativePath || image.name
}

export function createFolderStateSnapshot(
  folderName: string | null,
  images: ImageFile[],
  triageStates: Map<number, TriageState>,
  sortOption: ImageSortOption,
  activeFilters: Set<ImageFilterState>,
  selectedCameraModels?: string[]
): ExportedFolderState {
  return {
    version: 1,
    folderName,
    exportedAt: new Date().toISOString(),
    sortOption,
    activeFilters: Array.from(activeFilters),
    selectedCameraModels,
    images: images.map((image, index) => ({
      path: getImageStateKey(image),
      triageState: triageStates.get(index) ?? 'untriaged'
    }))
  }
}

export function parseFolderStateSnapshot(json: string): ExportedFolderState {
  const parsed = JSON.parse(json) as unknown

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The selected file does not contain a valid Lightbox state export.')
  }

  const snapshot = parsed as Partial<ExportedFolderState>

  if (snapshot.version !== 1) {
    throw new Error('This Lightbox state export version is not supported.')
  }

  if (snapshot.folderName !== null && snapshot.folderName !== undefined && typeof snapshot.folderName !== 'string') {
    throw new Error('The exported folder name is invalid.')
  }

  if (typeof snapshot.exportedAt !== 'string') {
    throw new Error('The export timestamp is missing or invalid.')
  }

  if (!snapshot.sortOption || !validSortOptions.has(snapshot.sortOption)) {
    throw new Error('The exported sort mode is invalid.')
  }

  if (!Array.isArray(snapshot.activeFilters) || snapshot.activeFilters.some(filter => !validImageStates.has(filter))) {
    throw new Error('The exported filters are invalid.')
  }

  if (snapshot.selectedCameraModels !== undefined) {
    if (!Array.isArray(snapshot.selectedCameraModels) || snapshot.selectedCameraModels.some(model => typeof model !== 'string')) {
      throw new Error('The exported camera model filter is invalid.')
    }
  }

  if (!Array.isArray(snapshot.images)) {
    throw new Error('The exported image state list is invalid.')
  }

  for (const image of snapshot.images) {
    if (!image || typeof image !== 'object') {
      throw new Error('The exported image state list is invalid.')
    }

    if (typeof image.path !== 'string' || image.path.length === 0) {
      throw new Error('One or more exported image paths are invalid.')
    }

    if (!validImageStates.has(image.triageState)) {
      throw new Error('One or more exported image states are invalid.')
    }
  }

  return {
    version: 1,
    folderName: snapshot.folderName ?? null,
    exportedAt: snapshot.exportedAt,
    sortOption: snapshot.sortOption,
    activeFilters: [...snapshot.activeFilters],
    selectedCameraModels: snapshot.selectedCameraModels ? [...snapshot.selectedCameraModels] : undefined,
    images: snapshot.images.map(image => ({
      path: image.path,
      triageState: image.triageState
    }))
  }
}
