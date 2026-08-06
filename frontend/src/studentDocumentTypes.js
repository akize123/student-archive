/** Document type presets aligned with registrar / student archive categories. */
export const STUDENT_DOCUMENT_CATEGORY_PRESETS = {
  REGISTRATION_FORM: [
    'Registration Form',
    'Birth Certificate',
    'National ID Copy',
    'Passport Copy',
    'Proof of Payment',
    'Medical Certificate',
    'Student ID Card',
    'Admission Letter',
    'Enrollment Confirmation',
    'Guardian Consent Form'
  ],
  REINTEGRATION_FORM: [
    'Reintegration Form',
    'Leave Letter',
    'Suspension Letter',
    'Reinstatement Approval',
    'Medical Clearance',
    'Dean Approval Letter'
  ],
  APPLICATION_DOCUMENTS: [
    'Application Letter',
    'Transcript Request',
    'Recommendation Letter',
    'Statement of Purpose',
    'CV / Resume',
    'Portfolio',
    'Transfer Request',
    'Course Change Request',
    'Scholarship Application'
  ],
  EXAMINATION_DOCUMENTS: [
    'Exam Paper',
    'Marks Sheet',
    'Grade Report',
    'Exam Attendance Sheet',
    'Moderation Report',
    'Invigilation Report',
    'Supplementary Exam Paper',
    'Re-mark Request'
  ],
  FINAL_YEAR_PROJECT: [
    'Project Report',
    'Supervisor Approval',
    'Defense Minutes',
    'Project Proposal',
    'Research Ethics Approval',
    'Plagiarism Report',
    'External Examiner Report'
  ]
}

/** Types shown on the student Official Documents upload form. */
export const OFFICIAL_STUDENT_DOCUMENT_TYPES = [
  'Mark sheets / Transcripts',
  'Degree certificates',
  'Registration forms',
  'Entrance exam cards',
  'Recommendation/reference letters',
  'Internship completion certificates',
  'Diploma certificates',
  'Provisional certificates',
  'Migration certificates',
  'Character/conduct certificates',
  'Semester/year result sheets',
  'Thesis/dissertation/project reports',
  'Bank payment slip',
  'Insurance certificate',
  'Accommodation contract',
  'Language proficiency certificate',
  'Work experience letter',
  'Ministry approval letter',
  'Accreditation document',
  'Clearance certificate'
]

/** Document-type categories available during Import for each role that can import. */
const ROLE_SUBFOLDER_CATEGORIES = {
  REGISTRAR: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS'],
  FINANCE: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS'],
  EXAMINATION_OFFICER: ['EXAMINATION_DOCUMENTS'],
  HOD: ['APPLICATION_DOCUMENTS'],
  DEAN_OF_FACULTY: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS', 'EXAMINATION_DOCUMENTS', 'FINAL_YEAR_PROJECT'],
  ADMIN: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS', 'EXAMINATION_DOCUMENTS', 'FINAL_YEAR_PROJECT'],
  LIBRARIAN: ['FINAL_YEAR_PROJECT'],
  STUDENT: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS', 'FINAL_YEAR_PROJECT']
}

export const CUSTOM_SUBFOLDER_TYPE = '__CUSTOM__'

