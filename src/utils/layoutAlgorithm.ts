import type { ImageFile, GridLayout, LayoutDimensions } from '../types'

export function calculateSmartLayout(
  images: ImageFile[],
  viewportWidth: number,
  viewportHeight: number,
  gap: number = 8,
  padding: number = 16,
  bottomPadding: number = 32
): GridLayout {
  const count = images.length

  if (count === 0) {
    return {
      rows: 0,
      cols: 0,
      cellWidth: 0,
      cellHeight: 0,
      positions: [],
      score: 0
    }
  }

  // Apply padding to viewport
  const availableWidth = viewportWidth - (padding * 2)
  const availableHeight = viewportHeight - padding - bottomPadding

  if (count === 1) {
    const image = images[0]
    const { width, height } = fitImageToViewport(
      image.aspectRatio,
      availableWidth,
      availableHeight
    )
    return {
      rows: 1,
      cols: 1,
      cellWidth: width,
      cellHeight: height,
      positions: [{ 
        width, 
        height, 
        x: (viewportWidth - width) / 2, 
        y: (viewportHeight - bottomPadding - height) / 2 
      }],
      score: (width * height) / (viewportWidth * viewportHeight)
    }
  }

  const layouts: GridLayout[] = []
  const maxCols = Math.min(count, 4)
  
  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols)
    const layout = calculateGridLayout(images, rows, cols, availableWidth, availableHeight, gap, padding, viewportWidth, viewportHeight)
    layouts.push(layout)
  }

  layouts.sort((a, b) => b.score - a.score)
  return layouts[0]
}

function calculateGridLayout(
  images: ImageFile[],
  rows: number,
  cols: number,
  availableWidth: number,
  availableHeight: number,
  gap: number,
  padding: number,
  viewportWidth: number,
  viewportHeight: number
): GridLayout {
  const totalGapX = (cols - 1) * gap
  const totalGapY = (rows - 1) * gap
  const usableWidth = availableWidth - totalGapX
  const usableHeight = availableHeight - totalGapY
  
  const cellWidth = usableWidth / cols
  const cellHeight = usableHeight / rows

  const positions: LayoutDimensions[] = []
  let totalUsedArea = 0

  images.forEach((image, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols

    const { width, height } = fitImageToCell(
      image.aspectRatio,
      cellWidth,
      cellHeight
    )

    const x = padding + col * (cellWidth + gap) + (cellWidth - width) / 2
    const y = padding + row * (cellHeight + gap) + (cellHeight - height) / 2

    positions.push({ width, height, x, y })
    totalUsedArea += width * height
  })

  const score = totalUsedArea / (viewportWidth * viewportHeight)

  return {
    rows,
    cols,
    cellWidth,
    cellHeight,
    positions,
    score
  }
}

function fitImageToViewport(
  aspectRatio: number,
  viewportWidth: number,
  viewportHeight: number
): { width: number; height: number } {
  const viewportAspectRatio = viewportWidth / viewportHeight

  if (aspectRatio > viewportAspectRatio) {
    return {
      width: viewportWidth,
      height: viewportWidth / aspectRatio
    }
  } else {
    return {
      width: viewportHeight * aspectRatio,
      height: viewportHeight
    }
  }
}

function fitImageToCell(
  aspectRatio: number,
  cellWidth: number,
  cellHeight: number
): { width: number; height: number } {
  const cellAspectRatio = cellWidth / cellHeight

  if (aspectRatio > cellAspectRatio) {
    return {
      width: cellWidth,
      height: cellWidth / aspectRatio
    }
  } else {
    return {
      width: cellHeight * aspectRatio,
      height: cellHeight
    }
  }
}
