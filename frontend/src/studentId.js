export const STUDENT_ID_FORMAT_HINT = 'YYYY + semester(1-3) + DEPT + SEQ (example: 20251SENG041)'
export const LEGACY_STUDENT_ID_FORMAT_HINT = '5-10 digit number (example: 25876 or 25678965)'
export const STUDENT_ID_FORMATS_HINT = `${STUDENT_ID_FORMAT_HINT} or ${LEGACY_STUDENT_ID_FORMAT_HINT}`
export const STAFF_FOLDER_NAME_HINT = STUDENT_ID_FORMAT_HINT

export const ACADEMIC_YEARS = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
  '2027-2028',
  '2028-2029'
]

/** Department / programme codes used in student IDs and staff folder names. */
export const STUDENT_DEPARTMENT_CODES = {
  // Faculty of Information Technology
  SEN: 'Software Engineering',
  SENG: 'Software Engineering',
  IMA: 'Information Management',
  NET: 'Networking & Communication Systems',
  // Faculty of Business Administration
  ACC: 'Accounting',
  MGT: 'Management',
  FIN: 'Finance',
  // Faculty of Education
  EPS: 'Educational Psychology',
  LNG: 'Languages (English / French)',
  REL: 'Religious Studies',
  BAC: 'Business Accounting & Computer Science',
  // Faculty of Health Sciences
  NUR: 'Nursing',
  MID: 'Midwifery',
  // Faculty of Theology
  THE: 'Theology (Pastoral Training)'
}

const MODERN_ID_PATTERN = /^(\d{4})([123])([A-Z]{3,4})(\d{3})$/i
const MODERN_ID_IN_TEXT = /(\d{4})([123])([a-z]{3,4})(\d{3})/i
const LEGACY_ID_PATTERN = /^\d{5,10}$/

export function normalizeStudentId(value) {
  const trimmed = String(value || '').trim()
  if (/^\d+$/.test(trimmed)) {
    return trimmed
  }
  return trimmed.toUpperCase()
}

export function isModernStudentId(value) {
  return MODERN_ID_PATTERN.test(normalizeStudentId(value))
}

export function isLegacyStudentId(value) {
  return LEGACY_ID_PATTERN.test(normalizeStudentId(value))
}

export function isRecognizedStudentId(value) {
  return isModernStudentId(value) || isLegacyStudentId(value)
}

export function parseStudentId(value) {
  const normalized = normalizeStudentId(value)
  const match = normalized.match(MODERN_ID_PATTERN)
  if (!match) {
    return null
  }
  const departmentCode = match[3].toUpperCase()
  return {
    admissionYear: match[1],
    intake: match[2],
    departmentCode,
    sequence: match[4],
    departmentName: STUDENT_DEPARTMENT_CODES[departmentCode] || null,
    cohortCode: match[1].slice(-2)
  }
}

export function resolveDepartmentFromStudentId(value) {
  return parseStudentId(value)?.departmentName || null
}

export function formatAcademicYearRange(startYear) {
  const year = Number(startYear)
  if (!Number.isFinite(year)) {
    return ''
  }
  return `${year}-${year + 1}`
}

export function semesterOptionsForAcademicYear(academicYear) {
  const startYear = Number.parseInt(String(academicYear || '').split('-')[0], 10)
  if (!Number.isFinite(startYear)) {
    return []
  }
  return [1, 2, 3].map((semester) => ({
    value: `${startYear}/${semester}`,
    label: `${startYear}/${semester}`
  }))
}

export function resolveAcademicDefaults(studentId) {
  const parsed = parseStudentId(studentId)
  if (!parsed) {
    return { academicYear: '', semester: '' }
  }
  const startYear = Number(parsed.admissionYear)
  return {
    academicYear: formatAcademicYearRange(startYear),
    semester: `${startYear}/${parsed.intake}`
  }
}

