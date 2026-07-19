import { useEffect, useState } from 'react'

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
        reject(new Error('Unable to encode image.'))
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

function concatUint8Arrays(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    output.set(chunk, offset)
    offset += chunk.length
  })
  return output
}

function toBytes(text) {
  return new TextEncoder().encode(text)
}

function buildPdfFromJpegPages(pages) {
  const chunks = []
  const objectOffsets = []
  const pageObjectIds = []
  let objectId = 1

  function pushText(text) {
    objectOffsets[objectId] = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    chunks.push(toBytes(text))
    objectId += 1
  }

  function pushBinary(bytes) {
    chunks.push(bytes)
  }

  chunks.push(toBytes('%PDF-1.4\n'))
  objectOffsets[0] = 0

  const catalogId = 1
  pushText(`${catalogId} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)

  const pagesId = 2
  const pagesPlaceholderIndex = chunks.length
  pushText(`${pagesId} 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n`)

  pages.forEach((page) => {
    const imageId = objectId
    pushText(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`)
    pushBinary(page.bytes)
    pushText('\nendstream\nendobj\n')

    const contentId = objectId
    const content = `q ${page.width} 0 0 ${page.height} 0 0 cm /Im${imageId} Do Q`
    pushText(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)

    const pageId = objectId
    pageObjectIds.push(pageId)
    pushText(`${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im${imageId} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`)
  })

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ')
  const pagesObject = `${pagesId} 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>\nendobj\n`
  chunks[pagesPlaceholderIndex] = toBytes(pagesObject)

  const bodyLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const xrefStart = bodyLength
  let xref = `xref\n0 ${objectId}\n0000000000 65535 f \n`
  for (let index = 1; index < objectId; index += 1) {
    xref += `${String(objectOffsets[index] || 0).padStart(10, '0')} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${objectId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  chunks.push(toBytes(xref))
  chunks.push(toBytes(trailer))
  return new Blob([concatUint8Arrays(chunks)], { type: 'application/pdf' })
}

export async function jpegBlobToPdfPage(blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const jpegBlob = await canvasToJpegBlob(canvas)
  const bytes = new Uint8Array(await jpegBlob.arrayBuffer())
  return {
    width: canvas.width,
    height: canvas.height,
    bytes
  }
}

export async function buildPdfBlobFromJpegBlobs(jpegBlobs) {
  const pages = []
  for (const blob of jpegBlobs) {
    pages.push(await jpegBlobToPdfPage(blob))
  }
  return buildPdfFromJpegPages(pages)
}

export async function buildSeparatePdfBlobsFromJpegBlobs(jpegBlobs) {
  const files = []
  for (let index = 0; index < jpegBlobs.length; index += 1) {
    const page = await jpegBlobToPdfPage(jpegBlobs[index])
    const blob = buildPdfFromJpegPages([page])
    files.push(new File([blob], `scan-page-${index + 1}.pdf`, { type: 'application/pdf' }))
  }
  return files
}

export function rotateCanvas(sourceCanvas, degrees = 90) {
  const normalized = ((degrees % 360) + 360) % 360
  if (normalized === 0) {
    return sourceCanvas
  }
  const output = document.createElement('canvas')
  const context = output.getContext('2d')
  if (normalized === 90 || normalized === 270) {
    output.width = sourceCanvas.height
    output.height = sourceCanvas.width
  } else {
    output.width = sourceCanvas.width
    output.height = sourceCanvas.height
  }
  context.translate(output.width / 2, output.height / 2)
  context.rotate((normalized * Math.PI) / 180)
  context.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2)
  return output
}

export function cropCanvas(sourceCanvas, cropRect) {
  const { x, y, width, height } = cropRect
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  context.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height)
  return output
}

let tesseractWorkerPromise = null

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = import('tesseract.js').then(({ createWorker }) => createWorker('eng'))
  }
  return tesseractWorkerPromise
}

export function useFrontendOcrPlaceholder(file, enabled = true) {
  const [state, setState] = useState({
    status: enabled && file ? 'loading' : 'idle',
    preview: '',
    matchedKeywords: []
  })

  useEffect(() => {
    if (!enabled || !file) {
      setState({ status: 'idle', preview: '', matchedKeywords: [] })
      return undefined
    }

    let active = true
    setState({ status: 'loading', preview: 'Running client OCR preview…', matchedKeywords: [] })

    async function runOcr() {
      try {
        const worker = await getTesseractWorker()
        const { data } = await worker.recognize(file)
        const text = String(data?.text || '').replace(/\s+/g, ' ').trim()
        const keywords = ['AUCA', 'Adventist', 'University', 'Registration', 'Student']
          .filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))
        if (active) {
          setState({
            status: 'ready',
            preview: text.slice(0, 280) || 'No readable text detected in the client scan.',
            matchedKeywords: keywords
          })
        }
      } catch {
        if (active) {
          setState({
            status: 'error',
            preview: 'Client OCR preview is unavailable in this browser.',
            matchedKeywords: []
          })
        }
      }
    }

    runOcr()
    return () => {
      active = false
    }
  }, [file, enabled])

  return state
}
