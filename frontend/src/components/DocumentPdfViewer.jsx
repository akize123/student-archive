import React, { useEffect, useRef, useState } from 'react'
import { downloadDocument, fetchDocumentPreview, getDocument } from '../api'
import { DownloadIcon, MaximizeIcon, MinimizeIcon, RestoreIcon, XIcon } from './Icons'

function SecurePdfCanvas({ pdfBlob, title }) {
  const containerRef = useRef(null)
  const [pageCount, setPageCount] = useState(0)
  const [renderError, setRenderError] = useState('')
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    if (!pdfBlob) {
      return undefined
    }

    let cancelled = false
    const renderedCanvases = []

    async function renderPdf() {
      setRendering(true)
      setRenderError('')
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()

        const pdf = await pdfjsLib.getDocument({ data: await pdfBlob.arrayBuffer() }).promise
        if (cancelled || !containerRef.current) {
          return
        }

        containerRef.current.replaceChildren()
        setPageCount(pdf.numPages)

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled || !containerRef.current) {
            return
          }
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1.35 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'document-viewer-page-canvas'
          canvas.setAttribute('draggable', 'false')
          canvas.setAttribute('aria-label', `${title || 'Document'} page ${pageNumber}`)

          await page.render({ canvasContext: context, viewport }).promise
          if (cancelled || !containerRef.current) {
            return
          }

          const wrapper = document.createElement('div')
          wrapper.className = 'document-viewer-page'
          const label = document.createElement('span')
          label.className = 'document-viewer-page-label'
          label.textContent = `Page ${pageNumber}`
          wrapper.append(label, canvas)
          containerRef.current.appendChild(wrapper)
          renderedCanvases.push(canvas)
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err.message || 'Unable to render this document securely.')
        }
      } finally {
        if (!cancelled) {
          setRendering(false)
        }
      }
    }

    renderPdf()

    return () => {
      cancelled = true
      renderedCanvases.length = 0
    }
  }, [pdfBlob, title])

  return (
    <div className="document-viewer-secure-shell">
      {rendering ? <p className="document-viewer-status">Rendering secure preview…</p> : null}
      {!rendering && renderError ? <p className="document-viewer-status error">{renderError}</p> : null}
      {!rendering && !renderError && pageCount ? (
        <p className="document-viewer-page-count">{pageCount} page{pageCount === 1 ? '' : 's'}</p>
      ) : null}
      <div ref={containerRef} className="document-viewer-canvas-stack" />
    </div>
  )
}

