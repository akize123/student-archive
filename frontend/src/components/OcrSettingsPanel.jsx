import React, { useEffect, useState } from 'react'
import { getOcrSettings, updateOcrSettings } from '../api'

export default function OcrSettingsPanel({ onNotify }) {
  const [ocrSettings, setOcrSettings] = useState(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getOcrSettings()
      .then(setOcrSettings)
      .catch(() => setOcrSettings(null))
      .finally(() => setLoading(false))
  }, [])

  async function handleOcrToggle(enabled) {
    setOcrBusy(true)
    try {
      const next = await updateOcrSettings({ enabled })
      setOcrSettings(next)
      onNotify?.(enabled ? 'OCR enabled for scanned PDFs.' : 'OCR disabled.')
    } catch (err) {
      onNotify?.(err.message || 'Unable to update OCR settings.')
    } finally {
      setOcrBusy(false)
    }
  }

  if (loading) {
    return <p className="admin-muted-cell">Loading OCR settings…</p>
  }

  return (
    <section className="ocr-settings-panel">
      <div className="ocr-settings-head">
        <p className="eyebrow">OCR</p>
        <h3>Scanned PDF text extraction</h3>
        <p>Enable OCR when uploads are image-based PDFs so keyword checks can read the text.</p>
      </div>

      {ocrSettings ? (
        <div className="ocr-settings-body">
          <div className="ocr-settings-status-row">
            <span className={`template-ocr-badge ${ocrSettings.enabled && ocrSettings.available ? 'ok' : 'warn'}`}>
              {ocrSettings.enabled
                ? (ocrSettings.available ? 'OCR enabled' : 'OCR enabled · Tesseract missing')
                : 'OCR disabled'}
            </span>
            <label className="template-ocr-toggle">
              <input
                type="checkbox"
                checked={Boolean(ocrSettings.enabled)}
                disabled={ocrBusy}
                onChange={(event) => handleOcrToggle(event.target.checked)}
              />
              <span>{ocrSettings.enabled ? 'Turn off OCR' : 'Enable OCR'}</span>
            </label>
          </div>
          <p className="template-ocr-note">{ocrSettings.note}</p>
          {ocrSettings.tessdataPath ? (
            <small className="inline-note">Tessdata: {ocrSettings.tessdataPath}</small>
          ) : null}
        </div>
      ) : (
        <p className="inline-note">Unable to load OCR settings.</p>
      )}
    </section>
  )
}
