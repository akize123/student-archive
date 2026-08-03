import React, { useEffect, useMemo, useRef, useState } from 'react'
import { commitFolderImport, lookupStudent } from '../api'
import { validateStaffFolderName } from '../studentId'
import { validatePdfFile } from '../fileSignatures'
import { fileNameFromImportPath, resolveImportFile } from '../importFileResolver'
import { CheckIcon, FolderIcon, ArrowRightIcon, XIcon } from './Icons'
import DocumentTitlePicker from './DocumentTitlePicker'
import DocumentTypeCombobox from './DocumentTypeCombobox'
import ImportDocumentPreviewModal from './ImportDocumentPreviewModal'
import ImportFileRowActions from './ImportFileRowActions'
import { inferCategoryFromDocumentType, isDocumentTitleComplete, resolveImportDocumentType, rowNeedsDocumentTypeAssignment } from '../studentDocumentTypes'

const RESOLUTION_LABELS = {
  folderSegment: 'Detected from folder path',
  fileName: 'Detected from file name',
  pdfText: 'Detected from PDF text',
  inferredFromContext: 'Suggested from semester context',
  manualRequired: 'Student ID required',
  importContext: 'Linked from import location'
}

function buildImportRow(item, userRole) {
  const legacyFolderName = extractLegacyFolderName(item)
  const suggested = String(item.suggestedFolderName || '').trim()
  const useLegacy = !suggested && Boolean(legacyFolderName)
  return {
    originalPath: item.originalPath,
    targetFolderName: suggested || legacyFolderName || '',
    title: resolveImportDocumentType({
      originalPath: item.originalPath,
      proposedTitle: item.proposedTitle,
      userRole
    }),
    category: '',
    linkLegacy: useLegacy,
    legacyFolderName,
    suggestedStudentNumber: item.suggestedStudentNumber || '',
    suggestedStudentName: item.suggestedStudentName || '',
    warnings: item.warnings || [],
    conflicts: item.conflicts || [],
    resolutionSource: item.resolutionSource || '',
    studentExists: Boolean(item.studentExists),
    existingStudentName: item.existingStudentName || '',
    existingFolderId: item.existingFolderId || null,
    folderExistsHere: Boolean(item.folderExistsHere),
    validationVerified: item.validationVerified,
    scanSummary: item.scanSummary || '',
    scanSignals: item.scanSignals || [],
    scanPreview: item.scanPreview || ''
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

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase()
}

function resolutionLabel(source) {
  return RESOLUTION_LABELS[source] || 'Manual link'
}

export default function ImportPreviewWizard({
  open,
  folderId,
  folderName,
  preview,
  importPayload,
  importLinkContext,
  categoryOptions = [],
  userRole = 'REGISTRAR',
  onClose,
  onCommitted,
  onOpenFolder,
  onNotify
}) {
  const [rows, setRows] = useState([])
  const [validateTemplates, setValidateTemplates] = useState(false)
  const [busy, setBusy] = useState(false)
  const [defaultDocumentType, setDefaultDocumentType] = useState('')
  const [step, setStep] = useState('link')
  const [bulkStudentId, setBulkStudentId] = useState('')
  const [lookupBusyKey, setLookupBusyKey] = useState('')
  const [fileOverrides, setFileOverrides] = useState({})
  const [previewState, setPreviewState] = useState({ open: false, title: '', file: null })
  const [previewBusyPath, setPreviewBusyPath] = useState('')
  const [replaceTargetPath, setReplaceTargetPath] = useState('')
  const [wizardAlert, setWizardAlert] = useState('')
  const replaceInputRef = useRef(null)

  function showWizardAlert(message) {
    if (!message) {
      setWizardAlert('')
      return
    }
    setWizardAlert(message)
  }

  useEffect(() => {
    if (!open || !preview) {
      return
    }
    const lockedStudentNumber = normalizeStudentId(
      importLinkContext?.studentNumber || preview.linkedStudentNumber || ''
    )
    setDefaultDocumentType('')
    setFileOverrides({})
    setPreviewState({ open: false, title: '', file: null })
    setReplaceTargetPath('')
    setRows((preview.items || []).map((item) => {
      const row = buildImportRow(item, userRole)
      if (lockedStudentNumber) {
        return {
          ...row,
          targetFolderName: lockedStudentNumber,
          resolutionSource: 'importContext'
        }
      }
      return row
    }))
    setBulkStudentId('')
    setStep('link')
    setWizardAlert('')
  }, [open, preview, categoryOptions, importLinkContext, userRole])

  const lockedStudentNumber = normalizeStudentId(
    importLinkContext?.studentNumber || preview?.linkedStudentNumber || ''
  )
  const lockedStudentName = String(
    importLinkContext?.studentName || preview?.linkedStudentName || ''
  ).trim()
  const studentLinkLocked = Boolean(lockedStudentNumber)
  const insideStudentTree = Boolean(importLinkContext?.insideStudentTree || preview?.insideStudentTree)

  const importableRows = useMemo(
    () => rows.filter((row) => row.targetFolderName.trim()),
    [rows]
  )

  const unassignedCount = useMemo(
    () => rows.filter((row) => !row.targetFolderName.trim()).length,
    [rows]
  )

  const studentGroups = useMemo(() => {
    const groups = new Map()
    rows.forEach((row, index) => {
      const key = row.targetFolderName.trim() || '__unassigned__'
      if (!groups.has(key)) {
        groups.set(key, {
          studentId: row.targetFolderName.trim(),
          rows: []
        })
      }
      groups.get(key).rows.push({ row, index })
    })
    return [...groups.entries()]
  }, [rows])

  if (!open || !preview) {
    return null
  }

  function handleDefaultDocumentTypeChange(nextValue) {
    const trimmed = String(nextValue || '').trim()
    setDefaultDocumentType(nextValue)
    if (!trimmed) {
      return
    }
    setRows((current) => current.map((row) => (
      rowNeedsDocumentTypeAssignment(row.title)
        ? { ...row, title: trimmed }
        : row
    )))
  }

  function resolveRowTitle(row) {
    return String(row.title || defaultDocumentType || '').trim()
  }

  function resolveImportCategory(row) {
    const title = resolveRowTitle(row)
    return inferCategoryFromDocumentType(title, userRole)
      || categoryOptions[0]?.value
      || preview?.defaultCategory
      || null
  }

  function updateRow(index, patch) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function isRowReplaced(row) {
    return Boolean(fileOverrides[row.originalPath])
  }

  async function handlePreviewRow(row) {
    setPreviewBusyPath(row.originalPath)
    try {
      const file = await resolveImportFile(importPayload, row.originalPath, fileOverrides)
      if (!file) {
        showWizardAlert('Could not load this file for preview.')
        return
      }
      setPreviewState({
        open: true,
        title: fileNameFromImportPath(row.originalPath),
        file
      })
    } catch (err) {
      showWizardAlert(err.message || 'Preview failed.')
    } finally {
      setPreviewBusyPath('')
    }
  }

  function handleReplaceRow(row) {
    setReplaceTargetPath(row.originalPath)
    const input = replaceInputRef.current
    if (input) {
      input.value = ''
      input.click()
    }
  }

  async function handleReplaceSelected(event) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    const originalPath = replaceTargetPath
    setReplaceTargetPath('')
    if (!selected || !originalPath) {
      return
    }
    const validation = await validatePdfFile(selected)
    if (!validation.ok) {
      showWizardAlert(validation.message || 'Choose a valid PDF file.')
      return
    }
    setFileOverrides((current) => ({
      ...current,
      [originalPath]: selected
    }))
    showWizardAlert(`Replaced "${fileNameFromImportPath(originalPath)}" with "${selected.name}".`)
  }

  function renderImportFileRow(row, index, options = {}) {
    const { showStudentInput = false, showTitle = true, showLegacy = true } = options
    return (
      <div key={row.originalPath} className="import-preview-file-row">
        <div className="import-preview-file-main">
          <div className="import-preview-file-meta">
            <strong>{fileNameFromImportPath(row.originalPath)}</strong>
            <span>{row.originalPath}</span>
            {row.resolutionSource ? (
              <span className="import-preview-source">{resolutionLabel(row.resolutionSource)}</span>
            ) : null}
          </div>
          <ImportFileRowActions
            replaced={isRowReplaced(row)}
            previewBusy={previewBusyPath === row.originalPath}
            onPreview={() => handlePreviewRow(row)}
            onReplace={() => handleReplaceRow(row)}
          />
        </div>
        {showStudentInput ? (
          <input
            value={row.targetFolderName}
            onChange={(event) => updateRow(index, { targetFolderName: event.target.value, linkLegacy: false })}
            onBlur={() => refreshGroupMatch('__unassigned__', row.targetFolderName)}
            placeholder="Student ID"
          />
        ) : null}
        {showTitle ? (
          <label className="import-preview-document-type">
            <span>Document type (subfolder name)</span>
            <DocumentTitlePicker
              value={row.title}
              onChange={(title) => updateRow(index, { title })}
              userRole={userRole}
              compact
              required
              customPlaceholder="e.g. Registration Form, Transcript"
            />
          </label>
        ) : null}
        {row.scanSummary ? (
          <div className={`import-preview-scan ${row.validationVerified ? 'verified' : 'rejected'}`}>
            <div className="import-preview-scan-head">
              {row.validationVerified ? <CheckIcon className="icon tiny" /> : <XIcon className="icon tiny" />}
              <strong>{row.validationVerified ? 'AUCA document confirmed' : 'Document not accepted'}</strong>
            </div>
            <p>{row.scanSummary}</p>
            {row.scanSignals?.length ? (
              <ul className="import-preview-scan-signals">
                {row.scanSignals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            ) : null}
            {row.scanPreview ? (
              <p className="import-preview-scan-preview">&ldquo;{row.scanPreview}&rdquo;</p>
            ) : null}
          </div>
        ) : null}
        {showLegacy && row.legacyFolderName ? (
          <label className="import-preview-toggle">
            <input
              type="checkbox"
              checked={row.linkLegacy}
              onChange={(event) => toggleLinkLegacy(index, event.target.checked)}
            />
            <span>Link legacy ID ({row.legacyFolderName})</span>
          </label>
        ) : null}
        {row.warnings?.map((warning) => (
          <span key={warning} className="import-preview-badge warning">{warning}</span>
        ))}
        {row.conflicts?.map((conflict) => (
          <span key={conflict} className="import-preview-badge conflict">{conflict}</span>
        ))}
      </div>
    )
  }

  function updateGroupStudentId(groupKey, nextStudentId) {
    const normalized = normalizeStudentId(nextStudentId)
    setRows((current) => current.map((row) => {
      const rowKey = row.targetFolderName.trim() || '__unassigned__'
      if (rowKey !== groupKey) {
        return row
      }
      return {
        ...row,
        targetFolderName: normalized,
        linkLegacy: false,
        studentExists: false,
        existingStudentName: '',
        existingFolderId: null,
        folderExistsHere: false
      }
    }))
  }

  async function refreshGroupMatch(groupKey, studentId) {
    const normalized = normalizeStudentId(studentId)
    if (!normalized) {
      return
    }
    setLookupBusyKey(groupKey)
    try {
      const lookup = await lookupStudent(normalized)
      setRows((current) => current.map((row) => {
        const rowKey = row.targetFolderName.trim() || '__unassigned__'
        if (rowKey !== groupKey && row.targetFolderName.trim() !== normalized) {
          return row
        }
        if (row.targetFolderName.trim() !== normalized && rowKey === '__unassigned__') {
          return row
        }
        return {
          ...row,
          targetFolderName: normalized,
          studentExists: Boolean(lookup?.found),
          existingStudentName: lookup?.studentName || row.existingStudentName || row.suggestedStudentName || '',
          existingFolderId: lookup?.folderId || row.existingFolderId || null,
          folderExistsHere: Boolean(lookup?.folderId || row.folderExistsHere)
        }
      }))
    } catch {
      // Keep manual entry even if lookup fails.
    } finally {
      setLookupBusyKey('')
    }
  }

  function applyBulkStudentId() {
    const normalized = normalizeStudentId(bulkStudentId)
    if (!normalized) {
      showWizardAlert('Enter a student ID to apply.')
      return
    }
    setRows((current) => current.map((row) => (
      row.targetFolderName.trim()
        ? row
        : {
          ...row,
          targetFolderName: normalized,
          linkLegacy: false
        }
    )))
    refreshGroupMatch('__unassigned__', normalized)
  }

  function applyAllSuggestions() {
    setRows((current) => current.map((row, index) => ({
      ...row,
      targetFolderName: preview.items[index]?.suggestedFolderName || row.targetFolderName,
      studentExists: Boolean(preview.items[index]?.studentExists),
      existingStudentName: preview.items[index]?.existingStudentName || '',
      existingFolderId: preview.items[index]?.existingFolderId || null,
      folderExistsHere: Boolean(preview.items[index]?.folderExistsHere)
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

  function handleOpenStudentFolder(folderTargetId, studentId) {
    if (!folderTargetId) {
      showWizardAlert('No student folder found yet. Import will create it under this semester.')
      return
    }
    onOpenFolder?.(folderTargetId)
    showWizardAlert(`Opened student folder ${studentId || ''}. You can continue import here or return to finish.`)
  }

  async function handleCommit() {
    const allowScanOverride = insideStudentTree && (userRole === 'REGISTRAR' || userRole === 'ADMIN')
    for (const row of importableRows) {
      if (row.validationVerified === false && !allowScanOverride) {
        showWizardAlert(row.scanSummary || `Could not confirm ${fileNameFromImportPath(row.originalPath)} as an AUCA document.`)
        return
      }
      if (!row.linkLegacy) {
        const namingError = validateStaffFolderName(row.targetFolderName)
        if (namingError) {
          showWizardAlert(`Fix folder name for ${row.originalPath}: ${namingError}`)
          return
        }
      }
      if (row.conflicts?.length) {
        showWizardAlert(`Resolve conflicts for ${row.originalPath}: ${row.conflicts.join(' ')}`)
        return
      }
      if (!isDocumentTitleComplete(resolveRowTitle(row))) {
        showWizardAlert(`Select a document type for ${row.originalPath.split(/[\\/]/).pop()}. It will be used as the subfolder name.`)
        return
      }
    }

    setBusy(true)
    try {
      const resolvedDefaultCategory = inferCategoryFromDocumentType(defaultDocumentType, userRole)
        || categoryOptions[0]?.value
        || preview?.defaultCategory
        || null
      const overrideFiles = Object.entries(fileOverrides).map(([path, file]) => ({ path, file }))
      const result = await commitFolderImport(
        folderId,
        {
          mappings: importableRows.map((row) => ({
            originalPath: row.originalPath,
            targetFolderName: (lockedStudentNumber || row.targetFolderName).trim(),
            title: resolveRowTitle(row) || null,
            category: row.category || resolveImportCategory(row) || null
          })),
          defaultCategory: resolvedDefaultCategory,
          validateTemplates,
          linkLegacy: importableRows.some((row) => row.linkLegacy),
          linkedStudentNumber: lockedStudentNumber || null,
          linkedStudentName: lockedStudentName || null
        },
        {
          ...importPayload,
          overrideFiles
        }
      )
      onCommitted?.(result)
      onClose?.()
    } catch (err) {
      showWizardAlert(err.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const linkedGroups = studentGroups.filter(([key]) => key !== '__unassigned__')
  const unassignedGroup = studentGroups.find(([key]) => key === '__unassigned__')

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal import-preview-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Import documents</p>
            <h2>Link files to student folders</h2>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close import preview">×</button>
        </div>

        {wizardAlert ? (
          <div className="import-modal-alert" role="alert">
            <div className="import-modal-alert-copy">
              <strong>Import notice</strong>
              <p>{wizardAlert}</p>
            </div>
            <button
              type="button"
              className="ghost-icon import-modal-alert-dismiss"
              onClick={() => setWizardAlert('')}
              aria-label="Dismiss message"
            >
              <XIcon className="icon" />
            </button>
          </div>
        ) : null}

        <div className="import-preview-summary">
          <div className="import-preview-stat">
            <strong>{importableRows.length}</strong>
            <span>Selected for import</span>
          </div>
          <div className="import-preview-stat muted">
            <strong>{rows.length}</strong>
            <span>Of {preview.importableCount} PDFs in ZIP</span>
          </div>
          {studentLinkLocked ? (
            <div className="import-preview-stat">
              <strong>{lockedStudentNumber}</strong>
              <span>{lockedStudentName || 'Linked student'}</span>
            </div>
          ) : (
            <>
              <div className="import-preview-stat">
                <strong>{linkedGroups.length}</strong>
                <span>Student groups</span>
              </div>
              <div className="import-preview-stat">
                <strong>{unassignedCount}</strong>
                <span>Need student ID</span>
              </div>
            </>
          )}
          {preview.skippedCount ? (
            <div className="import-preview-stat muted">
              <strong>{preview.skippedCount}</strong>
              <span>Skipped</span>
            </div>
          ) : null}
        </div>

        <div className="import-preview-tabs">
          <button type="button" className={`ghost-btn ${step === 'link' ? 'active' : ''}`} onClick={() => setStep('link')}>
            Link students
          </button>
          <button type="button" className={`ghost-btn ${step === 'audit' ? 'active' : ''}`} onClick={() => setStep('audit')}>
            File audit
          </button>
          <button type="button" className={`ghost-btn ${step === 'confirm' ? 'active' : ''}`} onClick={() => setStep('confirm')}>
            Confirm
          </button>
        </div>

        {step === 'link' ? (
          <>
            {studentLinkLocked ? (
              <section className="import-link-linked-panel">
                <p className="upload-record-linked-summary">
                  Import linked to student ID: <strong>{lockedStudentNumber}</strong>
                  {lockedStudentName ? (
                    <> · <strong className="upload-record-linked-name">{lockedStudentName}</strong></>
                  ) : null}
                </p>
                {insideStudentTree ? (
                  <p className="inline-note">
                    Files will be imported into &quot;{folderName}&quot; under this student.
                  </p>
                ) : null}
              </section>
            ) : null}

            {!studentLinkLocked ? (
            <div className="import-preview-toolbar import-preview-link-toolbar">
              <label className="import-preview-bulk">
                <span>Link unassigned files to student ID</span>
                <div className="import-preview-bulk-row">
                  <input
                    type="text"
                    value={bulkStudentId}
                    onChange={(event) => setBulkStudentId(event.target.value)}
                    placeholder="20251SENG041"
                  />
                  <button type="button" className="ghost-btn" onClick={applyBulkStudentId}>
                    Apply
                  </button>
                </div>
              </label>
              <label className="import-preview-default-type">
                <span>Default type for all files (creates subfolder)</span>
                <DocumentTypeCombobox
                  value={defaultDocumentType}
                  onChange={handleDefaultDocumentTypeChange}
                  userRole={userRole}
                  placeholder="Pick or type — applies to files without a type"
                  listId="import-default-document-type"
                />
              </label>
              <button type="button" className="ghost-btn" onClick={applyAllSuggestions}>Use all suggestions</button>
            </div>
            ) : (
              <div className="import-preview-toolbar import-preview-link-toolbar">
                <label className="import-preview-default-type">
                  <span>Default type for all files (creates subfolder)</span>
                  <DocumentTypeCombobox
                    value={defaultDocumentType}
                    onChange={handleDefaultDocumentTypeChange}
                    userRole={userRole}
                    placeholder="Pick or type — applies to files without a type"
                    listId="import-default-document-type-locked"
                  />
                </label>
              </div>
            )}

            <div className="import-preview-groups">
              {!studentLinkLocked && unassignedGroup ? (
                <section className="import-preview-group import-preview-group-unassigned">
                  <header>
                    <div>
                      <strong>Unassigned files</strong>
                      <span className="import-preview-status needs-id">Student ID required</span>
                    </div>
                    <span>{unassignedGroup[1].rows.length} file{unassignedGroup[1].rows.length === 1 ? '' : 's'}</span>
                  </header>
                  <p className="import-preview-group-help">
                    These files could not be matched automatically. Enter a student ID above or assign one per file below.
                  </p>
                  {unassignedGroup[1].rows.map(({ row, index }) => renderImportFileRow(row, index, {
                    showStudentInput: true,
                    showTitle: false,
                    showLegacy: false
                  }))}
                </section>
              ) : null}

              {studentLinkLocked ? (
                <section className="import-preview-group ready">
                  <header>
                    <div className="import-preview-group-title">
                      <strong className="import-preview-student-id">{lockedStudentNumber}</strong>
                      {lockedStudentName ? (
                        <span className="import-preview-status ok">
                          <CheckIcon className="icon" />
                          {lockedStudentName}
                        </span>
                      ) : null}
                    </div>
                    <span>{rows.length} file{rows.length === 1 ? '' : 's'}</span>
                  </header>
                  {rows.map((row, index) => renderImportFileRow(row, index))}
                </section>
              ) : linkedGroups.map(([groupKey, group]) => {
                const firstRow = group.rows[0]?.row
                const folderReady = Boolean(firstRow?.folderExistsHere || firstRow?.existingFolderId)
                const lookupBusy = lookupBusyKey === groupKey
                return (
                  <section key={groupKey} className={`import-preview-group ${folderReady ? 'ready' : ''}`}>
                    <header>
                      <div className="import-preview-group-title">
                        <input
                          className="import-preview-student-id"
                          value={group.studentId}
                          onChange={(event) => updateGroupStudentId(groupKey, event.target.value)}
                          onBlur={() => refreshGroupMatch(groupKey, group.studentId)}
                          placeholder="Student ID"
                        />
                        {firstRow?.studentExists ? (
                          <span className="import-preview-status ok">
                            <CheckIcon className="icon" />
                            {firstRow.existingStudentName || 'Student found'}
                          </span>
                        ) : (
                          <span className="import-preview-status warn">New folder will be created</span>
                        )}
                        {folderReady ? (
                          <span className="import-preview-status folder-ready">
                            <FolderIcon className="icon" />
                            Folder exists
                          </span>
                        ) : null}
                      </div>
                      <div className="import-preview-group-actions">
                        <span>{group.rows.length} file{group.rows.length === 1 ? '' : 's'}</span>
                        {firstRow?.existingFolderId ? (
                          <button
                            type="button"
                            className="ghost-btn import-preview-open-folder"
                            disabled={lookupBusy}
                            onClick={() => handleOpenStudentFolder(firstRow.existingFolderId, group.studentId)}
                          >
                            <FolderIcon className="icon" />
                            Open folder
                          </button>
                        ) : null}
                      </div>
                    </header>
                    {group.rows.map(({ row, index }) => renderImportFileRow(row, index))}
                  </section>
                )
              })}
            </div>
          </>
        ) : null}

        {step === 'audit' ? (
          <section className="import-preview-audit">
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
            ) : (
              <p className="import-preview-audit-empty">No ZIP audit entries.</p>
            )}
            <ul className="import-preview-audit-messages">
              {(preview.messages || []).length ? preview.messages.map((message) => (
                <li key={message}>{message}</li>
              )) : (
                <li>No skipped-file warnings.</li>
              )}
            </ul>
            <label className="import-preview-toggle">
              <input
                type="checkbox"
                checked={validateTemplates}
                onChange={(event) => setValidateTemplates(event.target.checked)}
              />
              <span>Validate documents against templates before import</span>
            </label>
          </section>
        ) : null}

        {step === 'confirm' ? (
          <section className="import-preview-confirm">
            <p>
              Publish <strong>{importableRows.length}</strong> document{importableRows.length === 1 ? '' : 's'} into
              {' '}<strong>{linkedGroups.length}</strong> student folder{linkedGroups.length === 1 ? '' : 's'} under {folderName || 'this location'}.
            </p>
            <ul className="import-preview-confirm-list">
              {importableRows.map((row) => (
                <li key={row.originalPath}>
                  <div className="import-preview-confirm-item">
                    <span>{fileNameFromImportPath(row.originalPath)}</span>
                    <ArrowRightIcon className="icon" />
                    <strong>{row.targetFolderName}</strong>
                    {resolveRowTitle(row) ? (
                      <span className="import-preview-confirm-type">→ {resolveRowTitle(row)}</span>
                    ) : null}
                    {isRowReplaced(row) ? <span className="import-preview-badge replaced">Replaced</span> : null}
                    {row.linkLegacy ? ' (legacy ID)' : ''}
                  </div>
                  <button
                    type="button"
                    className="ghost-btn import-file-action"
                    onClick={() => handlePreviewRow(row)}
                    disabled={previewBusyPath === row.originalPath}
                  >
                    Preview
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
          {step !== 'confirm' ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (step === 'link' && !importableRows.length) {
                  showWizardAlert('Assign at least one student ID before continuing.')
                  return
                }
                setStep(step === 'audit' ? 'confirm' : 'confirm')
              }}
              disabled={step === 'link' && !importableRows.length}
            >
              {step === 'link' ? 'Review import' : 'Continue'}
            </button>
          ) : (
            <button type="button" className="primary-btn btn-success" onClick={handleCommit} disabled={busy || !importableRows.length}>
              {busy ? 'Publishing…' : `Publish ${importableRows.length} document${importableRows.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>

        <input
          ref={replaceInputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={handleReplaceSelected}
        />

        <ImportDocumentPreviewModal
          open={previewState.open}
          title={previewState.title}
          file={previewState.file}
          onClose={() => setPreviewState({ open: false, title: '', file: null })}
        />
      </div>
    </div>
  )
}
