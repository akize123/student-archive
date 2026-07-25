import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  createMobileScanSession,
  downloadMobileScanPdf,
  getMobileScanNetworkUrl,
  getMobileScanSession
} from '../api'

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
  try {
    const info = await getMobileScanNetworkUrl(frontendPort)
    if (info?.scanBaseUrl) {
      return String(info.scanBaseUrl).replace(/\/$/, '')
    }
  } catch {
    // Fall back to current origin if network detection fails.
  }

  return `${protocol}//${hostname}${port ? `:${port}` : ''}`
}

export default function UploadPhoneScanPanel({ onImport, onNotify }) {
  const [session, setSession] = useState(null)
  const [scanBaseUrl, setScanBaseUrl] = useState('')
  const [scanUrl, setScanUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function setup() {
      try {
        const base = await resolveScanBaseUrl()
        if (!active) return
        setScanBaseUrl(base)

        const created = await createMobileScanSession()
        if (!active) return
        setSession(created)

        const url = buildMobileScanUrl(base, created.token)
        setScanUrl(url)
        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 })
        if (active) setQrDataUrl(dataUrl)
      } catch (err) {
        if (active) setError(err.message || 'Unable to start phone scan session.')
      }
    }

    setup()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!session?.token || session.ready) {
      return undefined
    }
    let active = true
    const timer = window.setInterval(() => {
      getMobileScanSession(session.token)
        .then((next) => {
          if (active) setSession(next)
        })
        .catch(() => {
          // Ignore transient polling errors.
        })
    }, 2000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [session?.token, session?.ready])

  async function handleImport() {
    if (!session?.token || !session.ready) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const blob = await downloadMobileScanPdf(session.token)
      const imported = new File([blob], `phone-scan-${session.pageCount}-pages.pdf`, {
        type: 'application/pdf'
      })
      onImport?.(imported, session.pageCount)
      onNotify?.(`Imported ${session.pageCount} scanned page${session.pageCount === 1 ? '' : 's'}.`)
    } catch (err) {
      setError(err.message || 'Unable to import scanned PDF.')
    } finally {
      setBusy(false)
    }
  }

  const isLocalhost = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const usingNetworkUrl = isLocalhost && scanBaseUrl && !scanBaseUrl.includes('localhost') && !scanBaseUrl.includes('127.0.0.1')

  return (
    <section className="upload-phone-scan-panel">
      <div className="upload-phone-scan-copy">
        <p className="eyebrow">Phone scanner</p>
        <strong>Scan hard copies with your phone</strong>
        <p>
          Open the QR link on your phone, capture each page with document detection, arrange or remove pages,
          then send the PDF back here.
        </p>
        {usingNetworkUrl ? (
          <p className="inline-note">
            QR uses your network address <strong>{scanBaseUrl}</strong>. Phone and computer must be on the same Wi-Fi.
          </p>
        ) : isLocalhost ? (
          <p className="upload-phone-scan-warning">
            Could not detect a network IP. Connect this computer to Wi-Fi, allow port 5173 through the firewall, or open the app at http://192.168.x.x:5173.
          </p>
        ) : (
          <small className="inline-note">
            Phone and computer must be on the same network. The QR link uses this device&apos;s current address.
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
              ? 'Ready to import'
              : session?.pageCount
                ? `${session.pageCount} page${session.pageCount === 1 ? '' : 's'} captured`
                : 'Waiting for phone'}
          </span>
          {scanUrl ? (
            <a href={scanUrl} target="_blank" rel="noreferrer" className="upload-phone-scan-link">
              Open scanner link
            </a>
          ) : null}
          {session?.ready ? (
            <button type="button" className="primary-btn" onClick={handleImport} disabled={busy}>
              {busy ? 'Importing…' : 'Use scanned PDF'}
            </button>
          ) : null}
          {error ? <p className="lookup-hint error">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