/** Primary document types with optional sub-categories for archive subfolders. */
export const DOCUMENT_TYPE_CATALOG = [
  {
    label: 'Application Form',
    category: 'APPLICATION_DOCUMENTS',
    subcategories: [
      { value: 'High School Certificate', label: 'High School Certificate' },
      { value: 'Date of Birth (DOB)', label: 'Date of Birth (DOB)' },
      { value: 'National ID', label: 'National ID' },
      { value: 'Passport Copy', label: 'Passport Copy' },
      { value: 'Recommendation Letter', label: 'Recommendation Letter' },
      { value: CUSTOM_SUBFOLDER_TYPE, label: 'Other (enter your own)', custom: true }
    ]
  },
  {
    label: 'Registration Form',
    category: 'REGISTRATION_FORM',
    subcategories: [
      { value: 'Birth Certificate', label: 'Birth Certificate' },
      { value: 'National ID Copy', label: 'National ID Copy' },
      { value: 'Proof of Payment', label: 'Proof of Payment' },
      { value: CUSTOM_SUBFOLDER_TYPE, label: 'Other (enter your own)', custom: true }
    ]
  },
  {
    label: 'Reintegration Form',
    category: 'REINTEGRATION_FORM',
    subcategories: null
  },
  {
    label: 'CV / Resume',
    category: 'APPLICATION_DOCUMENTS',
    subcategories: null
  },
  {
    label: 'Transcript Request',
    category: 'APPLICATION_DOCUMENTS',
    subcategories: null
  },
  {
    label: 'Application Letter',
    category: 'APPLICATION_DOCUMENTS',
    subcategories: null
  },
  {
    label: 'Medical Certificate',
    category: 'REGISTRATION_FORM',
    subcategories: null
  },
  {
    label: 'Exam Paper',
    category: 'EXAMINATION_DOCUMENTS',
    subcategories: null
  },
  {
    label: 'Marks Sheet',
    category: 'EXAMINATION_DOCUMENTS',
    subcategories: null
  }
]

const catalogByLabel = new Map(DOCUMENT_TYPE_CATALOG.map((entry) => [entry.label, entry]))

export function getDocumentTypeDefinition(label) {
  return catalogByLabel.get(String(label || '').trim()) || null
}

export function hasSubcategories(documentType) {
  const definition = getDocumentTypeDefinition(documentType)
  return Array.isArray(definition?.subcategories) && definition.subcategories.length > 0
}

export function buildPrimaryDocumentTypeOptions(userRole) {
  const allowed = new Set(ROLE_SUBFOLDER_CATEGORIES[userRole] || ROLE_SUBFOLDER_CATEGORIES.REGISTRAR)
  return DOCUMENT_TYPE_CATALOG
    .filter((entry) => allowed.has(entry.category))
    .map((entry) => ({ value: entry.label, label: entry.label }))
}

export function resolveDocumentTypeSelection({ documentType, documentSubType, customSubType }) {
  const primary = String(documentType || '').trim()
  const definition = getDocumentTypeDefinition(primary)
  if (!primary || !definition) {
    return { title: '', category: null, documentTypeLabel: null }
  }

  if (!hasSubcategories(primary)) {
    return {
      title: primary,
      category: definition.category,
      documentTypeLabel: primary
    }
  }

  const sub = String(documentSubType || '').trim()
  if (!sub) {
    return { title: '', category: definition.category, documentTypeLabel: primary }
  }

  if (sub === CUSTOM_SUBFOLDER_TYPE) {
    const custom = String(customSubType || '').trim()
    return {
      title: custom,
      category: definition.category,
      documentTypeLabel: primary
    }
  }

  return {
    title: sub,
    category: definition.category,
    documentTypeLabel: primary
  }
}

export function isDocumentTypeSelectionComplete({ documentType, documentSubType, customSubType }) {
  const resolved = resolveDocumentTypeSelection({ documentType, documentSubType, customSubType })
  if (!resolved.title) {
    return false
  }
  if (hasSubcategories(documentType) && !String(documentSubType || '').trim()) {
    return false
  }
  if (documentSubType === CUSTOM_SUBFOLDER_TYPE && !String(customSubType || '').trim()) {
    return false
  }
  return true
}

