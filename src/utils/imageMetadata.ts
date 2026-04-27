export interface ImageMetadata {
  dateTaken: number | null
  cameraModel: string | null
}

function readAscii(view: DataView, offset: number, length: number) {
  if (offset < 0 || offset + length > view.byteLength) {
    return null
  }

  let value = ''
  for (let index = 0; index < length; index++) {
    value += String.fromCharCode(view.getUint8(offset + index))
  }

  return value
}

function findIfdEntry(view: DataView, ifdOffset: number, littleEndian: boolean, tagId: number) {
  if (ifdOffset < 0 || ifdOffset + 2 > view.byteLength) {
    return null
  }

  const entryCount = view.getUint16(ifdOffset, littleEndian)

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
    const entryOffset = ifdOffset + 2 + entryIndex * 12
    if (entryOffset + 12 > view.byteLength) {
      return null
    }

    if (view.getUint16(entryOffset, littleEndian) === tagId) {
      return {
        type: view.getUint16(entryOffset + 2, littleEndian),
        count: view.getUint32(entryOffset + 4, littleEndian),
        valueOffset: entryOffset + 8
      }
    }
  }

  return null
}

function getLongTagValue(view: DataView, ifdOffset: number, tiffOffset: number, littleEndian: boolean, tagId: number) {
  const entry = findIfdEntry(view, ifdOffset, littleEndian, tagId)
  if (!entry || entry.type !== 4 || entry.count < 1 || entry.valueOffset + 4 > view.byteLength) {
    return null
  }

  const value = view.getUint32(entry.valueOffset, littleEndian)
  const absoluteOffset = tiffOffset + value
  return absoluteOffset >= 0 && absoluteOffset < view.byteLength ? value : null
}

function getAsciiTagValue(view: DataView, ifdOffset: number, tiffOffset: number, littleEndian: boolean, tagId: number) {
  const entry = findIfdEntry(view, ifdOffset, littleEndian, tagId)
  if (!entry || entry.type !== 2 || entry.count === 0) {
    return null
  }

  const valueDataOffset = entry.count <= 4
    ? entry.valueOffset
    : tiffOffset + view.getUint32(entry.valueOffset, littleEndian)

  const value = readAscii(view, valueDataOffset, entry.count)
  return value?.replace(/\0.*$/, '') ?? null
}

function parseExifDate(value: string | null) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute, second] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime()
}

function normalizeExifText(value: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function extractExifMetadata(buffer: ArrayBuffer): ImageMetadata {
  const view = new DataView(buffer)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return {
      dateTaken: null,
      cameraModel: null
    }
  }

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    offset += 2

    if (marker === 0xffda || marker === 0xffd9) {
      break
    }

    const segmentLength = view.getUint16(offset)
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) {
      break
    }

    if (marker === 0xffe1 && segmentLength >= 8) {
      const exifHeader = readAscii(view, offset + 2, 6)
      if (exifHeader === 'Exif\0\0') {
        const tiffOffset = offset + 8
        if (tiffOffset + 8 > view.byteLength) {
          return {
            dateTaken: null,
            cameraModel: null
          }
        }

        const byteOrderMarker = view.getUint16(tiffOffset)
        const littleEndian = byteOrderMarker === 0x4949
        if (!littleEndian && byteOrderMarker !== 0x4d4d) {
          return {
            dateTaken: null,
            cameraModel: null
          }
        }

        if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x002a) {
          return {
            dateTaken: null,
            cameraModel: null
          }
        }

        const ifd0Offset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian)
        const cameraModel = normalizeExifText(getAsciiTagValue(view, ifd0Offset, tiffOffset, littleEndian, 0x0110))
        const exifIfdPointer = getLongTagValue(view, ifd0Offset, tiffOffset, littleEndian, 0x8769)
        let dateTaken: number | null = null

        if (exifIfdPointer !== null) {
          const exifIfdOffset = tiffOffset + exifIfdPointer
          dateTaken = parseExifDate(getAsciiTagValue(view, exifIfdOffset, tiffOffset, littleEndian, 0x9003))
        }

        if (dateTaken === null) {
          dateTaken = parseExifDate(getAsciiTagValue(view, ifd0Offset, tiffOffset, littleEndian, 0x0132))
        }

        return {
          dateTaken,
          cameraModel
        }
      }
    }

    offset += segmentLength
  }

  return {
    dateTaken: null,
    cameraModel: null
  }
}

export async function extractImageMetadata(file: File): Promise<ImageMetadata> {
  if (file.type !== 'image/jpeg') {
    return {
      dateTaken: null,
      cameraModel: null
    }
  }

  try {
    const buffer = await file.arrayBuffer()
    return extractExifMetadata(buffer)
  } catch (error) {
    console.error(`Failed to read metadata for ${file.name}:`, error)
    return {
      dateTaken: null,
      cameraModel: null
    }
  }
}
