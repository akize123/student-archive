import React, { useEffect, useState } from 'react'
import { lookupStudent } from '../api'
import {
  normalizeStudentId,
  validateStaffFolderName,
  validateStudentIdDepartmentMatch
} from '../studentId'
import { CheckIcon, FolderIcon, UploadIcon, XIcon } from './Icons'

export default function ImportStudentLinkModal({
  open,
  busy,
  phase = 'link',
  importError = '',
  onDismissImportError,
  onChooseZip,
  onBackToLink,
  folderName,
  placementSummary,
  department,
  insideStudentTree,
  linkedStudentNumber,
  linkedStudentName,
  confirmedContext,
  onClose,
  onConfirm,
  onOpenFolder
}) {
  const [studentNumber, setStudentNumber] = useState('')
  const [studentName, setStudentName] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupInfo, setLookupInfo] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [entryMode, setEntryMode] = useState('idle')

  const zipPhase = phase === 'zip'
  const displayStudentNumber = confirmedContext?.studentNumber || linkedStudentNumber || ''
  const displayStudentName = confirmedContext?.studentName || linkedStudentName || ''

  useEffect(() => {
    if (!open || zipPhase) {
      return
    }
    if (insideStudentTree) {
      setStudentNumber(linkedStudentNumber || '')
      setStudentName(linkedStudentName || '')
      setLookupResult(linkedStudentNumber ? {
        studentNumber: linkedStudentNumber,
        studentName: linkedStudentName,
        found: true
      } : null)
      setEntryMode('existing')
      setLookupError('')
      setLookupInfo('')
      return
    }
    setStudentNumber('')
    setStudentName('')
    setLookupResult(null)
    setEntryMode('idle')
    setLookupError('')
    setLookupInfo('')
  }, [open, insideStudentTree, linkedStudentNumber, linkedStudentName, zipPhase])

  if (!open) {
    return null
  }

  async function runLookup(rawNumber, { populateName = true } = {}) {
    const trimmed = normalizeStudentId(rawNumber)
    if (!trimmed) {
      setLookupError('Please enter a student ID first.')
      setLookupInfo('')
      setLookupResult(null)
      setEntryMode('idle')
      return null
    }

    setLookupBusy(true)
    try {
      const data = await lookupStudent(trimmed)
      if (!data.found) {
        setLookupResult(null)
        setEntryMode('new')
        setLookupError('')
        setLookupInfo(
          placementSummary
            ? `No archive record for ${trimmed}. Enter the full name to link this ID under ${placementSummary}.`
            : `No archive record for ${trimmed}. Enter the full name to link this student ID.`
        )
        setStudentNumber(trimmed)
        return null
      }

      setLookupResult(data)
      setEntryMode('existing')
      setLookupError('')
      setLookupInfo('')
      setStudentNumber(data.studentNumber || trimmed)
      if (populateName) {
        setStudentName(data.studentName || '')
      }
      return data
    } catch (err) {
      setLookupResult(null)
      setEntryMode('idle')
      setLookupError(err.message || 'Unable to look up this student ID.')
      setLookupInfo('')
      return null
    } finally {
      setLookupBusy(false)
    }
  }

  function handleConfirm() {
    if (insideStudentTree) {
      if (!linkedStudentNumber) {
        return
      }
      onConfirm?.({
        studentNumber: linkedStudentNumber,
        studentName: linkedStudentName || linkedStudentNumber,
        entryMode: 'existing',
        insideStudentTree: true
      })
      return
    }

    const normalizedId = normalizeStudentId(studentNumber)
    if (!normalizedId) {
      setLookupError('Student ID is required before import.')
      return
    }
    const namingError = validateStaffFolderName(normalizedId)
    if (namingError) {
      setLookupError(namingError)
      return
    }
    const departmentError = validateStudentIdDepartmentMatch(normalizedId, department)
    if (departmentError) {
      setLookupError(departmentError)
      return
    }
    if (entryMode === 'new' && !String(studentName || '').trim()) {
      setLookupError('Enter the student full name to link this new ID.')
      return
    }

    onConfirm?.({
      studentNumber: normalizedId,
      studentName: String(studentName || lookupResult?.studentName || normalizedId).trim(),
      entryMode,
      insideStudentTree: false,
      folderId: lookupResult?.folderId || null
    })
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose} role="presentation">
      <div className="modal import-link-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Import documents</p>
            <h2>{zipPhase ? 'Choose ZIP archive' : 'Link import to a student'}</h2>
            {zipPhase ? (
              <p className="upload-modal-subtitle">
                Select a ZIP file containing PDF documents to import.
              </p>
            ) : insideStudentTree ? (
              <p className="upload-modal-subtitle">
                Importing inside &quot;{folderName}&quot;. Files will be linked to the student folder you opened.
              </p>
            ) : null}
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} disabled={busy} aria-label="Close import link dialog">
            <XIcon className="icon" />
          </button>
        </div>

        {importError ? (
          <div className="import-modal-alert" role="alert">
            <div className="import-modal-alert-copy">
              <strong>Could not import this ZIP</strong>
              <p>{importError}</p>
            </div>
            <button
              type="button"
              className="ghost-icon import-modal-alert-dismiss"
              onClick={onDismissImportError}
              aria-label="Dismiss message"
            >
              <XIcon className="icon" />
            </button>
          </div>
        ) : null}

        {zipPhase ? (
          <section className="import-link-zip-panel">
            <p className="upload-record-linked-summary">
              Linked to student ID: <strong>{displayStudentNumber || '—'}</strong>
              {displayStudentName ? (
                <> · <strong className="upload-record-linked-name">{displayStudentName}</strong></>
              ) : null}
            </p>
            <p className="inline-note">
              The ZIP must contain at least one PDF document. You can choose a different ZIP without starting over.
            </p>
          </section>
        ) : insideStudentTree ? (
          <section className="import-link-linked-panel">
            <p className="upload-record-linked-summary">
              Linked to student ID: <strong>{linkedStudentNumber || '—'}</strong>
              {linkedStudentName ? (
                <> · <strong className="upload-record-linked-name">{linkedStudentName}</strong></>
              ) : null}
            </p>
            <p className="inline-note">
              PDFs will import into this folder location under that student record.
            </p>
          </section>
        ) : (
          <section className="import-link-form">
            <label className="upload-record-input">
              <span>Student ID</span>
              <div className="lookup-input-row">
                <input
                  value={studentNumber}
                  onChange={(event) => {
                    setStudentNumber(normalizeStudentId(event.target.value))
                    setLookupError('')
                    setLookupInfo('')
                    setLookupResult(null)
                    setEntryMode('idle')
                  }}
                  onBlur={() => {
                    if (studentNumber.trim()) {
                      runLookup(studentNumber)
                    }
                  }}
                  placeholder="e.g. 25883, 25678965 or 20251SEN001"
                  autoFocus
                />
                <button
                  type="button"
                  className="ghost-btn lookup-action"
                  onClick={() => runLookup(studentNumber)}
                  disabled={lookupBusy}
                >
                  {lookupBusy ? 'Checking…' : 'Find'}
                </button>
              </div>
              {lookupError ? <small className="lookup-hint error">{lookupError}</small> : null}
              {lookupInfo ? <small className="lookup-hint info">{lookupInfo}</small> : null}
            </label>

            {lookupResult?.studentNumber === normalizeStudentId(studentNumber) ? (
              <div className="upload-record-linked">
                <span className="upload-record-label">Student found</span>
                <strong>{lookupResult.studentName}</strong>
                <span className="upload-record-meta">{lookupResult.studentNumber}</span>
                {lookupResult.folderId ? (
                  <button
                    type="button"
                    className="ghost-btn tiny-btn"
                    onClick={() => onOpenFolder?.(lookupResult.folderId, lookupResult.studentNumber)}
                  >
                    <FolderIcon className="icon" />
                    Open folder
                  </button>
                ) : null}
              </div>
            ) : entryMode === 'new' && studentNumber.trim() ? (
              <label className="upload-record-input">
                <span>Student full name (link this ID)</span>
                <input
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Full name for this student ID"
                />
              </label>
            ) : null}

            {placementSummary ? (
              <p className="inline-note">
                Student folder will be created under {placementSummary} if it does not already exist.
              </p>
            ) : null}
          </section>
        )}

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
          {zipPhase ? (
            <>
              {!insideStudentTree ? (
                <button type="button" className="ghost-btn" onClick={onBackToLink} disabled={busy}>
                  Back
                </button>
              ) : null}
              <button type="button" className="primary-btn" onClick={onChooseZip} disabled={busy}>
                <UploadIcon className="icon" />
                {busy ? 'Checking ZIP…' : 'Choose ZIP file'}
              </button>
            </>
          ) : (
            <button type="button" className="primary-btn" onClick={handleConfirm} disabled={busy || lookupBusy}>
              {insideStudentTree ? 'Continue to ZIP' : (
                <>
                  <CheckIcon className="icon" />
                  Link student & continue
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
