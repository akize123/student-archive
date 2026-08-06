import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import {
  createMobileScanSession,
  downloadMobileScanPdf,
  getMobileScanNetworkUrl,
  getMobileScanSession,
  startNextMobileScanBatch
} from '../api'
import { mergePdfFiles, countMergedPdfPages } from '../pdfMerge'

function buildMobileScanUrl(base, token) {
  return `${base}#/mobile-scan/${token}`
}

async function resolveScanBaseUrl() {
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL
  if (envUrl) {
    return String(envUrl).replace(/\/$/, '')
  }
  if (typeof window === 'undefined') {
    return ''
  }

  const { hostname, port, protocol } = window.location
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`
  }

  const frontendPort = port ? Number(port) : 5173
  const scheme = protocol === 'http:' ? 'http' : 'https'
  try {
    const info = await getMobileScanNetworkUrl(frontendPort, scheme)
    if (info?.scanBaseUrl) {
      return String(info.scanBaseUrl).replace(/\/$/, '')
    }
  } catch {
    // Fall back to current origin if network detection fails.
  }

  return `${protocol}//${hostname}${port ? `:${port}` : ''}`
}

async function blobsFromDownload(download) {
  const { blob, disposition, contentType } = download
  const isZip = String(contentType).includes('zip')
    || String(disposition).toLowerCase().includes('.zip')
    || blob.type === 'application/zip'
  if (!isZip) {
    return [new File([blob], 'phone-scan.pdf', { type: 'application/pdf' })]
  }

  const zip = await JSZip.loadAsync(blob)
  const pdfEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /\.pdf$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))

  const files = []
  for (const entry of pdfEntries) {
    const pdfBlob = await entry.async('blob')
    const name = entry.name.split('/').pop() || `scan-page-${files.length + 1}.pdf`
    files.push(new File([pdfBlob], name, { type: 'application/pdf' }))
  }
  return files
}