export function inferDocumentTypeFromTitle(title, userRole) {
  const trimmed = String(title || '').trim()
  if (!trimmed) {
    return { documentType: '', documentSubType: '', customSubType: '' }
  }

  for (const entry of DOCUMENT_TYPE_CATALOG) {
    if (entry.label.toLowerCase() === trimmed.toLowerCase()) {
      return { documentType: entry.label, documentSubType: '', customSubType: '' }
    }
    if (entry.subcategories) {
      const match = entry.subcategories.find(
        (sub) => sub.value !== CUSTOM_SUBFOLDER_TYPE && sub.label.toLowerCase() === trimmed.toLowerCase()
      )
      if (match) {
        return { documentType: entry.label, documentSubType: match.value, customSubType: '' }
      }
    }
  }

  const presets = collectDocumentTypeNames(userRole)
  if (presets.some((name) => name.toLowerCase() === trimmed.toLowerCase())) {
    return { documentType: trimmed, documentSubType: '', customSubType: '' }
  }

  return { documentType: '', documentSubType: '', customSubType: '', title: trimmed }
}

export function buildStudentSubfolderTypeOptions(userRole) {
  const categories = ROLE_SUBFOLDER_CATEGORIES[userRole] || ROLE_SUBFOLDER_CATEGORIES.REGISTRAR
  const names = new Set()
  categories.forEach((category) => {
    ;(STUDENT_DOCUMENT_CATEGORY_PRESETS[category] || []).forEach((name) => names.add(name))
  })
  OFFICIAL_STUDENT_DOCUMENT_TYPES.forEach((name) => names.add(name))
  return [
    { value: '', label: 'Select document type', disabled: true },
    ...[...names].sort((left, right) => left.localeCompare(right)).map((name) => ({ value: name, label: name })),
    { value: CUSTOM_SUBFOLDER_TYPE, label: 'Other (enter your own)' }
  ]
}

function collectDocumentTypeNames(userRole) {
  const categories = ROLE_SUBFOLDER_CATEGORIES[userRole] || ROLE_SUBFOLDER_CATEGORIES.REGISTRAR
  const names = new Set()
  categories.forEach((category) => {
    ;(STUDENT_DOCUMENT_CATEGORY_PRESETS[category] || []).forEach((name) => names.add(name))
  })
  OFFICIAL_STUDENT_DOCUMENT_TYPES.forEach((name) => names.add(name))
  return [...names].sort((left, right) => left.localeCompare(right))
}

export function buildDocumentTypePresetList(userRole) {
  const fromCatalog = buildPrimaryDocumentTypeOptions(userRole).map((option) => option.label)
  const legacy = collectDocumentTypeNames(userRole)
  return [...new Set([...fromCatalog, ...legacy])].sort((left, right) => left.localeCompare(right))
}

export function buildDocumentTitleOptions(userRole) {
  const names = collectDocumentTypeNames(userRole)
  return [
    { value: '', label: 'Select document type', disabled: true },
    ...names.map((name) => ({ value: name, label: name })),
    { value: CUSTOM_SUBFOLDER_TYPE, label: 'Other (enter your own)' }
  ]
}

export function inferCategoryFromDocumentType(typeName, userRole) {
  const normalized = String(typeName || '').trim().toLowerCase()
  if (!normalized) {
    return null
  }

  for (const [category, names] of Object.entries(STUDENT_DOCUMENT_CATEGORY_PRESETS)) {
    if (names.some((name) => name.toLowerCase() === normalized)) {
      return category
    }
  }

  if (/exam|mark|grade|moderation|invigil|supplementary|re-mark/.test(normalized)) {
    return 'EXAMINATION_DOCUMENTS'
  }
  if (/project|thesis|dissertation|fyp|defense|plagiarism/.test(normalized)) {
    return 'FINAL_YEAR_PROJECT'
  }
  if (/reintegr|reinstat|leave|suspension/.test(normalized)) {
    return 'REINTEGRATION_FORM'
  }
  if (/application form|high school|national id|date of birth|\bdob\b/.test(normalized)) {
    return 'APPLICATION_DOCUMENTS'
  }
  if (/application|transcript|recommendation|admission|scholarship|portfolio|transfer|course change|cv|resume/.test(normalized)) {
    return 'APPLICATION_DOCUMENTS'
  }

  const roleCategories = ROLE_SUBFOLDER_CATEGORIES[userRole] || ROLE_SUBFOLDER_CATEGORIES.REGISTRAR
  return roleCategories[0] || 'REGISTRATION_FORM'
}

