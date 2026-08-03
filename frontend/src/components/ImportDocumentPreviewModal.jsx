import React, { useEffect, useRef, useState } from 'react'
import { XIcon } from './Icons'

function LocalPdfPreview({ pdfBlob, title }) {
  const containerRef = useRef(null)
  const [pageCount, setPageCount] = useState(0)
  const [renderError, setRenderError] = useState('')
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    if (!pdfBlob) {
      return undefined
    }

    let cancelled = false

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
          const viewport = page.getViewport({ scale: 1.25 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'document-viewer-page-canvas'

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
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err.message || 'Unable to preview this PDF.')
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
    }
  }, [pdfBlob, title])

  return (
    <div className="document-viewer-secure-shell import-preview-pdf-shell">
      {rendering ? <p className="document-viewer-status">Loading preview…</p> : null}
      {!rendering && renderError ? <p className="document-viewer-status error">{renderError}</p> : null}
      {!rendering && !renderError && pageCount ? (
        <p className="document-viewer-page-count">{pageCount} page{pageCount === 1 ? '' : 's'}</p>
      ) : null}
      <div ref={containerRef} className="document-viewer-canvas-stack" />
    </div>
  )
}

export default function ImportDocumentPreviewModal({ open, title, file, onClose }) {
  const [pdfBlob, setPdfBlob] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !file) {
      setPdfBlob(null)
      setError('')
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError('')

    async function loadPreview() {
      try {
        const blob = file instanceof Blob ? file : null
        if (!blob) {
          throw new Error('File not available for preview.')
        }
        if (!cancelled) {
          setPdfBlob(blob)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load preview.')
          setPdfBlob(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPreview()

    return () => {
      cancelled = true
    }
  }, [open, file])

  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop import-doc-preview-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal import-doc-preview-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${title || 'document'}`}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Import preview</p>
            <h2>{title || 'Document preview'}</h2>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close preview">×</button>
        </div>
        {loading ? <p className="document-viewer-status">Preparing preview…</p> : null}
        {!loading && error ? <p className="document-viewer-status error">{error}</p> : null}
        {!loading && !error && pdfBlob ? <LocalPdfPreview pdfBlob={pdfBlob} title={title} /> : null}
        <div className="modal-actions">
          <button type="button" className="primary-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
