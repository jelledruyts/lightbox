export type TriageState = 'untriaged' | 'accepted' | 'rejected'
export type ImageFilterState = TriageState | 'untriaged'

export type ViewMode = 'filmstrip' | 'grid' | 'detail'

export type ImageSortOption = 'date-taken' | 'filename'

export interface ImageFile {
  file: File
  url: string
  name: string
  aspectRatio: number
  dateTaken: number | null
  cameraModel: string | null
}

export interface ImageSelection {
  index: number
  image: ImageFile
}

export interface LayoutDimensions {
  width: number
  height: number
  x: number
  y: number
}

export interface GridLayout {
  rows: number
  cols: number
  cellWidth: number
  cellHeight: number
  positions: LayoutDimensions[]
  score: number
}

export interface ZoomPanState {
  zoom: number
  panX: number
  panY: number
}

export interface ExportedFolderStateImage {
  path: string
  triageState: TriageState
}

export interface ExportedFolderState {
  version: 1
  folderName: string | null
  exportedAt: string
  sortOption: ImageSortOption
  activeFilters: ImageFilterState[]
  selectedCameraModels?: string[]
  images: ExportedFolderStateImage[]
}
