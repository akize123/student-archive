/**
 * Lightweight document edge detection and enhancement for phone scans.
 * Finds non-white bounds and boosts contrast before upload.
 */
function toGrayscale(imageData) {
  const { data } = imageData
  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114)
    data[index] = gray
    data[index + 1] = gray
    data[index + 2] = gray
  }
  return imageData
}

function findDocumentBounds(imageData, width, height) {
  const { data } = imageData
  let top = height
  let left = width
  let bottom = 0
  let right = 0
  let hits = 0

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4
      const value = data[index]
      if (value < 235) {
        hits += 1
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }

  if (hits < 40) {
    return { x: 0, y: 0, width, height }
  }

  const pad = Math.round(Math.min(width, height) * 0.02)
  return {
    x: Math.max(0, left - pad),
    y: Math.max(0, top - pad),
    width: Math.min(width - left, right - left + pad * 2),
    height: Math.min(height - top, bottom - top + pad * 2)
  }
}

export function enhanceDocumentImage(sourceCanvas) {
  const context = sourceCanvas.getContext('2d', { willReadFrequently: true })
  const width = sourceCanvas.width
  const height = sourceCanvas.height
  const imageData = toGrayscale(context.getImageData(0, 0, width, height))
  const bounds = findDocumentBounds(imageData, width, height)

  const output = document.createElement('canvas')
  output.width = bounds.width
  output.height = bounds.height
  const outputContext = output.getContext('2d')
  outputContext.drawImage(
    sourceCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  )

  const enhanced = outputContext.getImageData(0, 0, bounds.width, bounds.height)
  const { data } = enhanced
  for (let index = 0; index < data.length; index += 4) {
    let value = data[index]
    value = ((value - 128) * 1.35) + 128
    value = Math.max(0, Math.min(255, value))
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
  }
  outputContext.putImageData(enhanced, 0, 0)
  return output
}

export async function canvasToJpegBlob(canvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to process scanned image.'))
        return
      }
      resolve(blob)
    }, 'image/jpeg', quality)
  })
}

export async function countPdfPages(file) {
  if (!file || file.type !== 'application/pdf') {
    return null
  }
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const text = new TextDecoder('latin1').decode(bytes)
  const matches = text.match(/\/Type\s*\/Page\b/g)
  return matches ? matches.length : null
}
