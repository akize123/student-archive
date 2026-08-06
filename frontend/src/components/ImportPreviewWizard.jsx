import React, { useEffect, useMemo, useRef, useState } from 'react'
import { commitFolderImport, lookupStudent } from '../api'
import { validateStaffFolderName } from '../studentId'
import { validatePdfFile } from '../fileSignatures'
import { fileNameFromImportPath, resolveImportFile } from '../importFileResolver'
import { ArrowRightIcon, XIcon } from './Icons'
import DocumentTypeSelector from './DocumentTypeSelector'
import ImportDocumentPreviewModal, { LocalPdfPreview } from './ImportDocumentPreviewModal'
import ImportFileRowActions from './ImportFileRowActions'
import {
  buildImportRowDocumentTypeState,
  hasSubcategories,
  inferCategoryFromDocumentType,
  isDocumentTypeSelectionComplete,
  resolveDocumentTypeSelection
} from '../studentDocumentTypes'
import {
  buildDocumentIssueYearOptions,
  parseDocumentIssueTermFromFolder,
  parsePlacementAcademicYearFromFolder,
  semesterOptionsForDocumentYear,
  validateDocumentIssueTerm
} from '../documentIssueTerm'
import AcademicYearField from './AcademicYearField'

function buildImportRow(item, userRole) {
  const legacyFolderName = extractLegacyFolderName(item)
  const suggested = String(item.suggestedFolderName || '').trim()
  const useLegacy = !suggested && Boolean(legacyFolderName)
  const inferredTitle = String(item.proposedTitle || '').trim()
  const typeState = buildImportRowDocumentTypeState(inferredTitle, userRole)
  const importable = item.importable !== false
  const fileKind = String(item.fileKind || (importable ? 'PDF' : 'OTHER')).toUpperCase()
  return {
    originalPath: item.originalPath,
    targetFolderName: suggested || legacyFolderName || '',
    ...typeState,
    category: '',
    useCustomType: false,
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
    scanPreview: item.scanPreview || '',
    importable,
    fileKind,
    skipReason: item.skipReason || (importable ? '' : 'Not a PDF — only PDF files can be imported into the archive'),
    included: importable,
    uploadFileName: fileNameFromImportPath(item.originalPath),
    documentAcademicYear: '',
    documentSemester: ''
  }
}

function isRowImportable(row) {
  return Boolean(row) && row.importable !== false
}

function emptyDefaultTypeState() {
  return {
    documentType: '',
    documentSubType: '',
    customSubType: '',
    title: '',
    category: null
  }
}

function resolveRowDocumentType(row, defaultTypeState) {
  if (row.useCustomType) {
    return resolveDocumentTypeSelection(row)
  }
  return resolveDocumentTypeSelection(defaultTypeState)
}

