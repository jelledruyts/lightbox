export type TriageState = 'unset' | 'accepted' | 'rejected'

export interface ImageFile {
  file: File
  url: string
  name: string
  aspectRatio: number
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
