import React, { useEffect, useRef, useState } from 'react'
import {
  addMobileScanPage,
  deleteMobileScanPage,
  finalizeMobileScanSession,
  getMobileScanSession,
  reorderMobileScanPages
} from '../api'
import { canvasToJpegBlob, enhanceDocumentImage } from '../documentScan'
import { CheckIcon, ChevronDownIcon, ArrowUpIcon, TrashIcon } from './Icons'

export default function MobileScanPage({ token }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [session, setSession] = useState(null)
  const [pages, setPages] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  useEffect(() => {
    let active = true
    getMobileScanSession(token)
      .then((data) => {
        if (active) setSession(data)
      })
      .catch((err) => {
        if (active) setError(err.message || 'Scan session not found.')
      })
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    let active = true
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCameraReady(true)
        }
      } catch {
        if (active) setError('Camera access is required to scan documents. You can also add photos from your gallery below.')
      }
    }
    startCamera()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function uploadPageBlob(blob) {
    setBusy(true)
    setError('')
    try {
      const created = await addMobileScanPage(token, blob)
      setPages((current) => [...current, { id: created.id, order: created.order, preview: URL.createObjectURL(blob) }])
      const nextSession = await getMobileScanSession(token)
      setSession(nextSession)
    } catch (err) {
      setError(err.message || 'Unable to upload scanned page.')
    } finally {
      setBusy(false)
    }
  }

  async function capturePage() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setError('Camera is not ready yet.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const enhanced = enhanceDocumentImage(canvas)
    const blob = await canvasToJpegBlob(enhanced)
    await uploadPageBlob(blob)
  }

  async function handleGallerySelect(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    for (const file of files) {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0)
      bitmap.close()
      const enhanced = enhanceDocumentImage(canvas)
      const blob = await canvasToJpegBlob(enhanced)
      await uploadPageBlob(blob)
    }
  }

  async function removePage(pageId) {
    setBusy(true)
    setError('')
    try {
      const nextSession = await deleteMobileScanPage(token, pageId)
      setSession(nextSession)
      setPages((current) => current.filter((page) => page.id !== pageId))
    } catch (err) {
      setError(err.message || 'Unable to remove page.')
    } finally {
      setBusy(false)
    }
  }

  async function movePage(pageId, direction) {
    const index = pages.findIndex((page) => page.id === pageId)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= pages.length) return
    const reordered = [...pages]
    const [item] = reordered.splice(index, 1)
    reordered.splice(target, 0, item)
    setBusy(true)
    setError('')
    try {
      const nextSession = await reorderMobileScanPages(token, reordered.map((page) => page.id))
      setSession(nextSession)
      setPages(reordered.map((page, orderIndex) => ({ ...page, order: orderIndex + 1 })))
    } catch (err) {
      setError(err.message || 'Unable to reorder pages.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFinish() {
    setBusy(true)
    setError('')
    try {
      await finalizeMobileScanSession(token)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Unable to finish scan session.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mobile-scan-page">
        <div className="mobile-scan-card success">
          <CheckIcon className="icon" />
          <h1>Scan sent</h1>
          <p>Return to your computer and click <strong>Use scanned PDF</strong> in the upload window.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-scan-page">
      <header className="mobile-scan-header">
        <div>
          <p className="eyebrow">AUCA phone scanner</p>
          <h1>Scan hard-copy pages</h1>
          <p>Align each page inside the frame. Pages are auto-detected, then you can reorder or remove them before sending.</p>
        </div>
        <span className="mobile-scan-count">{pages.length} page{pages.length === 1 ? '' : 's'}</span>
      </header>

      {error ? <div className="banner warning">{error}</div> : null}

      <section className="mobile-scan-camera-shell">
        <video ref={videoRef} className="mobile-scan-video" playsInline muted />
        <div className="mobile-scan-frame" aria-hidden="true" />
        {!cameraReady ? <p className="mobile-scan-camera-note">Starting camera…</p> : null}
      </section>

      <div className="mobile-scan-actions">
        <button type="button" className="primary-btn" onClick={capturePage} disabled={busy}>
          Capture page
        </button>
        <label className="ghost-btn mobile-scan-gallery-btn">
          Add from gallery
          <input type="file" accept="image/*" multiple onChange={handleGallerySelect} hidden />
        </label>
      </div>

      {pages.length ? (
        <section className="mobile-scan-pages">
          <div className="mobile-scan-pages-head">
            <h2>Captured pages</h2>
            <p>Reorder or remove pages before confirming upload.</p>
          </div>
          <div className="mobile-scan-page-list">
            {pages.map((page, index) => (
              <article key={page.id} className="mobile-scan-page-item">
                <img src={page.preview} alt={`Scanned page ${index + 1}`} />
                <div className="mobile-scan-page-tools">
                  <strong>Page {index + 1}</strong>
                  <div className="mobile-scan-page-buttons">
                    <button type="button" className="ghost-icon" onClick={() => movePage(page.id, -1)} disabled={busy || index === 0} aria-label="Move up">
                      <ArrowUpIcon className="icon tiny" />
                    </button>
                    <button type="button" className="ghost-icon" onClick={() => movePage(page.id, 1)} disabled={busy || index === pages.length - 1} aria-label="Move down">
                      <ChevronDownIcon className="icon tiny" />
                    </button>
                    <button type="button" className="ghost-icon danger-text" onClick={() => removePage(page.id)} disabled={busy} aria-label="Remove page">
                      <TrashIcon className="icon tiny" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <button type="button" className="primary-btn mobile-scan-finish" onClick={handleFinish} disabled={busy}>
            Send {pages.length} page{pages.length === 1 ? '' : 's'} to computer
          </button>
        </section>
      ) : null}

      {session?.expiresAt ? (
        <p className="mobile-scan-expiry">Session active until {new Date(session.expiresAt).toLocaleTimeString()}</p>
      ) : null}
    </div>
  )
}
