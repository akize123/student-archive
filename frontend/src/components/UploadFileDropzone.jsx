import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { scanDocument } from '../api'
import { countPdfPages } from '../documentScan'
import { validatePdfFile } from '../fileSignatures'
import { CheckIcon, UploadIcon, XIcon } from './Icons'

const SCAN_CONCURRENCY = 3
const DEFAULT_MAX_FILES = 20

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
}

function createQueueItem(file) {
  return {
    id: crypto.randomUUID(),
    file,
    status: 'pending',
    scanResult: null,
    scanError: '',
    pageCount: null,
    uploadError: ''
  }
}

function isMalwareRejection(item) {
  const result = item?.scanResult
  if (result) {
    if (result.malwareScanPassed === false || result.scanMethod === 'MALWARE') {
      return true
    }
    if (result.malwareScanPassed === true || (result.scanMethod && result.scanMethod !== 'MALWARE')) {
      return false
    }
  }
  return Boolean(item?.scanError?.toLowerCase().includes('malware scan'))
}

function resolveMalwareScanState(item) {
  if (item.status === 'pending' || item.status === 'scanning') {
    return 'pending'
  }

  const result = item.scanResult
  if (!result) {
    return null
  }

  if (result.malwareScanPassed === false || result.scanMethod === 'MALWARE') {
    return 'failed'
  }

  if (result.malwareScanPassed === true) {
    return 'passed'
  }

  if (result.scanMethod && result.scanMethod !== 'MALWARE') {
    return 'passed'
  }

  return null
}

function statusLabel(item) {
  const status = typeof item === 'string' ? item : item.status
  switch (status) {
    case 'pending':
      return 'Queued'
    case 'scanning':
      return 'Security scan…'
    case 'verified':
      return 'Verified'
    case 'rejected':
      return isMalwareRejection(item) ? 'Security scan failed' : 'Not accepted'
    case 'uploading':
      return 'Uploading…'
    case 'uploaded':
      return 'Uploaded'
    case 'failed':
      return 'Upload failed'
    default:
      return status
  }
}

async function runWithConcurrency(items, worker, limit = SCAN_CONCURRENCY) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift()
      if (next) {
        await worker(next)
      }
    }
  })
  await Promise.all(runners)
}

