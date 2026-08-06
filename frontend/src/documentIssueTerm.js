import { validateAcademicYearFormat, normalizeAcademicYearLabel } from './academicYears'
import { semesterOptionsForAcademicYear } from './studentId'

/** How many academic years a student may span from the placement year (inclusive). */
export const DOCUMENT_ISSUE_YEAR_SPAN = 3

export function parseDocumentIssueTermFromFolder(folder) {
  if (!folder) {
    return { documentAcademicYear: '', documentSemester: '' }
  }
  const chain = [
    ...(folder.breadcrumbs || []),
    { name: folder.name, code: folder.code }
  ]
  let documentAcademicYear = ''
  let documentSemester = ''
  for (const crumb of chain) {
    const code = String(crumb?.code || '').toUpperCase()
    const name = String(crumb?.name || '').trim()
    if (code.includes('-INAY-') && /^\d{4}-\d{4}$/.test(name)) {
      documentAcademicYear = name
    }
    if (code.includes('-INSEM-') && /^\d{4}\/\d$/.test(name)) {
      documentSemester = name
    }
  }
  return { documentAcademicYear, documentSemester }
}

/**
 * Outer archive academic year for the open semester / student folder
 * (e.g. 2024-2025 under Faculty → Dept → Year → Semester → Student).
 */
export function parsePlacementAcademicYearFromFolder(folder) {
  if (!folder) {
    return ''
  }
  const chain = [
    ...(folder.breadcrumbs || []),
    { name: folder.name, code: folder.code }
  ]
  let academicYear = ''
  for (const crumb of chain) {
    const code = String(crumb?.code || '').toUpperCase()
    const name = String(crumb?.name || '').trim()
    if (code.includes('-INAY-') || code.includes('-INSEM-')) {
      continue
    }
    if (/-AY-\d{8}(-[A-Z]+)?$/.test(code) || /^\d{4}-\d{4}$/.test(name)) {
      const normalized = normalizeAcademicYearLabel(name)
      if (normalized) {
        academicYear = normalized
      }
    }
  }
  return academicYear
}

export function academicYearStart(academicYear) {
  const normalized = normalizeAcademicYearLabel(academicYear)
  if (!normalized) {
    return null
  }
  return Number.parseInt(normalized.split('-')[0], 10)
}

export function formatAcademicYearFromStart(startYear) {
  if (!Number.isFinite(startYear)) {
    return ''
  }
  return `${startYear}-${startYear + 1}`
}

/**
 * Allowed document issue years: placement year and the next years while the student
 * remains enrolled (default 3 years). Never earlier than the open semester year.
 */
export function buildDocumentIssueYearOptions(placementAcademicYear, spanYears = DOCUMENT_ISSUE_YEAR_SPAN) {
  const start = academicYearStart(placementAcademicYear)
  if (start == null) {
    return []
  }
  const span = Math.max(1, Number(spanYears) || DOCUMENT_ISSUE_YEAR_SPAN)
  const years = []
  for (let offset = 0; offset < span; offset += 1) {
    years.push(formatAcademicYearFromStart(start + offset))
  }
  return years
}

export function validateDocumentIssueTerm(academicYear, semester, options = {}) {
  const yearError = validateAcademicYearFormat(academicYear)
  if (yearError) {
    return yearError
  }
  const minAcademicYear = normalizeAcademicYearLabel(options.minAcademicYear)
  if (minAcademicYear) {
    const selectedStart = academicYearStart(academicYear)
    const minStart = academicYearStart(minAcademicYear)
    if (selectedStart != null && minStart != null && selectedStart < minStart) {
      return `Document academic year cannot be before ${minAcademicYear} (the year of this semester folder).`
    }
    const allowed = buildDocumentIssueYearOptions(minAcademicYear, options.spanYears)
    if (allowed.length && !allowed.includes(String(academicYear || '').trim())) {
      return `Choose an academic year from ${allowed[0]} to ${allowed[allowed.length - 1]} for this student folder.`
    }
  }
  const normalizedSemester = String(semester || '').trim()
  if (!/^\d{4}\/[1-3]$/.test(normalizedSemester)) {
    return 'Semester must use AUCA format like 2026/1 (1, 2, or 3).'
  }
  const startYear = Number.parseInt(String(academicYear || '').split('-')[0], 10)
  const [semYear, semNumber] = normalizedSemester.split('/').map(Number)
  if (semYear !== startYear) {
    return `Semester year (${semYear}) must match the academic year start (${startYear}).`
  }
  if (semNumber < 1 || semNumber > 3) {
    return 'Semester must be 1, 2, or 3.'
  }
  return ''
}

export function semesterOptionsForDocumentYear(academicYear) {
  return semesterOptionsForAcademicYear(academicYear)
}