function formatDocumentTypePath(resolved, defaultTypeState, row) {
  if (!resolved.title) {
    return 'Not classified yet'
  }
  const primary = row.useCustomType ? row.documentType : defaultTypeState.documentType
  if (primary && hasSubcategories(primary) && resolved.title !== primary) {
    return `${primary} → ${resolved.title}`
  }
  return resolved.title
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

export default function ImportPreviewWizard({
  open,
  folderId,
  folderName,
  folder = null,
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
  const [defaultTypeState, setDefaultTypeState] = useState(() => emptyDefaultTypeState())
  const [step, setStep] = useState('link')
  const [bulkStudentId, setBulkStudentId] = useState('')
  const [fileOverrides, setFileOverrides] = useState({})
  const [previewState, setPreviewState] = useState({ open: false, title: '', file: null })
  const [previewBusyPath, setPreviewBusyPath] = useState('')
  const [defaultDocumentAcademicYear, setDefaultDocumentAcademicYear] = useState('')
  const [defaultDocumentSemester, setDefaultDocumentSemester] = useState('')
  const [replaceTargetPath, setReplaceTargetPath] = useState('')
  const [wizardAlert, setWizardAlert] = useState('')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewPreviewFile, setReviewPreviewFile] = useState(null)
  const [reviewPreviewBusy, setReviewPreviewBusy] = useState(false)
  const [reviewImageUrl, setReviewImageUrl] = useState('')
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
    const issueTerm = parseDocumentIssueTermFromFolder(folder || importLinkContext?.folder)
    const placementYear = parsePlacementAcademicYearFromFolder(folder || importLinkContext?.folder)
    const allowedYears = placementYear ? buildDocumentIssueYearOptions(placementYear) : []
    const seededYear = allowedYears.includes(issueTerm.documentAcademicYear)
      ? issueTerm.documentAcademicYear
      : (placementYear || '')
    const seededSemester = seededYear && issueTerm.documentAcademicYear === seededYear
      ? (issueTerm.documentSemester || '')
      : ''
    setDefaultTypeState(emptyDefaultTypeState())
    setDefaultDocumentAcademicYear(seededYear)
    setDefaultDocumentSemester(seededSemester)
    setFileOverrides({})
    setPreviewState({ open: false, title: '', file: null })
    setReplaceTargetPath('')
    setReviewIndex(0)
    setReviewPreviewFile(null)
    setReviewImageUrl('')
    setRows((preview.items || []).map((item) => {
      const row = buildImportRow(item, userRole)
      const withIssue = {
        ...row,
        documentAcademicYear: seededYear,
        documentSemester: seededSemester
      }
      if (lockedStudentNumber) {
        return {
          ...withIssue,
          targetFolderName: lockedStudentNumber,
          resolutionSource: 'importContext'
        }
      }
      return withIssue
    }))
    setBulkStudentId('')
    setStep('link')
    setWizardAlert('')
  }, [open, preview, categoryOptions, importLinkContext, userRole, folder])

  const lockedStudentNumber = normalizeStudentId(
    importLinkContext?.studentNumber || preview?.linkedStudentNumber || ''
  )
  const lockedStudentName = String(
    importLinkContext?.studentName || preview?.linkedStudentName || ''
  ).trim()
  const studentLinkLocked = Boolean(lockedStudentNumber)
  const insideStudentTree = Boolean(importLinkContext?.insideStudentTree || preview?.insideStudentTree)
  const placementAcademicYear = parsePlacementAcademicYearFromFolder(folder || importLinkContext?.folder)
  const documentIssueYearOptions = useMemo(
    () => (placementAcademicYear ? buildDocumentIssueYearOptions(placementAcademicYear) : []),
    [placementAcademicYear]
  )

  const importableRows = useMemo(
    () => rows.filter((row) => isRowImportable(row) && row.included !== false && row.targetFolderName.trim()),
    [rows]
  )
  const skippedReviewCount = useMemo(
    () => rows.filter((row) => !isRowImportable(row)).length,
    [rows]
  )
  const removedReviewCount = useMemo(
    () => rows.filter((row) => isRowImportable(row) && row.included === false).length,
    [rows]
  )

  const studentGroups = useMemo(() => {
    const groups = new Map()
    rows.forEach((row, index) => {
      if (!isRowImportable(row)) {
        return
      }
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

  const safeReviewIndex = rows.length
    ? Math.min(Math.max(reviewIndex, 0), rows.length - 1)
    : 0
  const currentReviewRow = rows[safeReviewIndex] || null
  const currentReviewRowIndex = safeReviewIndex

  useEffect(() => {
    if (step !== 'audit' || !currentReviewRow) {
      setReviewPreviewFile(null)
      setReviewPreviewBusy(false)
      setReviewImageUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current)
        }
        return ''
      })
      return undefined
    }

    let cancelled = false
    let objectUrl = ''
    setReviewPreviewBusy(true)
    setReviewPreviewFile(null)
    setReviewImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current)
      }
      return ''
    })

    async function loadCurrentPreview() {
      try {
        const file = await resolveImportFile(importPayload, currentReviewRow.originalPath, fileOverrides)
        if (cancelled) {
          return
        }
        if (!file) {
          setReviewPreviewFile(null)
          return
        }
        if (currentReviewRow.fileKind === 'IMAGE' || String(file.type || '').startsWith('image/')) {
          objectUrl = URL.createObjectURL(file)
          setReviewImageUrl(objectUrl)
          setReviewPreviewFile(null)
        } else if (currentReviewRow.fileKind === 'PDF' || String(file.type || '') === 'application/pdf') {
          setReviewPreviewFile(file)
        } else {
          setReviewPreviewFile(null)
        }
      } catch {
        if (!cancelled) {
          setReviewPreviewFile(null)
        }
      } finally {
        if (!cancelled) {
          setReviewPreviewBusy(false)
        }
      }
    }

    loadCurrentPreview()
    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [step, currentReviewRow?.originalPath, currentReviewRow?.fileKind, fileOverrides, importPayload])

  useEffect(() => {
    if (rows.length && reviewIndex > rows.length - 1) {
      setReviewIndex(rows.length - 1)
    }
  }, [rows.length, reviewIndex])

  if (!open || !preview) {
    return null
  }

  function handleDefaultTypeChange(next) {
    setDefaultTypeState(next)
    setRows((current) => current.map((row) => (
      !isRowImportable(row) || row.useCustomType || row.included === false
        ? row
        : {
          ...row,
          documentType: next.documentType,
          documentSubType: next.documentSubType,
          customSubType: next.customSubType,
          title: next.title,
          category: next.category
        }
    )))
  }

  function applyDefaultTypeToAll() {
    if (!isDocumentTypeSelectionComplete(defaultTypeState)) {
      showWizardAlert('Choose a complete document type (and sub-category if required) before applying to all files.')
      return
    }
    setRows((current) => current.map((row) => (
      !isRowImportable(row) || row.included === false
        ? row
        : {
          ...row,
          useCustomType: false,
          documentType: defaultTypeState.documentType,
          documentSubType: defaultTypeState.documentSubType,
          customSubType: defaultTypeState.customSubType,
          title: defaultTypeState.title,
          category: defaultTypeState.category
        }
    )))
  }

  function resolveRowTitle(row) {
    return resolveRowDocumentType(row, defaultTypeState).title
  }

  function resolveImportCategory(row) {
    const resolved = resolveRowDocumentType(row, defaultTypeState)
    return resolved.category
      || inferCategoryFromDocumentType(resolved.title, userRole)
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

  function applyDefaultDocumentIssueTerm() {
    if (!defaultDocumentAcademicYear || !defaultDocumentSemester) {
      showWizardAlert('Enter a default document academic year and semester first.')
      return
    }
    const issueError = validateDocumentIssueTerm(
      defaultDocumentAcademicYear,
      defaultDocumentSemester,
      { minAcademicYear: placementAcademicYear }
    )
    if (issueError) {
      showWizardAlert(issueError)
      return
    }
    setRows((current) => current.map((row) => (
      !isRowImportable(row) || row.included === false
        ? row
        : {
          ...row,
          documentAcademicYear: defaultDocumentAcademicYear,
          documentSemester: defaultDocumentSemester
        }
    )))
  }

  function toggleRowIncluded(index) {
    const row = rows[index]
    if (!isRowImportable(row)) {
      return
    }
    const currentlyExcluded = row?.included === false
    updateRow(index, { included: currentlyExcluded })
    if (!currentlyExcluded && index === safeReviewIndex && index < rows.length - 1) {
      setReviewIndex(index + 1)
    }
  }

  function goToPreviousReviewFile() {
    setReviewIndex((current) => Math.max(0, current - 1))
  }

  function goToNextReviewFile() {
    setReviewIndex((current) => Math.min(rows.length - 1, current + 1))
  }

  function renderImportFileRow(row, index, options = {}) {
    const {
      showStudentInput = false,
      showClassification = true,
      showLegacy = true,
      showIssueTerm = false,
      showRename = true,
      showScan = false
    } = options
    const issueSemesterOptions = semesterOptionsForDocumentYear(row.documentAcademicYear)
    const resolvedType = resolveRowDocumentType(row, defaultTypeState)
    const typePathLabel = formatDocumentTypePath(resolvedType, defaultTypeState, row)
    const rowImportable = isRowImportable(row)
    return (
      <div key={row.originalPath} className={`import-preview-file-row${row.included === false || !rowImportable ? ' is-excluded' : ''}`}>
        <div className="import-preview-file-main">
          <div className="import-preview-file-meta">
            <strong>{row.uploadFileName || fileNameFromImportPath(row.originalPath)}</strong>
            {!rowImportable ? (
              <span className="import-preview-badge warning">Cannot import</span>
            ) : null}
            {showScan && rowImportable && row.validationVerified != null ? (
              <span className={`import-preview-scan-chip ${row.validationVerified ? 'verified' : 'rejected'}`}>
                {row.validationVerified ? 'Verified' : 'Needs review'}
              </span>
            ) : null}
          </div>
          {rowImportable ? (
            <ImportFileRowActions
              replaced={isRowReplaced(row)}
              excluded={row.included === false}
              previewBusy={previewBusyPath === row.originalPath}
              onPreview={() => handlePreviewRow(row)}
              onReplace={() => handleReplaceRow(row)}
              onRemove={() => toggleRowIncluded(index)}
            />
          ) : null}
        </div>
        {!rowImportable && row.skipReason ? (
          <p className="import-review-skip-reason">{row.skipReason}</p>
        ) : null}

        {showIssueTerm && rowImportable ? (
          <div className="import-preview-issue-term">
            <AcademicYearField
              label="Document issue year"
              value={row.documentAcademicYear}
              onChange={(year) => updateRow(index, { documentAcademicYear: year, documentSemester: '' })}
              allowedYears={documentIssueYearOptions}
              allowAdd={false}
              helperText={placementAcademicYear
                ? `Year the document was issued. From ${placementAcademicYear} onward.`
                : 'Year the document was issued.'}
            />
            <label>
              <span>Document issue semester</span>
              <select
                value={row.documentSemester}
                onChange={(event) => updateRow(index, { documentSemester: event.target.value })}
                disabled={!row.documentAcademicYear || row.included === false}
              >
                <option value="">Select semester</option>
                {issueSemesterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {showClassification && rowImportable && row.included !== false ? (
          <div className="import-preview-classification">
            {!row.useCustomType ? (
              <div className="import-type-summary-row">
                <span className="import-type-summary-label">Folder</span>
                <span className="import-type-summary-value">{typePathLabel}</span>
                <button
                  type="button"
                  className="ghost-btn tiny-btn"
                  onClick={() => updateRow(index, {
                    useCustomType: true,
                    documentType: row.documentType || defaultTypeState.documentType,
                    documentSubType: row.documentSubType || defaultTypeState.documentSubType,
                    customSubType: row.customSubType || defaultTypeState.customSubType
                  })}
                >
                  Customize
                </button>
              </div>
            ) : (
              <div className="import-type-custom-panel">
                <div className="import-type-custom-head">
                  <strong>Custom type for this file</strong>
                  <button
                    type="button"
                    className="ghost-btn tiny-btn"
                    onClick={() => updateRow(index, { useCustomType: false })}
                  >
                    Use default
                  </button>
                </div>
                <DocumentTypeSelector
                  documentType={row.documentType}
                  documentSubType={row.documentSubType}
                  customSubType={row.customSubType}
                  onChange={(next) => updateRow(index, { ...next, useCustomType: true })}
                  userRole={userRole}
                  compact
                />
              </div>
            )}
          </div>
        ) : null}

        {showRename && rowImportable ? (
          <label className="import-preview-rename">
            <span>Rename file</span>
            <input
              value={row.uploadFileName || ''}
              onChange={(event) => updateRow(index, { uploadFileName: event.target.value })}
              disabled={row.included === false}
              placeholder={fileNameFromImportPath(row.originalPath)}
            />
          </label>
        ) : null}
        {showStudentInput && rowImportable ? (
          <input
            value={row.targetFolderName}
            onChange={(event) => updateRow(index, { targetFolderName: event.target.value, linkLegacy: false })}
            onBlur={() => refreshGroupMatch('__unassigned__', row.targetFolderName)}
            placeholder="Student ID"
          />
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

  async function handleCommit() {
    const allowScanOverride = insideStudentTree && (
      userRole === 'REGISTRAR'
      || userRole === 'FINANCE'
      || userRole === 'DEAN_OF_FACULTY'
      || userRole === 'ADMIN'
    )
    for (const row of importableRows) {
      const issueError = validateDocumentIssueTerm(
        row.documentAcademicYear,
        row.documentSemester,
        { minAcademicYear: placementAcademicYear }
      )
      if (issueError) {
        showWizardAlert(`${fileNameFromImportPath(row.originalPath)}: ${issueError}`)
        return
      }
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
      if (!isDocumentTypeSelectionComplete(row.useCustomType ? row : defaultTypeState)) {
        const typeLabel = row.useCustomType ? row.documentType : defaultTypeState.documentType
        showWizardAlert(`Classify ${fileNameFromImportPath(row.originalPath)} — choose document type${hasSubcategories(typeLabel) ? ' and sub-category' : ''}.`)
        return
      }
    }

    setBusy(true)
    try {
      const resolvedDefaultCategory = defaultTypeState.category
        || inferCategoryFromDocumentType(defaultTypeState.title, userRole)
        || categoryOptions[0]?.value
        || preview?.defaultCategory
        || null
      const overrideFiles = Object.entries(fileOverrides).map(([path, file]) => ({ path, file }))
      const result = await commitFolderImport(
        folderId,
        {
          mappings: importableRows.map((row) => {
            const resolved = resolveRowDocumentType(row, defaultTypeState)
            return {
              originalPath: row.originalPath,
              targetFolderName: (lockedStudentNumber || row.targetFolderName).trim(),
              title: resolved.title || null,
              documentTypeLabel: resolved.documentTypeLabel || row.documentType || defaultTypeState.documentType || null,
              category: row.category || resolveImportCategory(row) || null,
              academicYear: String(row.documentAcademicYear || '').trim() || null,
              semester: String(row.documentSemester || '').trim() || null,
              uploadFileName: String(row.uploadFileName || '').trim() || null
            }
          }),
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
  const stepTitle = step === 'link'
    ? (studentLinkLocked ? 'Classify documents' : 'Link students')
    : step === 'audit'
      ? 'Review files'
      : 'Confirm import'
  const currentReviewImportable = isRowImportable(currentReviewRow)
  const stepSubtitle = step === 'link'
    ? (studentLinkLocked
      ? 'Choose document issue year and semester first, then document type (Issue year → Semester → Student → Type).'
      : 'Assign each file to a student ID. Then choose issue year, semester, and document type.')
    : step === 'audit'
      ? (!currentReviewImportable
        ? `File ${safeReviewIndex + 1} of ${rows.length} · This file will not be imported (not a PDF)`
        : (rows.length > 1
          ? `Review file ${safeReviewIndex + 1} of ${rows.length}. Remove any wrong file before continuing.`
          : 'Preview this file. Remove it if it does not belong in this import.'))
      : 'Confirm folders: Year → Semester → Student → Document type, then publish.'

  function canContinueFromLink() {
    if (!importableRows.length) {
      showWizardAlert(studentLinkLocked
        ? 'Keep at least one file selected for import.'
        : 'Assign at least one student ID before continuing.')
      return false
    }
    if (!isDocumentTypeSelectionComplete(defaultTypeState)) {
      showWizardAlert(hasSubcategories(defaultTypeState.documentType)
        ? 'Choose a document type and sub-category.'
        : 'Choose a document type.')
      return false
    }
    const issueError = validateDocumentIssueTerm(
      defaultDocumentAcademicYear,
      defaultDocumentSemester,
      { minAcademicYear: placementAcademicYear }
    )
    if (issueError) {
      showWizardAlert(issueError)
      return false
    }
    applyDefaultDocumentIssueTerm()
    applyDefaultTypeToAll()
    return true
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal import-preview-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Import Documents</p>
            <h2>{stepTitle}</h2>
            <p className="import-step-subtitle">{stepSubtitle}</p>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Close import preview">×</button>
        </div>

        {wizardAlert ? (
          <div className="import-modal-alert" role="alert">
            <div className="import-modal-alert-copy">
              <strong>Notice</strong>
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

        <div className="import-preview-tabs">
          <button type="button" className={`ghost-btn ${step === 'link' ? 'active' : ''}`} onClick={() => setStep('link')}>
            {studentLinkLocked ? '1. Classify' : '1. Link'}
          </button>
          <button type="button" className={`ghost-btn ${step === 'audit' ? 'active' : ''}`} onClick={() => setStep('audit')}>
            2. Review
          </button>
          <button type="button" className={`ghost-btn ${step === 'confirm' ? 'active' : ''}`} onClick={() => setStep('confirm')}>
            3. Confirm
          </button>
        </div>

        {step === 'link' ? (
          <div className="import-link-step">
            {studentLinkLocked ? (
              <p className="import-student-line">
                Student <strong>{lockedStudentNumber}</strong>
                {lockedStudentName ? <> · {lockedStudentName}</> : null}
              </p>
            ) : (
              <div className="import-preview-toolbar import-preview-link-toolbar">
                <label className="import-preview-bulk">
                  <span>Student ID for unassigned files</span>
                  <div className="import-preview-bulk-row">
                    <input
                      type="text"
                      value={bulkStudentId}
                      onChange={(event) => setBulkStudentId(event.target.value)}
                      placeholder="20251SENG041"
                    />
                    <button type="button" className="ghost-btn" onClick={applyBulkStudentId}>Apply</button>
                    <button type="button" className="ghost-btn" onClick={applyAllSuggestions}>Use suggestions</button>
                  </div>
                </label>
              </div>
            )}

            <section className="import-defaults-panel">
              <div className="import-issue-term-block">
                <div className="import-issue-term-head">
                  <p className="eyebrow">Document issue term</p>
                  <strong>Year and semester when this document was issued — these folders come before document type.</strong>
                </div>
                <div className="import-preview-issue-term">
                  <AcademicYearField
                    label="Document issue year"
                    value={defaultDocumentAcademicYear}
                    onChange={(year) => {
                      setDefaultDocumentAcademicYear(year)
                      setDefaultDocumentSemester('')
                    }}
                    allowedYears={documentIssueYearOptions}
                    allowAdd={false}
                    helperText={placementAcademicYear
                      ? `Issue year folder under the student path. From ${placementAcademicYear} (${documentIssueYearOptions.join(', ')}).`
                      : 'Year the document was issued (folder before document type).'}
                  />
                  <label>
                    <span>Document issue semester</span>
                    <select
                      value={defaultDocumentSemester}
                      onChange={(event) => setDefaultDocumentSemester(event.target.value)}
                      disabled={!defaultDocumentAcademicYear}
                    >
                      <option value="">Select semester</option>
                      {semesterOptionsForDocumentYear(defaultDocumentAcademicYear).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <small className="lookup-hint info">Semester the document was issued (e.g. 2025/1), before document type.</small>
                  </label>
                </div>
              </div>
              <p className="import-folder-path-hint">
                Folder order:{' '}
                <strong>Issue year</strong> → <strong>Issue semester</strong> → <strong>Student</strong> → <strong>Document type</strong>
                {hasSubcategories(defaultTypeState.documentType) ? <> → <strong>Subcategory</strong></> : null}
                . Existing folders are reused.
              </p>
              <DocumentTypeSelector
                documentType={defaultTypeState.documentType}
                documentSubType={defaultTypeState.documentSubType}
                customSubType={defaultTypeState.customSubType}
                onChange={handleDefaultTypeChange}
                userRole={userRole}
              />
            </section>

            {!studentLinkLocked ? (
              <div className="import-preview-groups">
                {unassignedGroup ? (
                  <section className="import-preview-group import-preview-group-unassigned">
                    <header>
                      <strong>Need student ID</strong>
                      <span>{unassignedGroup[1].rows.length}</span>
                    </header>
                    {unassignedGroup[1].rows.map(({ row, index }) => renderImportFileRow(row, index, {
                      showStudentInput: true,
                      showClassification: false,
                      showLegacy: false,
                      showRename: false,
                      showScan: false
                    }))}
                  </section>
                ) : null}
                {linkedGroups.map(([groupKey, group]) => {
                  const firstRow = group.rows[0]?.row
                  return (
                    <section key={groupKey} className="import-preview-group ready">
                      <header>
                        <input
                          className="import-preview-student-id"
                          value={group.studentId}
                          onChange={(event) => updateGroupStudentId(groupKey, event.target.value)}
                          onBlur={() => refreshGroupMatch(groupKey, group.studentId)}
                          placeholder="Student ID"
                        />
                        <span>{group.rows.length} file{group.rows.length === 1 ? '' : 's'}</span>
                      </header>
                      {firstRow?.existingStudentName ? (
                        <span className="import-preview-status ok">{firstRow.existingStudentName}</span>
                      ) : null}
                    </section>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 'audit' ? (
          <section className="import-preview-audit import-review-one-by-one">
            {rows.length ? (
              <>
                <div className="import-review-progress">
                  <strong>File {safeReviewIndex + 1} of {rows.length}</strong>
                  <span>
                    {importableRows.length} PDF{importableRows.length === 1 ? '' : 's'} kept
                    {skippedReviewCount ? ` · ${skippedReviewCount} cannot import` : ''}
                    {removedReviewCount ? ` · ${removedReviewCount} removed` : ''}
                  </span>
                </div>

                <div className="import-review-dots" role="tablist" aria-label="Files in ZIP">
                  {rows.map((row, index) => (
                    <button
                      key={row.originalPath}
                      type="button"
                      role="tab"
                      aria-selected={index === safeReviewIndex}
                      className={`import-review-dot${index === safeReviewIndex ? ' is-active' : ''}${!isRowImportable(row) || row.included === false ? ' is-excluded' : ''}${!isRowImportable(row) ? ' is-skipped' : ''}`}
                      onClick={() => setReviewIndex(index)}
                      title={row.uploadFileName || fileNameFromImportPath(row.originalPath)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <div className={`import-review-current${!currentReviewImportable || currentReviewRow?.included === false ? ' is-excluded' : ''}`}>
                  <div className="import-review-preview-pane">
                    {reviewPreviewBusy ? (
                      <p className="document-viewer-status">Loading preview…</p>
                    ) : reviewImageUrl ? (
                      <img
                        className="import-review-image-preview"
                        src={reviewImageUrl}
                        alt={currentReviewRow?.uploadFileName || fileNameFromImportPath(currentReviewRow?.originalPath) || 'Image preview'}
                      />
                    ) : reviewPreviewFile ? (
                      <LocalPdfPreview
                        pdfBlob={reviewPreviewFile}
                        title={currentReviewRow?.uploadFileName || fileNameFromImportPath(currentReviewRow?.originalPath)}
                      />
                    ) : currentReviewRow && !currentReviewImportable ? (
                      <div className="import-review-unsupported">
                        <strong>Cannot preview this file</strong>
                        <p>{currentReviewRow.skipReason || 'Not a PDF — only PDF files can be imported into the archive'}</p>
                        <span>{currentReviewRow.uploadFileName || fileNameFromImportPath(currentReviewRow.originalPath)}</span>
                      </div>
                    ) : (
                      <p className="document-viewer-status error">Unable to preview this file.</p>
                    )}
                  </div>

                  {currentReviewRow ? renderImportFileRow(currentReviewRow, currentReviewRowIndex, {
                    showClassification: currentReviewImportable,
                    showIssueTerm: currentReviewImportable,
                    showRename: currentReviewImportable,
                    showScan: currentReviewImportable,
                    showLegacy: false
                  }) : null}
                </div>

                <div className="import-review-nav">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={goToPreviousReviewFile}
                    disabled={safeReviewIndex <= 0}
                  >
                    Previous file
                  </button>
                  {currentReviewImportable ? (
                    <button
                      type="button"
                      className={`ghost-btn ${currentReviewRow?.included === false ? 'active' : ''}`}
                      onClick={() => toggleRowIncluded(currentReviewRowIndex)}
                    >
                      {currentReviewRow?.included === false ? 'Keep this file' : 'Remove this file'}
                    </button>
                  ) : (
                    <span className="import-review-nav-status">Cannot import — not a PDF</span>
                  )}
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={goToNextReviewFile}
                    disabled={safeReviewIndex >= rows.length - 1}
                  >
                    Next file
                  </button>
                </div>
              </>
            ) : (
              <p className="import-preview-group-help">No files found in this ZIP.</p>
            )}
            <label className="import-preview-toggle">
              <input
                type="checkbox"
                checked={validateTemplates}
                onChange={(event) => setValidateTemplates(event.target.checked)}
              />
              <span>Validate against templates before publish</span>
            </label>
          </section>
        ) : null}

        {step === 'confirm' ? (
          <section className="import-preview-confirm">
            <p>
              Publishing <strong>{importableRows.length}</strong> PDF{importableRows.length === 1 ? '' : 's'} into
              {' '}<strong>{linkedGroups.length}</strong> student folder{linkedGroups.length === 1 ? '' : 's'} under {folderName || 'this location'}.
            </p>
            {skippedReviewCount || removedReviewCount ? (
              <p className="import-preview-confirm-skip-summary">
                {skippedReviewCount ? `${skippedReviewCount} file${skippedReviewCount === 1 ? '' : 's'} skipped (not a PDF)` : ''}
                {skippedReviewCount && removedReviewCount ? ' · ' : ''}
                {removedReviewCount ? `${removedReviewCount} removed` : ''}
              </p>
            ) : null}
            <ul className="import-preview-confirm-list">
              {importableRows.map((row) => {
                const resolved = resolveRowDocumentType(row, defaultTypeState)
                return (
                <li key={row.originalPath}>
                  <div className="import-preview-confirm-item">
                    <span>{row.uploadFileName || fileNameFromImportPath(row.originalPath)}</span>
                    <ArrowRightIcon className="icon" />
                    <strong>{row.targetFolderName}</strong>
                    {resolved.title ? (
                      <span className="import-preview-confirm-type">→ {formatDocumentTypePath(resolved, defaultTypeState, row)}</span>
                    ) : null}
                    {row.documentAcademicYear && row.documentSemester ? (
                      <span className="import-preview-confirm-type">
                        → {row.documentAcademicYear} / {row.documentSemester}
                        {resolved.documentTypeLabel || resolved.title
                          ? ` / ${resolved.documentTypeLabel || resolved.title}`
                          : ''}
                        {resolved.documentTypeLabel
                          && resolved.title
                          && resolved.documentTypeLabel !== resolved.title
                          ? ` / ${resolved.title}`
                          : ''}
                      </span>
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
              )})}
            </ul>
          </section>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
          {step === 'audit' ? (
            <button type="button" className="ghost-btn" onClick={() => setStep('link')} disabled={busy}>
              Back
            </button>
          ) : null}
          {step === 'confirm' ? (
            <button type="button" className="ghost-btn" onClick={() => setStep('audit')} disabled={busy}>
              Back
            </button>
          ) : null}
          {step !== 'confirm' ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (step === 'link') {
                  if (!canContinueFromLink()) {
                    return
                  }
                  setReviewIndex(0)
                  setStep('audit')
                  return
                }
                if (step === 'audit' && !importableRows.length) {
                  showWizardAlert('Keep at least one file, or cancel this import.')
                  return
                }
                setStep('confirm')
              }}
              disabled={step === 'link' && !importableRows.length}
            >
              {step === 'link' ? 'Review files' : 'Continue'}
            </button>
          ) : (
            <button type="button" className="primary-btn btn-success" onClick={handleCommit} disabled={busy || !importableRows.length}>
              {busy ? 'Publishing…' : `Publish ${importableRows.length} PDF${importableRows.length === 1 ? '' : 's'}`}
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
