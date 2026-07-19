import React, { useEffect, useState } from 'react'

import { scanDocument } from '../api'



export default function ScanReviewStudio({

  file,

  pageCount,

  category,

  office,

  faculty,

  department,

  studentNumber,

  studentName,

  onConfirm,

  onCancel,

  onNotify

}) {

  const [title, setTitle] = useState(file?.name?.replace(/\.pdf$/i, '') || 'Phone scan')

  const [scanBusy, setScanBusy] = useState(false)

  const [scanResult, setScanResult] = useState(null)

  const [scanError, setScanError] = useState('')



  useEffect(() => {

    if (!file) {

      return undefined

    }

    let active = true

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

      fileName: file.name

    }

    scanDocument(file, context)

      .then((result) => {

        if (active) setScanResult(result)

      })

      .catch((err) => {

        if (active) setScanError(err.message || 'Unable to validate scanned document.')

      })

      .finally(() => {

        if (active) setScanBusy(false)

      })

    return () => {

      active = false

    }

  }, [file, category, office, faculty, department, studentNumber, studentName])



  function handleConfirm() {

    if (!file) {

      return

    }

    if (scanBusy) {

      onNotify?.('Please wait while the scanned document is validated.')

      return

    }

    if (!scanResult?.verified) {

      onNotify?.(scanError || scanResult?.summary || 'Scanned document failed validation.')

      return

    }

    onConfirm?.({

      file,

      title,

      pageCount: scanResult?.pageCount || pageCount,

      scanResult

    })

  }



  if (!file) {

    return null

  }



  return (

    <section className="scan-review-studio">

      <div className="scan-review-head">

        <p className="eyebrow">Scan review</p>

        <strong>Confirm document details before import</strong>

      </div>

      <label>

        <span>Document title</span>

        <input value={title} onChange={(event) => setTitle(event.target.value)} />

      </label>

      <div className={`upload-scan-panel ${scanBusy ? 'is-scanning' : scanResult?.verified ? 'is-verified' : scanResult ? 'is-rejected' : ''}`}>

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

      <div className="scan-review-actions">

        <button type="button" className="ghost-btn" onClick={onCancel}>Back</button>

        <button type="button" className="primary-btn" onClick={handleConfirm} disabled={scanBusy || !scanResult?.verified}>

          Use scanned PDF

        </button>

      </div>

    </section>

  )

}

