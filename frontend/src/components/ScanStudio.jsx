import React, { useEffect, useMemo, useRef, useState } from 'react'
import { scanDocument } from '../api'
import {
  buildPdfBlobFromJpegBlobs,
  buildSeparatePdfBlobsFromJpegBlobs,
  canvasToJpegBlob,
  countPdfPages,
  cropCanvas,
  enhanceDocumentImage,
  rotateCanvas,
  useFrontendOcrPlaceholder
} from '../documentScan'
import DocumentTypePicker from './DocumentTypePicker'

function createPageFromCanvas(canvas, label) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    canvas,
    label,
    rotation: 0
  }
}

async function loadImageToCanvas(file) {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Unable to load image.'))
      element.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return enhanceDocumentImage(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function ScanStudio({
  file,
  pageCount = 0,
  category,
  office,
  faculty,
  department,
  documentTypeId,
  onDocumentTypeChange,
  studentNumber,
  studentName,
  onConfirm,
  onCancel,
  onNotify
}) {
  const [pages, setPages] = useState([])
  const [activePageId, setActivePageId] = useState(null)
  const [outputMode, setOutputMode] = useState('single')
  const [title, setTitle] = useState(file?.name?.replace(/\.pdf$/i, '') || 'Scanned document')
  const [busy, setBusy] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [cropMode, setCropMode] = useState(false)
  const [cropStart, setCropStart] = useState(null)
  const [cropRect, setCropRect] = useState(null)
  const previewRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [previewFile, setPreviewFile] = useState(file || null)
  const frontendOcr = useFrontendOcrPlaceholder(previewFile, true)

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) || pages[0] || null,
    [pages, activePageId]
  )

  useEffect(() => {
    let active = true
    async function bootstrap() {
      if (!file) {
        setPages([])
        setPreviewFile(null)
        return
      }
      if (file.type.startsWith('image/')) {
        const canvas = await loadImageToCanvas(file)
        if (!active) return
        const page = createPageFromCanvas(canvas, file.name)
        setPages([page])
        setActivePageId(page.id)
        setPreviewFile(file)
        return
      }
      const pagesDetected = await countPdfPages(file)
      if (!active) return
      setPages([])
      setPreviewFile(file)
      if (pagesDetected) {
        onNotify?.(`Loaded PDF with ${pagesDetected} page${pagesDetected === 1 ? '' : 's'}. Add gallery images to edit individual pages.`)
      }
    }
    bootstrap().catch((err) => onNotify?.(err.message || 'Unable to load scan file.'))
    return () => {
      active = false
    }
  }, [file, onNotify])

  useEffect(() => {
    let active = true
    async function validate() {
      if (!previewFile) {
        setScanResult(null)
        return
      }
      setScanBusy(true)
      setScanError('')
      setScanResult(null)
      const context = {
        studentNumber: String(studentNumber || '').trim(),
        studentName: String(studentName || '').trim(),
        category,
        faculty: String(faculty || '').trim(),
        department: String(department || '').trim(),
        office: String(office || '').trim(),
        fileName: previewFile.name,
        documentSubtypeId: documentTypeId || null
      }
      try {
        const result = await scanDocument(previewFile, context)
        if (active) setScanResult(result)
      } catch (err) {
        if (active) setScanError(err.message || 'Unable to validate scanned document.')
      } finally {
        if (active) setScanBusy(false)
      }
    }
    validate()
    return () => {
      active = false
    }
  }, [previewFile, category, office, faculty, department, documentTypeId, studentNumber, studentName])

  useEffect(() => {
    if (!activePage || !previewRef.current) {
      return
    }
    const canvas = previewRef.current
    const context = canvas.getContext('2d')
    canvas.width = activePage.canvas.width
    canvas.height = activePage.canvas.height
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(activePage.canvas, 0, 0)
    if (cropRect) {
      context.strokeStyle = '#0078d4'
      context.lineWidth = 2
      context.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
    }
  }, [activePage, cropRect])

  async function rebuildPreviewFromPages(nextPages) {
    if (!nextPages.length) {
      setPreviewFile(file || null)
      return
    }
    const blobs = []
    for (const page of nextPages) {
      blobs.push(await canvasToJpegBlob(page.canvas))
    }
    const pdfBlob = await buildPdfBlobFromJpegBlobs(blobs)
    setPreviewFile(new File([pdfBlob], `${title || 'scan'}.pdf`, { type: 'application/pdf' }))
  }

  async function handleGalleryImport(event) {
    const selected = [...(event.target.files || [])]
    event.target.value = ''
    if (!selected.length) {
      return
    }
    const nextPages = [...pages]
    for (const item of selected) {
      const canvas = await loadImageToCanvas(item)
      nextPages.push(createPageFromCanvas(canvas, item.name))
    }
    setPages(nextPages)
    setActivePageId(nextPages[nextPages.length - 1]?.id || null)
    await rebuildPreviewFromPages(nextPages)
  }

  function handleRotate() {
    if (!activePage) {
      return
    }
    const nextPages = pages.map((page) => {
      if (page.id !== activePage.id) {
        return page
      }
      return {
        ...page,
        canvas: rotateCanvas(page.canvas, 90),
        rotation: (page.rotation + 90) % 360
      }
    })
    setPages(nextPages)
    setCropRect(null)
    rebuildPreviewFromPages(nextPages)
  }

  function handleCanvasPointerDown(event) {
    if (!cropMode || !activePage) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const scaleX = activePage.canvas.width / rect.width
    const scaleY = activePage.canvas.height / rect.height
    const start = {
      x: Math.round((event.clientX - rect.left) * scaleX),
      y: Math.round((event.clientY - rect.top) * scaleY)
    }
    setCropStart(start)
    setCropRect({ ...start, width: 0, height: 0 })
  }

  function handleCanvasPointerMove(event) {
    if (!cropMode || !cropStart || !activePage) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const scaleX = activePage.canvas.width / rect.width
    const scaleY = activePage.canvas.height / rect.height
    const currentX = Math.round((event.clientX - rect.left) * scaleX)
    const currentY = Math.round((event.clientY - rect.top) * scaleY)
    setCropRect({
      x: Math.min(cropStart.x, currentX),
      y: Math.min(cropStart.y, currentY),
      width: Math.abs(currentX - cropStart.x),
      height: Math.abs(currentY - cropStart.y)
    })
  }

  async function applyCrop() {
    if (!activePage || !cropRect || cropRect.width < 8 || cropRect.height < 8) {
      onNotify?.('Drag a crop area on the page first.')
      return
    }
    const cropped = cropCanvas(activePage.canvas, cropRect)
    const nextPages = pages.map((page) => (
      page.id === activePage.id ? { ...page, canvas: cropped } : page
    ))
    setPages(nextPages)
    setCropRect(null)
    setCropStart(null)
    setCropMode(false)
    await rebuildPreviewFromPages(nextPages)
  }

  function movePage(pageId, direction) {
    setPages((current) => {
      const index = current.findIndex((page) => page.id === pageId)
      if (index < 0) {
        return current
      }
      const target = index + direction
      if (target < 0 || target >= current.length) {
        return current
      }
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      rebuildPreviewFromPages(next)
      return next
    })
  }

  function removePage(pageId) {
    setPages((current) => {
      const next = current.filter((page) => page.id !== pageId)
      if (activePageId === pageId) {
        setActivePageId(next[0]?.id || null)
      }
      rebuildPreviewFromPages(next)
      return next
    })
  }

  async function handleConfirm() {
    if (!previewFile) {
      onNotify?.('Add at least one page before continuing.')
      return
    }
    if (scanBusy) {
      onNotify?.('Please wait while validation completes.')
      return
    }
    if (!scanResult?.verified) {
      onNotify?.(scanError || scanResult?.summary || 'Scanned document failed validation.')
      return
    }
    setBusy(true)
    try {
      if (outputMode === 'separate' && pages.length) {
        const blobs = []
        for (const page of pages) {
          blobs.push(await canvasToJpegBlob(page.canvas))
        }
        const files = await buildSeparatePdfBlobsFromJpegBlobs(blobs)
        onConfirm?.({
          files,
          file: files[0],
          title,
          pageCount: files.length,
          scanResult,
          outputMode
        })
        return
      }
      onConfirm?.({
        file: previewFile,
        title,
        pageCount: scanResult?.pageCount || pageCount || pages.length || 1,
        scanResult,
        outputMode
      })
    } catch (err) {
      onNotify?.(err.message || 'Unable to prepare scanned output.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="scan-studio">
      <div className="scan-studio-head">
        <div>
          <p className="eyebrow">Scan studio</p>
          <strong>Prepare pages, validate, and export</strong>
        </div>
        <DocumentTypePicker
          documentTypeId={documentTypeId}
          onChange={({ documentTypeId: nextTypeId }) => onDocumentTypeChange?.(nextTypeId)}
          category={category}
          office={office}
          onNotify={onNotify}
          compact
        />
      </div>

      <div className="scan-studio-toolbar">
        <button type="button" className="ghost-btn" onClick={() => galleryInputRef.current?.click()}>Import gallery</button>
        <button type="button" className="ghost-btn" onClick={handleRotate} disabled={!activePage}>Rotate 90°</button>
        <button type="button" className={`ghost-btn ${cropMode ? 'active' : ''}`} onClick={() => setCropMode((current) => !current)} disabled={!activePage}>
          {cropMode ? 'Crop mode on' : 'Crop'}
        </button>
        <button type="button" className="ghost-btn" onClick={applyCrop} disabled={!cropMode}>Apply crop</button>
        <label className="scan-studio-output-mode">
          <span>Output</span>
          <select value={outputMode} onChange={(event) => setOutputMode(event.target.value)}>
            <option value="single">Single PDF</option>
            <option value="separate">Separate PDFs</option>
          </select>
        </label>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={handleGalleryImport} />
      </div>

      <div className="scan-studio-body">
        <aside className="scan-studio-pages">
          <p className="eyebrow">Pages ({pages.length || (previewFile ? 1 : 0)})</p>
          {pages.length ? pages.map((page, index) => (
            <div key={page.id} className={`scan-studio-page-item ${page.id === activePageId ? 'active' : ''}`}>
              <button type="button" onClick={() => setActivePageId(page.id)}>
                <strong>{index + 1}. {page.label}</strong>
              </button>
              <div className="scan-studio-page-actions">
                <button type="button" className="ghost-btn tiny-btn" onClick={() => movePage(page.id, -1)} disabled={index === 0}>↑</button>
                <button type="button" className="ghost-btn tiny-btn" onClick={() => movePage(page.id, 1)} disabled={index === pages.length - 1}>↓</button>
                <button type="button" className="ghost-btn tiny-btn btn-danger" onClick={() => removePage(page.id)}>×</button>
              </div>
            </div>
          )) : previewFile ? (
            <p className="inline-note">PDF loaded as one document. Import gallery images to edit pages individually.</p>
          ) : (
            <p className="inline-note">Import images from your gallery to begin.</p>
          )}
        </aside>

        <div className="scan-studio-preview">
          {activePage ? (
            <canvas
              ref={previewRef}
              className="scan-studio-canvas"
              onMouseDown={handleCanvasPointerDown}
              onMouseMove={handleCanvasPointerMove}
            />
          ) : previewFile ? (
            <iframe title="Scan preview" src={URL.createObjectURL(previewFile)} className="scan-studio-frame" />
          ) : (
            <div className="scan-studio-empty">No preview yet</div>
          )}
        </div>
      </div>

      <label>
        <span>Document title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <div className="scan-studio-validation-grid">
        <div className={`upload-scan-panel ${scanBusy ? 'is-scanning' : scanResult?.verified ? 'is-verified' : scanResult ? 'is-rejected' : ''}`}>
          <p className="eyebrow">Template validation</p>
          {scanBusy ? <p>Validating scanned PDF…</p> : null}
          {scanError ? <p className="lookup-hint error">{scanError}</p> : null}
          {scanResult ? (
            <>
              <p>{scanResult.summary}</p>
              {scanResult.similarityScore != null ? (
                <p className="upload-scan-similarity">
                  Similarity: {scanResult.similarityScore}%
                  {scanResult.templateTitle ? ` · ${scanResult.templateTitle}` : ''}
                </p>
              ) : null}
              {scanResult.failedRules?.length ? (
                <ul className="upload-scan-failed-rules">
                  {scanResult.failedRules.map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="upload-scan-panel scan-studio-ocr-panel">
          <p className="eyebrow">Client scan (Tesseract.js)</p>
          <p>{frontendOcr.status === 'loading' ? 'Running client OCR preview…' : (frontendOcr.preview || 'OCR idle.')}</p>
          {frontendOcr.matchedKeywords?.length ? (
            <ul className="upload-scan-signals">
              {frontendOcr.matchedKeywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="upload-scan-panel">
          <p className="eyebrow">Server verified</p>
          {scanResult?.matchedSignals?.length ? (
            <ul className="upload-scan-signals">
              {scanResult.matchedSignals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          ) : null}
          {scanResult?.preview ? <p className="upload-scan-preview">“{scanResult.preview}”</p> : null}
          {!scanResult ? <p>Server validation runs after pages are assembled.</p> : null}
        </div>
      </div>

      <div className="scan-review-actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>Back</button>
        <button type="button" className="primary-btn" onClick={handleConfirm} disabled={busy || scanBusy || !scanResult?.verified}>
          {busy ? 'Preparing…' : 'Use scanned output'}
        </button>
      </div>
    </section>
  )
}
