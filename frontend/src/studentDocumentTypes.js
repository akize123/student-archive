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

const ROLE_SUBFOLDER_CATEGORIES = {
  REGISTRAR: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS'],
  EXAMINATION_OFFICER: ['EXAMINATION_DOCUMENTS'],
  HOD: ['APPLICATION_DOCUMENTS'],
  ADMIN: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS', 'EXAMINATION_DOCUMENTS'],
  LIBRARIAN: ['FINAL_YEAR_PROJECT'],
  STUDENT: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS', 'FINAL_YEAR_PROJECT']
}

export const CUSTOM_SUBFOLDER_TYPE = '__CUSTOM__'

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
  return collectDocumentTypeNames(userRole)
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
  if (/application|transcript|recommendation|admission|scholarship|portfolio|transfer|course change/.test(normalized)) {
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
    const presets = collectDocumentTypeNames(userRole)
    const match = presets.find((name) => name.toLowerCase() === proposed.toLowerCase())
    if (match) {
      return match
    }
  }

  return String(fallback || '').trim()
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
