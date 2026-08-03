import { studentFacultyOptions } from './academicDepartments'

export function validateFypStep1Selection(faculty, department) {
  const normalizedFaculty = String(faculty || '').trim()
  const normalizedDepartment = String(department || '').trim()

  if (!normalizedFaculty) {
    return 'Please select your faculty.'
  }

  const facultyOption = studentFacultyOptions.find((item) => item.value === normalizedFaculty)
  if (!facultyOption) {
    return 'Please choose a faculty from the existing AUCA faculty list.'
  }

  if (!normalizedDepartment) {
    return 'Please select your department.'
  }

  if (!facultyOption.departments.includes(normalizedDepartment)) {
    return 'The selected department does not belong to the chosen faculty. Please pick a department from the listed options.'
  }

  return ''
}

export function validateFacePhotoRequirements(imageInfo) {
  const width = Number(imageInfo?.width || 0)
  const height = Number(imageInfo?.height || 0)
  const colorVariance = Number(imageInfo?.colorVariance || 0)
  const edgeDensity = Number(imageInfo?.edgeDensity || 0)
  const brightnessRange = Number(imageInfo?.brightnessRange || 0)

  if (!width || !height) {
    return 'Upload a valid image file.'
  }

  if (width < 240 || height < 240) {
    return 'Face photo is too small. Use an image at least 240x240 pixels.'
  }

  if (width > height * 1.5) {
    return 'The upload looks too wide. Please upload a portrait-style face photo, not a landscape image or logo.'
  }

  if (colorVariance < 0.08 || edgeDensity < 0.06 || brightnessRange < 0.08) {
    return 'This image does not look like a real face photo. Please upload a clear portrait photo instead of a logo or flat graphic.'
  }

  return ''
}

export function validateFypDescription(value) {
  const trimmed = String(value || '').trim()
  if (trimmed.length < 30) {
    return 'Short description must be at least 30 characters long.'
  }
  return ''
}

export function validateGithubRepositoryUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: true, normalized: '' }
  }

  const lower = trimmed.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:') || lower.startsWith('vbscript:')) {
    return { ok: false, message: 'Blocked URL scheme. Use a safe HTTPS GitHub repository link.' }
  }

  let url
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, message: 'Enter a valid GitHub repository URL.' }
  }

  if (url.protocol !== 'https:') {
    return { ok: false, message: 'GitHub repository URL must use HTTPS.' }
  }

  const host = String(url.hostname || '').toLowerCase()
  if (host !== 'github.com' && host !== 'www.github.com') {
    return { ok: false, message: 'GitHub repository URL must point to github.com.' }
  }

  if (!url.pathname || url.pathname === '/' || url.pathname === '/about' || url.pathname === '/login') {
    return { ok: false, message: 'Please provide a repository path such as https://github.com/username/repo.' }
  }

  return { ok: true, normalized: url.toString() }
}
