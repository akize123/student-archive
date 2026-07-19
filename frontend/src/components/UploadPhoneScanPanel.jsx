import React, { useEffect, useState } from 'react'

import QRCode from 'qrcode'

import {

  createMobileScanSession,

  downloadMobileScanPdf,

  getMobileScanNetworkUrl,

  getMobileScanSession

} from '../api'

import ScanStudio from './ScanStudio'



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



export default function UploadPhoneScanPanel({

  variant = 'inline',

  onImport,

  onNotify,

  onClose,

  category,

  office,

  faculty,

  department,

  documentTypeId,

  onDocumentTypeChange,

  studentNumber,

  studentName

}) {

  const [session, setSession] = useState(null)

  const [scanBaseUrl, setScanBaseUrl] = useState('')

  const [scanUrl, setScanUrl] = useState('')

  const [qrDataUrl, setQrDataUrl] = useState('')

  const [busy, setBusy] = useState(false)

  const [error, setError] = useState('')

  const [reviewFile, setReviewFile] = useState(null)

  const [reviewPageCount, setReviewPageCount] = useState(0)

  const isModal = variant === 'modal'



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

        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: isModal ? 200 : 220 })

        if (active) setQrDataUrl(dataUrl)

      } catch (err) {

        if (active) setError(err.message || 'Unable to start phone scan session.')

      }

    }



    setup()

    return () => {

      active = false

    }

  }, [isModal])



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



  async function handleReview() {

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

      setReviewFile(imported)

      setReviewPageCount(session.pageCount)

    } catch (err) {

      setError(err.message || 'Unable to import scanned PDF.')

    } finally {

      setBusy(false)

    }

  }



  function handleConfirmReview(result) {

    onImport?.(result.file, result.pageCount, {

      title: result.title,

      scanResult: result.scanResult,

      files: result.files,

      outputMode: result.outputMode

    })

    setReviewFile(null)

    onNotify?.(`Imported ${result.pageCount} scanned page${result.pageCount === 1 ? '' : 's'}.`)

  }



  const isLocalhost = typeof window !== 'undefined'

    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const usingNetworkUrl = isLocalhost && scanBaseUrl && !scanBaseUrl.includes('localhost') && !scanBaseUrl.includes('127.0.0.1')



  if (reviewFile) {

    return (

      <ScanStudio

        file={reviewFile}

        pageCount={reviewPageCount}

        category={category}

        office={office}

        faculty={faculty}

        department={department}

        documentTypeId={documentTypeId}

        onDocumentTypeChange={onDocumentTypeChange}

        studentNumber={studentNumber}

        studentName={studentName}

        onConfirm={handleConfirmReview}

        onCancel={() => setReviewFile(null)}

        onNotify={onNotify}

      />

    )

  }



  return (

    <section className={`upload-phone-scan-panel ${isModal ? 'is-modal' : ''}`}>

      {isModal ? (

        <div className="phone-qr-modal-head">

          <div>

            <p className="eyebrow">Phone scanner</p>

            <strong>Scan with your phone</strong>

          </div>

          {onClose ? (

            <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close phone scanner">×</button>

          ) : null}

        </div>

      ) : (

        <div className="upload-phone-scan-copy">

          <p className="eyebrow">Phone scanner</p>

          <strong>Scan hard copies with your phone</strong>

          <p>

            Open the QR link on your phone, capture each page with document detection, arrange or remove pages,

            then review and validate the PDF here before upload.

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

      )}



      <div className="upload-phone-scan-body">

        {qrDataUrl ? (

          <img src={qrDataUrl} alt="QR code for phone scanner" className="upload-phone-scan-qr" />

        ) : (

          <div className="upload-phone-scan-qr placeholder">Preparing QR…</div>

        )}



        <div className="upload-phone-scan-status">

          <span className={`upload-phone-scan-badge status-${(session?.status || 'waiting').toLowerCase()}`}>

            {session?.ready

              ? 'Ready to review'

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

            <button type="button" className="primary-btn" onClick={handleReview} disabled={busy}>

              {busy ? 'Loading…' : 'Review scanned PDF'}

            </button>

          ) : null}

          {error ? <p className="lookup-hint error">{error}</p> : null}

        </div>

      </div>



      {isModal ? (

        <p className="phone-qr-modal-footnote">

          {usingNetworkUrl

            ? `Use ${scanBaseUrl} on the same Wi-Fi network.`

            : 'Phone and computer must be on the same network.'}

        </p>

      ) : null}

    </section>

  )

}