export function listDepartmentCodeHints() {
  const unique = new Map()
  Object.entries(STUDENT_DEPARTMENT_CODES).forEach(([code, name]) => {
    if (!unique.has(name) || code.length >= 4) {
      unique.set(name, code)
    }
  })
  return [...unique.entries()]
    .map(([name, code]) => `${code}=${name}`)
    .join(', ')
}

/**
 * Staff archive folders must be named like a modern student ID:
 * year + semester(1|2|3) + department code + 3-digit student sequence.
 * Example: 20251SENG041
 */
export function validateStaffFolderName(value) {
  const normalized = normalizeStudentId(value)
  if (!normalized) {
    return 'Folder name is required.'
  }
  if (!isModernStudentId(normalized)) {
    return `Folder name must be ${STAFF_FOLDER_NAME_HINT}. Semester must be 1, 2, or 3.`
  }
  const parsed = parseStudentId(normalized)
  if (!parsed?.departmentName) {
    return `Unknown department code "${parsed?.departmentCode || ''}". Use codes like SENG, NET, IMA, ACC.`
  }
  if (!['1', '2', '3'].includes(String(parsed.intake))) {
    return 'Semester in the folder name must be 1, 2, or 3.'
  }
  return ''
}

export function validateStudentIdForNewEntry(value) {
  const normalized = normalizeStudentId(value)
  if (!normalized) {
    return 'Student ID is required.'
  }
  if (isLegacyStudentId(normalized)) {
    return ''
  }
  if (!isModernStudentId(normalized)) {
    return `Student ID must follow ${STUDENT_ID_FORMAT_HINT} or ${LEGACY_STUDENT_ID_FORMAT_HINT}.`
  }
  const parsed = parseStudentId(normalized)
  if (!parsed?.departmentName) {
    return `Unknown department code in student ID. Use codes like SENG, NET, IMA, ACC.`
  }
  return ''
}

export function validateStudentIdDepartmentMatch(value, department) {
  if (isLegacyStudentId(value)) {
    return ''
  }
  const parsed = parseStudentId(value)
  if (!parsed?.departmentName || !department) {
    return ''
  }
  if (parsed.departmentName.toLowerCase() !== String(department).trim().toLowerCase()) {
    return `Student ID code ${parsed.departmentCode} belongs to ${parsed.departmentName}, not ${department}.`
  }
  return ''
}

export function extractStudentIdFromFileName(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').trim()
  if (!base) {
    return null
  }
  if (isLegacyStudentId(base) || isModernStudentId(base)) {
    return normalizeStudentId(base)
  }
  const modernMatch = base.match(MODERN_ID_IN_TEXT)
  if (modernMatch) {
    return normalizeStudentId(modernMatch[0])
  }
  return null
}

export function applyStudentIdDefaults(currentForm, studentId) {
  const normalized = normalizeStudentId(studentId)
  const parsed = parseStudentId(studentId)
  if (!parsed) {
    return {
      ...currentForm,
      studentNumber: normalized
    }
  }
  const facultyOptions = [
    {
      value: 'Faculty of Business Administration',
      departments: ['Accounting', 'Management', 'Finance']
    },
    {
      value: 'Faculty of Information Technology',
      departments: ['Networking & Communication Systems', 'Software Engineering', 'Information Management']
    },
    {
      value: 'Faculty of Education',
      departments: ['Educational Psychology', 'Languages (English / French)', 'Religious Studies', 'Business Accounting & Computer Science']
    },
    {
      value: 'Faculty of Health Sciences (Nursing & Midwifery)',
      departments: ['Nursing', 'Midwifery']
    },
    {
      value: 'Faculty of Theology',
      departments: ['Theology (Pastoral Training)']
    }
  ]
  const faculty = facultyOptions.find((item) => item.departments.includes(parsed.departmentName))?.value
    || currentForm.faculty
  const academicDefaults = resolveAcademicDefaults(studentId)
  return {
    ...currentForm,
    studentNumber: normalized,
    department: parsed.departmentName || currentForm.department,
    faculty: faculty || currentForm.faculty,
    academicYear: academicDefaults.academicYear || currentForm.academicYear,
    semester: academicDefaults.semester || currentForm.semester
  }
}
