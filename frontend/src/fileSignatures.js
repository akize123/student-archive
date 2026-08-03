async function readFileHeader(file, length = 16) {
  if (!file) {
    return new Uint8Array()
  }
  const buffer = await file.slice(0, length).arrayBuffer()
  return new Uint8Array(buffer)
}

function startsWith(bytes, signature) {
  if (!bytes || bytes.length < signature.length) {
    return false
  }
  return signature.every((value, index) => bytes[index] === value)
}

export function isPdfBytes(bytes) {
  return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
}

export function isZipBytes(bytes) {
  if (!bytes || bytes.length < 4) {
    return false
  }
  return bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
    && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
}

export function isImageBytes(bytes) {
  const isJpeg = bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  const isPng = startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const isWebp = bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  return isJpeg || isPng || isWebp
}

export async function validatePdfFile(file) {
  const bytes = await readFileHeader(file, 8)
  if (!isPdfBytes(bytes)) {
    return { ok: false, message: 'Selected file is not a valid PDF.' }
  }
  return { ok: true }
}

export async function validateZipFile(file) {
  const bytes = await readFileHeader(file, 8)
  if (!isZipBytes(bytes)) {
    return { ok: false, message: 'Selected file is not a valid ZIP archive.' }
  }
  return { ok: true }
}

export async function validateImageFile(file) {
  const bytes = await readFileHeader(file, 16)
  if (!isImageBytes(bytes)) {
    return { ok: false, message: 'Selected file is not a valid JPG, PNG, or WEBP image.' }
  }
  return { ok: true }
}

export async function validateReplacementFile(file) {
  const bytes = await readFileHeader(file, 8)
  if (isPdfBytes(bytes) || isZipBytes(bytes)) {
    return { ok: true }
  }
  return { ok: false, message: 'Replacement file must be a PDF or ZIP archive.' }
}
