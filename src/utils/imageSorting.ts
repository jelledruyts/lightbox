import type { ImageFile, ImageSortOption } from '../types'

function compareFileNames(left: ImageFile, right: ImageFile) {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

export function sortImages(images: ImageFile[], sortOption: ImageSortOption) {
  return [...images].sort((left, right) => {
    if (sortOption === 'date-taken') {
      if (left.dateTaken !== null && right.dateTaken !== null && left.dateTaken !== right.dateTaken) {
        return left.dateTaken - right.dateTaken
      }

      if (left.dateTaken !== null && right.dateTaken === null) {
        return -1
      }

      if (left.dateTaken === null && right.dateTaken !== null) {
        return 1
      }
    }

    return compareFileNames(left, right)
  })
}
