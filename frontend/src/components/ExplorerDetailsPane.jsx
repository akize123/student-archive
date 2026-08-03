import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fetchDocumentPreview, getDocument, verifyDocumentIntegrity } from '../api'

function formatIntegrity(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'verified') return { label: 'Verified', className: 'integrity-verified' }
  if (normalized === 'modified') return { label: 'Modified', className: 'integrity-modified' }
  return { label: 'Unknown', className: 'integrity-unknown' }
}

export default function ExplorerDetailsPane({
  documentItem,
  onNotify,
  onOpenDocument,
  onDownloadDocument
}) {
  const [detail, setDetail] = useState(null)
  const [integrity, setIntegrity] = useState(null)
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const paneRef = useRef(null)

  useEffect(() => {
    if (!documentItem?.id || !paneRef.current) {
      return undefined
    }
    paneRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    return undefined
  }, [documentItem?.id])

  useEffect(() => {
    if (!documentItem?.id) {
      setDetail(null)
      setIntegrity(null)
      setPreviewUrl('')
      return undefined
    }

    let active = true
    let objectUrl = ''
    setBusy(true)
    Promise.all([
      getDocument(documentItem.id),
      verifyDocumentIntegrity(documentItem.id).catch(() => null)
    ])
      .then(async ([documentDetail, integrityResult]) => {
        if (!active) return
        setDetail(documentDetail)
        setIntegrity(integrityResult)
        const { blob } = await fetchDocumentPreview(documentItem.id)
        objectUrl = URL.createObjectURL(blob)
        if (active) setPreviewUrl(objectUrl)
      })
      .catch((err) => {
        if (active) onNotify?.(err.message || 'Unable to load document details.')
      })
      .finally(() => {
        if (active) setBusy(false)
      })

    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [documentItem?.id, onNotify])

  useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const integrityMeta = useMemo(
    () => formatIntegrity(integrity?.integrityStatus || detail?.integrityStatus),
    [integrity, detail]
  )

  if (!documentItem) {
    return null
  }

  return (
    <aside ref={paneRef} className="explorer-details-pane" aria-label="File properties">
      <div className="explorer-details-head">
        <div>
          <p className="eyebrow">Properties</p>
          <strong>{detail?.fileName || documentItem.fileName || documentItem.title}</strong>
        </div>
        <div className="explorer-details-actions">
          <button type="button" className="ghost-btn tiny-btn" onClick={() => onOpenDocument?.(documentItem)}>Open</button>
          {detail?.allowDownload !== false ? (
            <button type="button" className="ghost-btn tiny-btn" onClick={() => onDownloadDocument?.(documentItem)}>Download</button>
          ) : null}
        </div>
      </div>

      {previewUrl ? (
        <iframe title="Document preview" src={previewUrl} className="explorer-details-preview" />
      ) : (
        <div className="explorer-details-preview placeholder">
          {busy ? 'Loading preview…' : 'Preview unavailable'}
        </div>
      )}

      <dl className="explorer-details-properties">
        <div>
          <dt>Type</dt>
          <dd>{detail?.documentTypeName || detail?.type || documentItem.category || '—'}</dd>
        </div>
        <div>
          <dt>MIME</dt>
          <dd>{detail?.mimeType || documentItem.mimeType || '—'}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{detail?.sizeBytes != null ? `${detail.sizeBytes.toLocaleString()} bytes` : '—'}</dd>
        </div>
        <div>
          <dt>Student ID</dt>
          <dd>{detail?.studentNumber || documentItem.studentNumber || '—'}</dd>
        </div>
        <div>
          <dt>Uploaded</dt>
          <dd>{detail?.uploadedAt || detail?.createdAt || documentItem.uploadedAt || '—'}</dd>
        </div>
        <div>
          <dt>Modified</dt>
          <dd>{detail?.modifiedAt || documentItem.modifiedAt || '—'}</dd>
        </div>
        <div>
          <dt>Path</dt>
          <dd title={detail?.folderPath || ''}>{detail?.folderPath || '—'}</dd>
        </div>
        <div>
          <dt>Checksum (SHA-256)</dt>
          <dd className="explorer-details-mono">{detail?.contentChecksumSha256 || integrity?.contentChecksumSha256 || '—'}</dd>
        </div>
        <div>
          <dt>Integrity</dt>
          <dd>
            <span className={`integrity-badge ${integrityMeta.className}`}>{integrityMeta.label}</span>
            {integrity?.message ? <small>{integrity.message}</small> : null}
            {integrityMeta.className === 'integrity-modified' ? (
              <small>File bytes no longer match the stored checksum.</small>
            ) : null}
          </dd>
        </div>
      </dl>
    </aside>
  )
}
