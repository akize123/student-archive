export const STUDENT_ID_FORMAT_HINT = 'YYYYINTAKE+DEPT+SEQ (example: 20251SEN001)'
export const LEGACY_STUDENT_ID_FORMAT_HINT = '5-digit number (example: 25876)'
export const STUDENT_ID_FORMATS_HINT = `${STUDENT_ID_FORMAT_HINT} or ${LEGACY_STUDENT_ID_FORMAT_HINT}`

export const ACADEMIC_YEARS = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
  '2027-2028',
  '2028-2029'
]

export const STUDENT_DEPARTMENT_CODES = {
  SEN: 'Software Engineering',
  IMA: 'Information Management',
  NET: 'Networking & Communication Systems'
}

const MODERN_ID_PATTERN = /^(\d{4})(\d)([A-Z]{3})(\d{3})$/i
const LEGACY_ID_PATTERN = /^\d{5}$/

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
    return `Unknown department code in student ID. Use SEN, IMA, or NET.`
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
      value: 'Faculty of Information Technology',
      departments: ['Networking & Communication Systems', 'Software Engineering', 'Information Management']
    },
    {
      value: 'Faculty of Business Administration',
      departments: ['Accounting', 'Management', 'Finance', 'Information Management']
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