export default function DocumentPdfViewer({
  documentId,
  title,
  sharedAccess = false,
  sharePermission = '',
  sharePermissionLabel = '',
  allowDownload,
  onClose,
  onNotify
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [pdfBlob, setPdfBlob] = useState(null)
  const [filename, setFilename] = useState('')
  const [isPdf, setIsPdf] = useState(true)
  const [canDownload, setCanDownload] = useState(sharedAccess ? allowDownload !== false : true)
  const [accessViaShare, setAccessViaShare] = useState(sharedAccess)
  const [activeSharePermissionLabel, setActiveSharePermissionLabel] = useState(sharePermissionLabel || '')
  const [shareExpiresAt, setShareExpiresAt] = useState(null)
  const [windowMode, setWindowMode] = useState('normal')

  function applyAccessFromDetail(detail) {
    if (!detail) {
      return
    }
    if (detail.accessViaShare) {
      setAccessViaShare(true)
      setCanDownload(detail.allowDownload !== false)
      setActiveSharePermissionLabel(detail.sharePermissionLabel || detail.sharePermission || sharePermissionLabel || 'Shared access')
      setShareExpiresAt(detail.shareExpiresAt || null)
      return
    }
    setAccessViaShare(false)
    setCanDownload(true)
    setActiveSharePermissionLabel('')
    setShareExpiresAt(null)
  }

  useEffect(() => {
    if (!documentId) {
      return undefined
    }

    let active = true
    let objectUrl = ''

    setLoading(true)
    setError('')
    setPreviewUrl('')
    setPdfBlob(null)
    setWindowMode('normal')
    if (sharedAccess) {
      setAccessViaShare(true)
      setCanDownload(allowDownload !== false)
      setActiveSharePermissionLabel(sharePermissionLabel || sharePermission || 'Shared access')
    } else {
      setAccessViaShare(false)
      setCanDownload(true)
      setActiveSharePermissionLabel('')
    }

    Promise.all([
      fetchDocumentPreview(documentId),
      getDocument(documentId).catch(() => null)
    ])
      .then(([{ blob, filename: resolvedName, contentType }, detail]) => {
        if (!active) {
          return
        }
        applyAccessFromDetail(detail)
        const downloadAllowed = detail?.accessViaShare
          ? detail.allowDownload !== false
          : true
        const extension = String(resolvedName || '').split('.').pop()?.toLowerCase() || ''
        const pdf = extension === 'pdf' || String(contentType || blob.type || '').includes('pdf')
        setFilename(resolvedName || 'document.pdf')
        setIsPdf(pdf)
        if (!pdf) {
          setError(downloadAllowed
            ? 'This file is not a PDF. Use Download to save it locally.'
            : 'This file is not a PDF. View-only preview is available for PDF documents.')
          return
        }
        const normalizedBlob = String(contentType || blob.type || '').includes('pdf')
          ? blob
          : new Blob([blob], { type: 'application/pdf' })
        setPdfBlob(normalizedBlob)
        if (downloadAllowed) {
          objectUrl = URL.createObjectURL(normalizedBlob)
          setPreviewUrl(objectUrl)
        } else {
          setPreviewUrl('')
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Unable to open document.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [documentId, sharedAccess, allowDownload, sharePermission, sharePermissionLabel])

  useEffect(() => {
    if (!accessViaShare || canDownload) {
      return undefined
    }

    function notifyRestricted(action) {
      onNotify?.(`${action} is restricted for view-only documents.`)
    }

    function handleKeyDown(event) {
      if (!(event.ctrlKey || event.metaKey)) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'p') {
        event.preventDefault()
        notifyRestricted('Printing')
      } else if (key === 's') {
        event.preventDefault()
        notifyRestricted('Saving')
      } else if (key === 'c') {
        event.preventDefault()
        notifyRestricted('Copying')
      }
    }

    function handleBeforePrint(event) {
      event.preventDefault()
      notifyRestricted('Printing')
    }

    function handleContextMenu(event) {
      event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('contextmenu', handleContextMenu, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('contextmenu', handleContextMenu, true)
    }
  }, [accessViaShare, canDownload, onNotify])

  async function handleDownload() {
    if (!documentId || !canDownload) {
      return
    }
    try {
      await downloadDocument(documentId)
      onNotify?.(`Downloading ${filename || 'document'}...`)
    } catch (err) {
      onNotify?.(err.message || 'Unable to download document.')
    }
  }

  const isMinimized = windowMode === 'minimized'
  const isMaximized = windowMode === 'maximized'
  const modalClassName = [
    'modal',
    'document-viewer-modal',
    accessViaShare && !canDownload ? 'document-viewer-view-only' : '',
    isMaximized ? 'document-viewer-modal-maximized' : '',
    isMinimized ? 'document-viewer-modal-minimized' : ''
  ].filter(Boolean).join(' ')

  if (isMinimized) {
    return (
      <div className="document-viewer-minimized-dock" role="dialog" aria-label={title || filename || 'Document preview'}>
        <div className="document-viewer-minimized-copy">
          <p className="eyebrow">Document preview</p>
          <strong>{title || filename || 'Document'}</strong>
          {!canDownload ? <span className="document-viewer-minimized-badge">View only</span> : null}
          {accessViaShare && canDownload ? (
            <span className="document-viewer-minimized-badge shared">{activeSharePermissionLabel || 'Shared access'}</span>
          ) : null}
        </div>
        <div className="document-viewer-actions">
          <button type="button" className="ghost-icon" onClick={() => setWindowMode('normal')} aria-label="Restore preview">
            <RestoreIcon className="icon" />
          </button>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close preview">
            <XIcon className="icon" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`modal-backdrop document-viewer-backdrop${isMaximized ? ' document-viewer-backdrop-maximized' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={modalClassName}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || filename || 'Document preview'}
      >
        <div className="document-viewer-head">
          <div>
            <p className="eyebrow">Document preview</p>
            <h2>{title || filename || 'Document'}</h2>
            {accessViaShare ? (
              <p className="document-viewer-permission-badge">
                Shared access: {activeSharePermissionLabel || 'Restricted'}
              </p>
            ) : null}
            {accessViaShare && !canDownload ? (
              <p className="document-viewer-security-note">View-only access — download, print, and copy are restricted.</p>
            ) : null}
            {accessViaShare && canDownload ? (
              <p className="document-viewer-security-note">Shared access — you can view and download this document.</p>
            ) : null}
            {shareExpiresAt ? (
              <p className="document-viewer-security-note">Shared access expires {new Date(shareExpiresAt).toLocaleString()}.</p>
            ) : null}
          </div>
          <div className="document-viewer-actions">
            {canDownload ? (
              <button type="button" className="ghost-btn" onClick={handleDownload}>
                <DownloadIcon className="icon" />
                Download
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-icon"
              onClick={() => setWindowMode('minimized')}
              aria-label="Minimize preview"
            >
              <MinimizeIcon className="icon" />
            </button>
            <button
              type="button"
              className="ghost-icon"
              onClick={() => setWindowMode(isMaximized ? 'normal' : 'maximized')}
              aria-label={isMaximized ? 'Restore preview size' : 'Maximize preview'}
            >
              {isMaximized ? <RestoreIcon className="icon" /> : <MaximizeIcon className="icon" />}
            </button>
            <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close preview">
              <XIcon className="icon" />
            </button>
          </div>
        </div>
        <div className="document-viewer-body">
          {loading ? <p className="document-viewer-status">Loading document…</p> : null}
          {!loading && error ? <p className="document-viewer-status error">{error}</p> : null}
          {!loading && !error && canDownload && previewUrl ? (
            <iframe
              className="document-viewer-frame"
              src={previewUrl}
              title={title || filename || 'Document preview'}
            />
          ) : null}
          {!loading && !error && accessViaShare && !canDownload && pdfBlob ? (
            <SecurePdfCanvas pdfBlob={pdfBlob} title={title || filename} />
          ) : null}
          {!loading && !previewUrl && !pdfBlob && !error && !isPdf ? (
            <p className="document-viewer-status">Preview is unavailable for this file type.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