export default function UploadPhoneScanPanel({
  onImport,
  onNotify,
  selectedFile = null
}) {
  const [session, setSession] = useState(null)
  const [scanBaseUrl, setScanBaseUrl] = useState('')
  const [scanUrl, setScanUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [batchFiles, setBatchFiles] = useState([])
  const [joinedFile, setJoinedFile] = useState(null)
  const [joinedPageCount, setJoinedPageCount] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(true)
  const autoImportTokenRef = useRef('')
  const batchFilesRef = useRef([])
  const previewUrl = useMemo(
    () => (joinedFile ? URL.createObjectURL(joinedFile) : ''),
    [joinedFile]
  )

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    batchFilesRef.current = batchFiles
  }, [batchFiles])

  const applyJoinedFile = useCallback(async (files, notice) => {
    const merged = await mergePdfFiles(files, 'phone-scan-combined.pdf')
    const pages = await countMergedPdfPages(merged)
    setJoinedFile(merged)
    setJoinedPageCount(pages)
    setPreviewOpen(true)
    onImport?.(merged, pages)
    if (notice) onNotify?.(notice)
  }, [onImport, onNotify])

  const pairSession = useCallback(async () => {
    setError('')
    autoImportTokenRef.current = ''
    const base = await resolveScanBaseUrl()
    setScanBaseUrl(base)
    const created = await createMobileScanSession()
    setSession(created)
    const url = buildMobileScanUrl(base, created.token)
    setScanUrl(url)
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 })
    setQrDataUrl(dataUrl)
  }, [])

  useEffect(() => {
    let active = true
    pairSession().catch((err) => {
      if (active) setError(err.message || 'Unable to start phone scan session.')
    })
    return () => {
      active = false
    }
  }, [pairSession])

  // Keep local joined preview in sync if parent already has a selected phone scan file.
  useEffect(() => {
    if (!selectedFile || joinedFile) return
    if (!String(selectedFile.name || '').toLowerCase().includes('phone-scan')) return
    setJoinedFile(selectedFile)
    countMergedPdfPages(selectedFile).then((pages) => setJoinedPageCount(pages || 0)).catch(() => {})
  }, [selectedFile, joinedFile])

  const prepareNextBatch = useCallback(async (token) => {
    if (!token) return
    const next = await startNextMobileScanBatch(token)
    setSession(next)
    autoImportTokenRef.current = ''
  }, [])

  const importFiles = useCallback(async (files) => {
    if (!files?.length) return
    // Always join this delivery into one PDF, then append to previous scans as one document.
    const deliveryJoined = await mergePdfFiles(
      files,
      `phone-scan-batch-${batchFilesRef.current.length + 1}.pdf`
    )
    const nextBatches = [...batchFilesRef.current, deliveryJoined]
    batchFilesRef.current = nextBatches
    setBatchFiles(nextBatches)
    await applyJoinedFile(
      nextBatches,
      nextBatches.length > 1
        ? `Joined ${nextBatches.length} scans into one PDF. Keep scanning or upload.`
        : 'Scanned PDF imported. Preview below — keep scanning to add more pages.'
    )
    if (session?.token) {
      await prepareNextBatch(session.token)
    }
  }, [applyJoinedFile, prepareNextBatch, session?.token])

  const handleImport = useCallback(async ({ auto = false } = {}) => {
    if (!session?.token || !session.ready) {
      return
    }
    const stamp = `${session.token}:${session.pageCount}:${session.deliveryFormat || 'PDF'}`
    if (auto && autoImportTokenRef.current === stamp) {
      return
    }
    setBusy(true)
    setError('')
    try {
      autoImportTokenRef.current = stamp
      const download = await downloadMobileScanPdf(session.token)
      const files = await blobsFromDownload(download)
      if (!files.length) {
        throw new Error('No PDF pages were found in the scan delivery.')
      }
      await importFiles(files)
    } catch (err) {
      autoImportTokenRef.current = ''
      setError(err.message || 'Unable to import scanned PDF.')
    } finally {
      setBusy(false)
    }
  }, [importFiles, session])

  useEffect(() => {
    if (!session?.token) {
      return undefined
    }
    let active = true
    const timer = window.setInterval(() => {
      getMobileScanSession(session.token)
        .then((next) => {
          if (!active) return
          setSession(next)
        })
        .catch(() => {})
    }, 2000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [session?.token])

  useEffect(() => {
    if (session?.ready && !busy) {
      handleImport({ auto: true })
    }
  }, [session?.ready, busy, handleImport])

  async function handleJoinAgain() {
    if (!batchFiles.length) return
    setBusy(true)
    try {
      await applyJoinedFile(batchFiles, 'All scanned batches joined into one PDF.')
    } catch (err) {
      setError(err.message || 'Unable to join scanned PDFs.')
    } finally {
      setBusy(false)
    }
  }

  async function handleClearJoined() {
    batchFilesRef.current = []
    setBatchFiles([])
    setJoinedFile(null)
    setJoinedPageCount(0)
    onImport?.(null, 0)
    onNotify?.('Cleared scanned PDF selection.')
  }

  async function handleNewQr() {
    setBusy(true)
    try {
      await pairSession()
      onNotify?.('New QR ready. Scan it again on the phone.')
    } catch (err) {
      setError(err.message || 'Unable to create a new QR.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink() {
    if (!scanUrl) return
    try {
      await navigator.clipboard.writeText(scanUrl)
      onNotify?.('Scanner link copied. Open it on the phone (accept the certificate if prompted).')
    } catch {
      onNotify?.(scanUrl)
    }
  }

  const isLocalhost = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const usingNetworkUrl = isLocalhost && scanBaseUrl && !scanBaseUrl.includes('localhost') && !scanBaseUrl.includes('127.0.0.1')

  return (
    <section className="upload-phone-scan-panel">
      <div className="upload-phone-scan-copy">
        <p className="eyebrow">Phone scanner</p>
        <strong>Pair phone · scan · join as one document</strong>
        <p>
          Scan the QR on your phone, capture pages, and send.
          Every send is joined into one PDF here so you can preview and upload a single document.
        </p>
        {usingNetworkUrl ? (
          <p className="inline-note">
            QR uses <strong>{scanBaseUrl}</strong>. Phone and computer must share the same Wi-Fi. Accept the HTTPS certificate warning on the phone.
          </p>
        ) : isLocalhost ? (
          <p className="upload-phone-scan-warning">
            Open this app from your computer&apos;s LAN address (for example https://192.168.x.x:5173), then open Phone scanner so the QR works on your phone.
          </p>
        ) : (
          <small className="inline-note">
            Phone and computer must be on the same network. Accept the site certificate on the phone if asked.
          </small>
        )}
      </div>

      <div className="upload-phone-scan-body">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR code for phone scanner" className="upload-phone-scan-qr" />
        ) : (
          <div className="upload-phone-scan-qr placeholder">Preparing QR…</div>
        )}

        <div className="upload-phone-scan-status">
          <span className={`upload-phone-scan-badge status-${(session?.status || 'waiting').toLowerCase()}`}>
            {session?.ready
              ? 'Receiving scan…'
              : session?.pageCount
                ? `${session.pageCount} page${session.pageCount === 1 ? '' : 's'} on phone`
                : 'Waiting for phone'}
          </span>
          {batchFiles.length ? (
            <span className="inline-note">
              {batchFiles.length} scan batch{batchFiles.length === 1 ? '' : 'es'} · joined PDF has {joinedPageCount || '?'} page{joinedPageCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {scanUrl ? (
            <>
              <a href={scanUrl} target="_blank" rel="noreferrer" className="upload-phone-scan-link">
                Open scanner link
              </a>
              <button type="button" className="ghost-btn tiny-btn" onClick={handleCopyLink} disabled={busy}>
                Copy link
              </button>
            </>
          ) : null}
          {session?.ready ? (
            <button type="button" className="primary-btn" onClick={() => handleImport()} disabled={busy}>
              {busy ? 'Importing…' : 'Use scanned pages'}
            </button>
          ) : null}
          {batchFiles.length > 1 ? (
            <button type="button" className="primary-btn" onClick={handleJoinAgain} disabled={busy}>
              Re-join as one document
            </button>
          ) : null}
          <button type="button" className="ghost-btn" onClick={handleNewQr} disabled={busy}>
            New QR / Re-pair
          </button>
          {joinedFile ? (
            <button type="button" className="ghost-btn" onClick={handleClearJoined} disabled={busy}>
              Clear scanned PDF
            </button>
          ) : null}
          {error ? <p className="lookup-hint error">{error}</p> : null}
        </div>
      </div>

      {joinedFile ? (
        <div className="upload-phone-scan-preview-card">
          <div className="upload-phone-scan-preview-head">
            <div>
              <strong>Document preview</strong>
              <span>{joinedFile.name} · {joinedPageCount || '?'} page{joinedPageCount === 1 ? '' : 's'} · joined as one PDF</span>
            </div>
            <button
              type="button"
              className="ghost-btn tiny-btn"
              onClick={() => setPreviewOpen((current) => !current)}
            >
              {previewOpen ? 'Hide preview' : 'Show preview'}
            </button>
          </div>
          {previewOpen && previewUrl ? (
            <iframe
              className="upload-phone-scan-preview"
              src={previewUrl}
              title={`Preview ${joinedFile.name}`}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
