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
    return 'Enter an academic year such as 2029-2030.'
  }
  if (!/^\d{4}-\d{4}$/.test(value)) {
    return 'Use the format YYYY-YYYY (example: 2029-2030).'
  }
  const [start, end] = value.split('-').map(Number)
  if (end !== start + 1) {
    return 'The second year must be one year after the first (example: 2029-2030).'
  }
  return ''
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