export function isDocumentTitleComplete(value) {
  return Boolean(String(value || '').trim())
}

export function isLikelyRawFileName(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return true
  }
  if (/\.(pdf|zip|doc|docx|png|jpe?g)$/i.test(trimmed)) {
    return true
  }
  if (/^(scan|document|file|img|image|photo|page|copy|untitled|download|export|new)[\s_-]?\d*$/i.test(trimmed)) {
    return true
  }
  if (/^\d+$/.test(trimmed)) {
    return true
  }
  return false
}

export function inferDocumentTypeFromImportPath(originalPath, userRole) {
  const presets = collectDocumentTypeNames(userRole)
  const byLower = new Map(presets.map((name) => [name.toLowerCase(), name]))
  const parts = String(originalPath || '').split(/[\\/]/).filter(Boolean)

  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const segment = parts[index]?.trim()
    if (!segment || /^\d{4,}$/.test(segment.replace(/[^A-Za-z0-9]/g, ''))) {
      continue
    }
    const exact = byLower.get(segment.toLowerCase())
    if (exact) {
      return exact
    }
    for (const [lower, canonical] of byLower.entries()) {
      if (segment.toLowerCase().includes(lower) || lower.includes(segment.toLowerCase())) {
        return canonical
      }
    }
  }

  const fileBase = (parts[parts.length - 1] || '').replace(/\.pdf$/i, '').trim()
  const normalizedFile = fileBase.replace(/[_-]+/g, ' ').trim()
  return byLower.get(normalizedFile.toLowerCase()) || byLower.get(fileBase.toLowerCase()) || ''
}

export function resolveImportDocumentType({ originalPath, proposedTitle, userRole, fallback = '' }) {
  const fromPath = inferDocumentTypeFromImportPath(originalPath, userRole)
  if (fromPath) {
    return fromPath
  }

  const proposed = String(proposedTitle || '').trim()
  if (proposed && !isLikelyRawFileName(proposed)) {
    const inferred = inferDocumentTypeFromTitle(proposed, userRole)
    if (inferred.documentType) {
      return inferred.documentSubType && inferred.documentSubType !== CUSTOM_SUBFOLDER_TYPE
        ? inferred.documentSubType
        : inferred.documentType
    }
    const presets = collectDocumentTypeNames(userRole)
    const match = presets.find((name) => name.toLowerCase() === proposed.toLowerCase())
    if (match) {
      return match
    }
  }

  return String(fallback || '').trim()
}

export function buildImportRowDocumentTypeState(title, userRole) {
  const trimmed = String(title || '').trim()
  const inferred = inferDocumentTypeFromTitle(trimmed, userRole)
  if (inferred.documentType) {
    const resolved = resolveDocumentTypeSelection(inferred)
    return {
      documentType: inferred.documentType,
      documentSubType: inferred.documentSubType || '',
      customSubType: inferred.customSubType || '',
      title: resolved.title || trimmed
    }
  }
  if (trimmed && !isLikelyRawFileName(trimmed)) {
    return {
      documentType: trimmed,
      documentSubType: '',
      customSubType: '',
      title: trimmed
    }
  }
  return {
    documentType: '',
    documentSubType: '',
    customSubType: '',
    title: ''
  }
}

export function rowNeedsDocumentTypeAssignment(title) {
  const trimmed = String(title || '').trim()
  return !trimmed || isLikelyRawFileName(trimmed)
}

export function resolveSubfolderNameFromPicker(selectValue, customValue) {
  if (selectValue === CUSTOM_SUBFOLDER_TYPE) {
    return String(customValue || '').trim()
  }
  return String(selectValue || '').trim()
}
