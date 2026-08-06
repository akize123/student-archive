import JSZip from 'jszip'

const zipCache = new WeakMap()

function normalizeImportPath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '')
}

function findZipEntry(zip, originalPath) {
  const normalized = normalizeImportPath(originalPath)
  const direct = zip.file(normalized)
  if (direct && !direct.dir) {
    return direct
  }
  const lower = normalized.toLowerCase()
  const match = Object.keys(zip.files).find((entryPath) => {
    const entry = zip.files[entryPath]
    return !entry.dir && normalizeImportPath(entryPath).toLowerCase() === lower
  })
  return match ? zip.files[match] : null
}

async function loadZipArchive(archiveFile) {
  if (!archiveFile) {
    return null
  }
  let cached = zipCache.get(archiveFile)
  if (!cached) {
    cached = JSZip.loadAsync(archiveFile)
    zipCache.set(archiveFile, cached)
  }
  return cached
}

function mimeFromFileName(fileName) {
  const lower = String(fileName || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}

export async function resolveImportFile(importPayload, originalPath, fileOverrides = {}) {
  const normalizedPath = normalizeImportPath(originalPath)
  const override = fileOverrides[normalizedPath] || fileOverrides[originalPath]
  if (override) {
    return override
  }

  if (!importPayload) {
    return null
  }

  const { files = [], paths = [], archive } = importPayload
  if (files.length && paths.length) {
    const index = paths.findIndex((path) => normalizeImportPath(path) === normalizedPath)
    if (index >= 0 && files[index]) {
      return files[index]
    }
  }

  if (archive) {
    const zip = await loadZipArchive(archive)
    const entry = findZipEntry(zip, normalizedPath)
    if (!entry) {
      return null
    }
    const blob = await entry.async('blob')
    const fileName = normalizedPath.split('/').pop() || 'document.pdf'
    return new File([blob], fileName, { type: mimeFromFileName(fileName) })
  }

  return null
}

export function buildImportOverridePayload(fileOverrides = {}) {
  const files = []
  const paths = []
  Object.entries(fileOverrides).forEach(([path, file]) => {
    if (!file) {
      return
    }
    files.push(file)
    paths.push(normalizeImportPath(path))
  })
  return { files, paths }
}

export function fileNameFromImportPath(originalPath) {
  const normalized = normalizeImportPath(originalPath)
  return normalized.split('/').pop() || normalized
}
