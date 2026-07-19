import React, { useEffect, useMemo, useState } from 'react'
import { commitFolderImport } from '../api'
import { validateStaffFolderName } from '../studentId'

function emptyRow(item) {
  return {
    originalPath: item.originalPath,
    targetFolderName: item.suggestedFolderName || '',
    title: item.proposedTitle || '',
    category: '',
    linkLegacy: false,
    legacyFolderName: extractLegacyFolderName(item),
    suggestedStudentNumber: item.suggestedStudentNumber || '',
    suggestedStudentName: item.suggestedStudentName || '',
    warnings: item.warnings || [],
    conflicts: item.conflicts || [],
    resolutionSource: item.resolutionSource || ''
  }
}

function extractLegacyFolderName(item) {
  const warning = (item.warnings || []).find((entry) => entry.startsWith('Legacy student folder name detected:'))
  if (warning) {
    return warning.replace('Legacy student folder name detected:', '').trim()
  }
  const segment = String(item.originalPath || '').split(/[\\/]/).find((part) => /^\d{4,}$/.test(part))
  return segment || ''
}

export default function ImportPreviewWizard({
  open,
  folderId,
  preview,
  importPayload,
  categoryOptions = [],
  onClose,
  onCommitted,
  onNotify
}) {
  const [rows, setRows] = useState([])
  const [validateTemplates, setValidateTemplates] = useState(false)
  const [busy, setBusy] = useState(false)
  const [defaultCategory, setDefaultCategory] = useState('')
  const [step, setStep] = useState('audit')

  useEffect(() => {
    if (!open || !preview) {
      return
    }
    setDefaultCategory(preview.defaultCategory || categoryOptions[0]?.value || '')
    setRows((preview.items || []).map((item) => emptyRow(item)))
    setStep('audit')
  }, [open, preview, categoryOptions])

  const importableRows = useMemo(
    () => rows.filter((row) => row.targetFolderName.trim()),
    [rows]
  )

  const studentGroups = useMemo(() => {
    const groups = new Map()
    rows.forEach((row, index) => {
      const key = row.targetFolderName.trim() || 'Unassigned'
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key).push({ row, index })
    })
    return [...groups.entries()]
  }, [rows])

  if (!open || !preview) {
    return null
  }

  function updateRow(index, patch) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function applyAllSuggestions() {
    setRows((current) => current.map((row, index) => ({
      ...row,
      targetFolderName: preview.items[index]?.suggestedFolderName || row.targetFolderName
    })))
  }

  function toggleLinkLegacy(index, enabled) {
    const row = rows[index]
    const legacyName = row.legacyFolderName
    if (enabled && legacyName) {
      updateRow(index, { linkLegacy: true, targetFolderName: legacyName })
      return
    }
    updateRow(index, {
      linkLegacy: false,
      targetFolderName: preview.items[index]?.suggestedFolderName || row.targetFolderName
    })
  }

  async function handleCommit() {
    for (const row of importableRows) {
      if (!row.linkLegacy) {
        const namingError = validateStaffFolderName(row.targetFolderName)
        if (namingError) {
          onNotify?.(`Fix folder name for ${row.originalPath}: ${namingError}`)
          return
        }
      }
      if (row.conflicts?.length) {
        onNotify?.(`Resolve conflicts for ${row.originalPath}: ${row.conflicts.join(' ')}`)
        return
      }
    }

    setBusy(true)
    try {
      const result = await commitFolderImport(
        folderId,
        {
          mappings: importableRows.map((row) => ({
            originalPath: row.originalPath,
            targetFolderName: row.targetFolderName.trim(),
            title: row.title.trim() || null,
            category: row.category || defaultCategory || null
          })),
          defaultCategory: defaultCategory || null,
          validateTemplates,
          linkLegacy: importableRows.some((row) => row.linkLegacy)
        },
        importPayload
      )
      onCommitted?.(result)
      onClose?.()
    } catch (err) {
      onNotify?.(err.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal import-preview-modal" onClick={(event) => event.stopPropagation()} role="presentation">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Import preview</p>
            <h2>Review folder mappings before import</h2>
            <p className="upload-modal-subtitle">
              Audit the ZIP, group files by student, optionally link legacy IDs, then confirm import.
            </p>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close import preview">×</button>
        </div>

        <div className="import-preview-tabs">
          <button type="button" className={`ghost-btn ${step === 'audit' ? 'active' : ''}`} onClick={() => setStep('audit')}>ZIP audit</button>
          <button type="button" className={`ghost-btn ${step === 'mappings' ? 'active' : ''}`} onClick={() => setStep('mappings')}>Student mappings</button>
          <button type="button" className={`ghost-btn ${step === 'confirm' ? 'active' : ''}`} onClick={() => setStep('confirm')}>Confirm</button>
        </div>

        {step === 'audit' ? (
          <section className="import-preview-audit">
            <div className="import-preview-audit-stats">
              <span><strong>{preview.totalFiles}</strong> files scanned</span>
              <span><strong>{preview.importableCount}</strong> importable PDFs</span>
              <span><strong>{preview.skippedCount}</strong> skipped</span>
            </div>
            {(preview.zipAudit || []).length ? (
              <div className="table-shell import-preview-audit-table">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Path</th>
                      <th>Size</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.zipAudit.map((entry) => (
                      <tr key={entry.relativePath}>
                        <td>{entry.relativePath}</td>
                        <td>{entry.sizeBytes ? `${Math.round(entry.sizeBytes / 1024)} KB` : '—'}</td>
                        <td>{entry.action}{entry.note ? ` · ${entry.note}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <ul className="import-preview-audit-messages">
              {(preview.messages || []).length ? preview.messages.map((message) => (
                <li key={message}>{message}</li>
              )) : (
                <li>No ZIP audit warnings.</li>
              )}
            </ul>
          </section>
        ) : null}

        {step === 'mappings' ? (
          <>
            <div className="import-preview-toolbar">
              <label>
                <span>Default category</span>
                <select value={defaultCategory} onChange={(event) => setDefaultCategory(event.target.value)}>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="import-preview-toggle">
                <input
                  type="checkbox"
                  checked={validateTemplates}
                  onChange={(event) => setValidateTemplates(event.target.checked)}
                />
                <span>Validate documents against templates</span>
              </label>
              <button type="button" className="ghost-btn" onClick={applyAllSuggestions}>Apply all suggestions</button>
            </div>

            <div className="import-preview-groups">
              {studentGroups.map(([studentKey, entries]) => (
                <section key={studentKey} className="import-preview-group">
                  <header>
                    <strong>{studentKey}</strong>
                    <span>{entries.length} file{entries.length === 1 ? '' : 's'}</span>
                  </header>
                  {entries.map(({ row, index }) => (
                    <div key={row.originalPath} className="import-preview-group-row">
                      <span>{row.originalPath}</span>
                      <input
                        value={row.targetFolderName}
                        onChange={(event) => updateRow(index, { targetFolderName: event.target.value, linkLegacy: false })}
                        placeholder="20251SENG041"
                      />
                      {row.legacyFolderName ? (
                        <label className="import-preview-toggle">
                          <input
                            type="checkbox"
                            checked={row.linkLegacy}
                            onChange={(event) => toggleLinkLegacy(index, event.target.checked)}
                          />
                          <span>Link legacy ID ({row.legacyFolderName})</span>
                        </label>
                      ) : null}
                      <input
                        value={row.title}
                        onChange={(event) => updateRow(index, { title: event.target.value })}
                        placeholder="Document title"
                      />
                      {row.warnings?.map((warning) => (
                        <span key={warning} className="import-preview-badge warning">{warning}</span>
                      ))}
                      {row.conflicts?.map((conflict) => (
                        <span key={conflict} className="import-preview-badge conflict">{conflict}</span>
                      ))}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </>
        ) : null}

        {step === 'confirm' ? (
          <section className="import-preview-confirm">
            <p>
              Import <strong>{importableRows.length}</strong> document{importableRows.length === 1 ? '' : 's'} into
              {' '}<strong>{studentGroups.length}</strong> student folder{studentGroups.length === 1 ? '' : 's'}.
            </p>
            <ul>
              {importableRows.slice(0, 8).map((row) => (
                <li key={row.originalPath}>{row.originalPath} → {row.targetFolderName}{row.linkLegacy ? ' (legacy ID)' : ''}</li>
              ))}
              {importableRows.length > 8 ? <li>…and {importableRows.length - 8} more</li> : null}
            </ul>
          </section>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
          {step !== 'confirm' ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => setStep(step === 'audit' ? 'mappings' : 'confirm')}
              disabled={!importableRows.length}
            >
              Continue
            </button>
          ) : (
            <button type="button" className="primary-btn btn-success" onClick={handleCommit} disabled={busy || !importableRows.length}>
              {busy ? 'Importing…' : `Import ${importableRows.length} document${importableRows.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
