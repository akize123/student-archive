import React, { useEffect, useMemo, useState } from 'react'
import { CheckIcon, XIcon } from './Icons'

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase()
}

export default function ImportReviewModal({
  open,
  busy,
  folderName,
  preview,
  onClose,
  onCommit
}) {
  const [rows, setRows] = useState([])
  const [bulkStudentId, setBulkStudentId] = useState('')
  const [createMissingStudents, setCreateMissingStudents] = useState(true)

  useEffect(() => {
    if (!open || !preview?.files) {
      setRows([])
      setBulkStudentId('')
      return
    }
    setRows(preview.files.map((file) => ({
      ...file,
      studentId: file.suggestedStudentId || '',
      selected: Boolean(file.selectedByDefault)
    })))
  }, [open, preview])

  const selectedCount = useMemo(
    () => rows.filter((row) => row.selected).length,
    [rows]
  )

  if (!open) {
    return null
  }

  function updateRow(relativePath, patch) {
    setRows((current) => current.map((row) => (
      row.relativePath === relativePath ? { ...row, ...patch } : row
    )))
  }

  function applyStudentIdToSelected() {
    const normalized = normalizeStudentId(bulkStudentId)
    if (!normalized) {
      return
    }
    setRows((current) => current.map((row) => (
      row.selected ? { ...row, studentId: normalized } : row
    )))
  }

  function selectValidStructure() {
    setRows((current) => current.map((row) => ({
      ...row,
      selected: Boolean(row.structureOk)
    })))
  }

  function handleCommit() {
    const items = rows.map((row) => ({
      relativePath: row.relativePath,
      studentNumber: normalizeStudentId(row.studentId),
      selected: Boolean(row.selected),
      createStudentIfMissing: createMissingStudents
    }))
    onCommit?.({
      token: preview.token,
      items
    })
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose} role="presentation">
      <div className="modal import-review-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Import review</p>
            <h2>Review documents for {folderName}</h2>
            <p className="modal-subtitle">
              Confirm student IDs and choose which files to import. Files are converted to compressed PDFs on save.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close import review">
            <XIcon className="icon" />
          </button>
        </div>

        <div className="import-review-toolbar">
          <label>
            <span>Apply student ID to selected</span>
            <div className="import-review-bulk-row">
              <input
                type="text"
                value={bulkStudentId}
                onChange={(event) => setBulkStudentId(event.target.value)}
                placeholder="20251SEN001"
              />
              <button type="button" className="ghost-btn" onClick={applyStudentIdToSelected}>
                Apply
              </button>
            </div>
          </label>
          <button type="button" className="ghost-btn" onClick={selectValidStructure}>
            Select files with valid structure
          </button>
          <label className="import-review-checkbox">
            <input
              type="checkbox"
              checked={createMissingStudents}
              onChange={(event) => setCreateMissingStudents(event.target.checked)}
            />
            <span>Create student records when missing</span>
          </label>
        </div>

        <div className="import-review-table-wrap">
          <table className="import-review-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>File</th>
                <th>Student ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.relativePath} className={row.warning ? 'has-warning' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(row.selected)}
                      onChange={(event) => updateRow(row.relativePath, { selected: event.target.checked })}
                    />
                  </td>
                  <td>
                    <strong>{row.fileName}</strong>
                    <span>{row.relativePath}</span>
                    <span>{row.detectedFormat} · {Math.max(1, Math.round((row.sizeBytes || 0) / 1024))} KB</span>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.studentId}
                      onChange={(event) => updateRow(row.relativePath, { studentId: event.target.value })}
                      placeholder="Student ID"
                    />
                  </td>
                  <td>
                    {row.studentExists ? (
                      <span className="import-status ok">
                        <CheckIcon className="icon" />
                        {row.studentName || 'Found in archive'}
                      </span>
                    ) : (
                      <span className="import-status warn">Not found</span>
                    )}
                    {row.warning ? <span className="import-warning">{row.warning}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={busy || selectedCount === 0}
            onClick={handleCommit}
          >
            {busy ? 'Importing…' : `Import ${selectedCount} selected`}
          </button>
        </div>
      </div>
    </div>
  )
}
