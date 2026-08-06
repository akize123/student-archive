import { ACADEMIC_YEARS } from './studentId'

const STORAGE_KEY = 'auca.customAcademicYears'

function readCustomYears() {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function writeCustomYears(years) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(years))
}

export function getAcademicYearOptions() {
  const custom = readCustomYears()
  const merged = [...ACADEMIC_YEARS]
  for (const year of custom) {
    if (!merged.includes(year)) {
      merged.push(year)
    }
  }
  return merged.sort()
}

export function validateAcademicYearFormat(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) {
    return 'Enter a year such as 2029-2030.'
  }
  if (!/^\d{4}-\d{4}$/.test(value)) {
    return 'Use YYYY-YYYY (example: 2029-2030).'
  }
  const [start, end] = value.split('-').map(Number)
  if (end !== start + 1) {
    return 'The end year must be one year after the start (example: 2029-2030).'
  }
  return ''
}

export function normalizeAcademicYearLabel(rawValue) {
  const formatError = validateAcademicYearFormat(rawValue)
  if (formatError) {
    return null
  }
  return String(rawValue || '').trim()
}

export function describeAcademicYearSemesters(academicYear) {
  const startYear = Number.parseInt(String(academicYear || '').split('-')[0], 10)
  if (!Number.isFinite(startYear)) {
    return ''
  }
  return [1, 2, 3].map((semester) => `${startYear}/${semester}`).join(', ')
}

export function getAcademicYearInputFeedback(rawValue, existingFolders = []) {
  const trimmed = String(rawValue || '').trim()
  const folderEntries = normalizeExistingFolderEntries(existingFolders)
  const existingNames = folderEntries.map((entry) => entry.name)

  if (!trimmed) {
    if (existingNames.length) {
      return {
        tone: 'info',
        message: `Already in this department: ${existingNames.join(', ')}.`
      }
    }
    return {
      tone: 'info',
      message: 'Format: YYYY-YYYY. Semesters 1, 2, and 3 are created automatically.'
    }
  }

  const formatError = validateAcademicYearFormat(trimmed)
  if (formatError) {
    return { tone: 'error', message: formatError }
  }

  const normalized = normalizeAcademicYearLabel(trimmed)
  const existingMatch = folderEntries.find((entry) => entry.name === normalized)
  if (existingMatch) {
    return {
      tone: 'existing',
      message: `${normalized} already exists in this department.`,
      existingFolderId: existingMatch.id ?? null,
      existingFolderName: normalized
    }
  }

  const semesters = describeAcademicYearSemesters(normalized)
  return {
    tone: 'success',
    message: `Ready to add ${normalized} with semesters ${semesters}.`
  }
}

function normalizeExistingFolderEntries(existingFolders = []) {
  if (!Array.isArray(existingFolders) || !existingFolders.length) {
    return []
  }
  if (typeof existingFolders[0] === 'string') {
    return existingFolders
      .map((name) => ({ id: null, name: String(name || '').trim() }))
      .filter((entry) => entry.name)
  }
  return existingFolders
    .map((entry) => ({
      id: entry?.id ?? null,
      name: String(entry?.name || '').trim()
    }))
    .filter((entry) => entry.name)
}

export function addAcademicYear(rawValue) {
  const value = String(rawValue || '').trim()
  const formatError = validateAcademicYearFormat(value)
  if (formatError) {
    throw new Error(formatError)
  }
  const options = getAcademicYearOptions()
  if (options.includes(value)) {
    return value
  }
  const custom = readCustomYears()
  custom.push(value)
  writeCustomYears(custom)
  return value
}