export default function UploadFileDropzone({
  queue,
  onQueueChange,
  scanContext,
  maxFileSizeBytes = 10 * 1024 * 1024,
  maxFiles = DEFAULT_MAX_FILES,
  disabled = false,
  disabledReason = '',
  onNotify
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewId, setPreviewId] = useState(null)
  const previewUrlsRef = useRef(new Map())
  const scanningRef = useRef(false)
  const prevScanContextKeyRef = useRef(null)
  const scanContextKey = useMemo(
    () => JSON.stringify(scanContext || {}),
    [
      scanContext?.studentNumber,
      scanContext?.studentName,
      scanContext?.category,
      scanContext?.course,
      scanContext?.faculty,
      scanContext?.department
    ]
  )

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
    }
  }, [])

  const updateItem = useCallback((itemId, patch) => {
    onQueueChange((current) => current.map((item) => (
      item.id === itemId ? { ...item, ...patch } : item
    )))
  }, [onQueueChange])

  const scanItem = useCallback(async (item) => {
    const context = JSON.parse(scanContextKey || '{}')
    updateItem(item.id, { status: 'scanning', scanError: '', scanResult: null })
    try {
      const result = await scanDocument(item.file, {
        ...context,
        fileName: item.file.name
      })
      const pageCount = result.pageCount || (await countPdfPages(item.file)) || 1
      updateItem(item.id, {
        status: result.verified ? 'verified' : 'rejected',
        scanResult: result,
        scanError: result.verified ? '' : (result.summary || 'Document not accepted'),
        pageCount
      })
    } catch (err) {
      updateItem(item.id, {
        status: 'rejected',
        scanResult: null,
        scanError: err.message || 'Unable to scan this document.'
      })
    }
  }, [scanContextKey, updateItem])

  useEffect(() => {
    const pending = queue.filter((item) => item.status === 'pending')
    if (!pending.length || scanningRef.current) {
      return undefined
    }

    let active = true
    scanningRef.current = true

    runWithConcurrency(pending, async (item) => {
      if (!active) {
        return
      }
      await scanItem(item)
    }).finally(() => {
      scanningRef.current = false
    })

    return () => {
      active = false
    }
  }, [queue, scanItem])

  useEffect(() => {
    if (prevScanContextKeyRef.current === null) {
      prevScanContextKeyRef.current = scanContextKey
      return
    }
    if (prevScanContextKeyRef.current === scanContextKey) {
      return
    }
    prevScanContextKeyRef.current = scanContextKey
    onQueueChange((current) => current.map((item) => (
      item.status === 'verified' || item.status === 'rejected'
        ? { ...item, status: 'pending', scanResult: null, scanError: '', uploadError: '' }
        : item
    )))
  }, [scanContextKey, onQueueChange])

  async function addFiles(fileList) {
    if (disabled) {
      onNotify?.(disabledReason || 'Enter a student ID before adding files.')
      return
    }

    const incoming = Array.from(fileList || [])
    if (!incoming.length) {
      return
    }

    const availableSlots = Math.max(0, maxFiles - queue.length)
    if (!availableSlots) {
      onNotify?.(`You can add up to ${maxFiles} PDFs per batch.`)
      return
    }

    const accepted = []
    for (const file of incoming.slice(0, availableSlots)) {
      const validation = await validatePdfFile(file)
      if (!validation.ok) {
        onNotify?.(validation.message)
        continue
      }
      if (Number(file.size || 0) > maxFileSizeBytes) {
        onNotify?.(`${file.name} exceeds the ${formatBytes(maxFileSizeBytes)} upload limit.`)
        continue
      }
      accepted.push(createQueueItem(file))
    }

    if (incoming.length > availableSlots) {
      onNotify?.(`Only ${availableSlots} more file${availableSlots === 1 ? '' : 's'} can be added to this batch.`)
    }

    if (!accepted.length) {
      return
    }

    onQueueChange((current) => [...current, ...accepted].slice(0, maxFiles))
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
    if (!disabled) {
      setDragOver(true)
    }
  }

  function handleDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
  }

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    if (disabled) {
      onNotify?.(disabledReason || 'Enter a student ID before adding files.')
      return
    }
    addFiles(event.dataTransfer?.files)
  }

  function removeItem(itemId) {
    if (previewId === itemId) {
      setPreviewId(null)
    }
    const existingUrl = previewUrlsRef.current.get(itemId)
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl)
      previewUrlsRef.current.delete(itemId)
    }
    onQueueChange((current) => current.filter((item) => item.id !== itemId))
  }

  function togglePreview(item) {
    if (previewId === item.id) {
      setPreviewId(null)
      return
    }
    if (!previewUrlsRef.current.has(item.id)) {
      previewUrlsRef.current.set(item.id, URL.createObjectURL(item.file))
    }
    setPreviewId(item.id)
  }

  const verifiedCount = queue.filter((item) => item.status === 'verified').length
  const scanningCount = queue.filter((item) => item.status === 'pending' || item.status === 'scanning').length

  return (
    <div className="upload-file-section full-width">
      <span className="upload-file-label">Files</span>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="upload-file-input-hidden"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <div
        className={`upload-dropzone ${dragOver ? 'is-dragover' : ''} ${disabled ? 'is-disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.click()
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <UploadIcon className="icon" />
        <strong>Drag PDFs here or click to browse</strong>
        <span>Up to {maxFiles} PDFs · max {formatBytes(maxFileSizeBytes)} each</span>
        <span className="upload-dropzone-security-note">Every file is scanned for malware before upload.</span>
        {disabled && disabledReason ? <em>{disabledReason}</em> : null}
      </div>

      {queue.length ? (
        <div className="upload-queue-summary">
          <span>{queue.length} file{queue.length === 1 ? '' : 's'} selected</span>
          <span>{verifiedCount} verified{scanningCount ? ` · ${scanningCount} security check${scanningCount === 1 ? '' : 's'} pending` : ''}</span>
        </div>
      ) : null}

      {queue.length ? (
        <ul className="upload-queue">
          {queue.map((item) => {
            const malwareState = resolveMalwareScanState(item)
            const malwareRejected = malwareState === 'failed'

            return (
              <li key={item.id} className={`upload-queue-item status-${item.status}${malwareRejected ? ' security-failed' : ''}`}>
              <div className="upload-queue-item-copy">
                <strong>{item.file.name}</strong>
                <span>
                  {formatBytes(item.file.size)}
                  {item.pageCount ? ` · ${item.pageCount} page${item.pageCount === 1 ? '' : 's'}` : ''}
                </span>
                {malwareState === 'pending' ? (
                  <span className="upload-security-badge scanning">Security scan…</span>
                ) : null}
                {malwareState === 'passed' ? (
                  <span className="upload-security-badge passed">Security scan passed</span>
                ) : null}
                {malwareState === 'failed' ? (
                  <span className="upload-security-badge failed">Security scan failed</span>
                ) : null}
                {item.scanError ? <em className="upload-queue-error">{item.scanError}</em> : null}
                {item.uploadError ? <em className="upload-queue-error">{item.uploadError}</em> : null}
                {item.scanResult?.summary && item.status === 'verified' ? (
                  <em className="upload-queue-note">{item.scanResult.summary}</em>
                ) : null}
                {item.scanResult?.summary && item.status === 'rejected' && malwareState === 'passed' ? (
                  <em className="upload-queue-note">{item.scanResult.summary}</em>
                ) : null}
              </div>
              <div className="upload-queue-item-actions">
                <span className={`upload-queue-status status-${item.status}`}>
                  {item.status === 'verified' ? <CheckIcon className="icon tiny" /> : null}
                  {item.status === 'rejected' || item.status === 'failed' ? <XIcon className="icon tiny" /> : null}
                  {statusLabel(item)}
                </span>
                <button
                  type="button"
                  className="ghost-btn tiny-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    togglePreview(item)
                  }}
                >
                  {previewId === item.id ? 'Hide preview' : 'Preview'}
                </button>
                <button
                  type="button"
                  className="ghost-btn tiny-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeItem(item.id)
                  }}
                  disabled={item.status === 'uploading'}
                >
                  Remove
                </button>
              </div>
              {previewId === item.id && previewUrlsRef.current.has(item.id) ? (
                <iframe
                  className="upload-file-preview"
                  src={previewUrlsRef.current.get(item.id)}
                  title={`Preview ${item.file.name}`}
                />
              ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
