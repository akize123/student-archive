const API_PORT = import.meta.env.VITE_API_PORT || '8081'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.DEV
    ? ''
    : (
      typeof window !== 'undefined'
        ? `http://${window.location.hostname}:${API_PORT}`
        : `http://localhost:${API_PORT}`
    )
)
const AUTH_SESSION_KEY = 'auca-archive-session'

function getSessionRoleHeader() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) {
      return {}
    }
    const session = JSON.parse(raw)
    const headers = {}
    if (session?.role) {
      headers['X-User-Role'] = session.role
    }
    if (session?.fullName) {
      headers['X-User-Name'] = session.fullName
    }
    if (session?.studentNumber) {
      headers['X-Student-Number'] = session.studentNumber
    }
    if (session?.department) {
      headers['X-User-Department'] = session.department
    }
    if (session?.id) {
      headers['X-Account-Id'] = String(session.id)
    }
    if (session?.username) {
      headers['X-User-Username'] = session.username
    }
    return headers
  } catch {
    return {}
  }
}

export function formatLoginError(message) {
  const text = String(message || '').trim()
  if (!text) {
    return 'Unable to sign in. Please try again.'
  }
  if (text.includes('Invalid username or password')) {
    return 'Invalid username or password. Please try again.'
  }
  if (text.includes('Username is required') && text.includes('Password is required')) {
    return 'Please enter your username and password.'
  }
  if (text.includes('Username is required')) {
    return 'Please enter your username.'
  }
  if (text.includes('Password is required')) {
    return 'Please enter your password.'
  }
  if (text.includes('Validation failed') || text.length > 120) {
    return 'Please check your username and password, then try again.'
  }
  return text
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...getSessionRoleHeader(),
      ...(options.headers || {})
    },
    ...options
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    let message = ''
    if (contentType.includes('application/json')) {
      try {
        const payload = await response.json()
        message = payload.message || payload.error || ''
      } catch {
        message = ''
      }
    } else {
      message = await response.text()
    }
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

export function getDashboard() {
  return request('/api/dashboard')
}

export function login(username, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
}

export function getSessionProfile() {
  return request('/api/auth/me')
}

export function searchDocuments(query, filters = {}) {
  const params = new URLSearchParams()
  const normalizedFilters = typeof filters === 'string'
    ? { category: filters }
    : (filters || {})
  if (query) params.set('q', query)
  if (normalizedFilters.category) params.set('category', normalizedFilters.category)
  if (normalizedFilters.office) params.set('office', normalizedFilters.office)
  if (normalizedFilters.faculty) params.set('faculty', normalizedFilters.faculty)
  if (normalizedFilters.department) params.set('department', normalizedFilters.department)
  if (normalizedFilters.academicYear) params.set('academicYear', normalizedFilters.academicYear)
  if (normalizedFilters.semester) params.set('semester', normalizedFilters.semester)
  if (normalizedFilters.kind) params.set('kind', normalizedFilters.kind)
  if (normalizedFilters.documentTypeId) params.set('documentTypeIds', String(normalizedFilters.documentTypeId))
  if (Array.isArray(normalizedFilters.documentTypeIds)) {
    normalizedFilters.documentTypeIds.forEach((id) => params.append('documentTypeIds', String(id)))
  }
  if (Array.isArray(normalizedFilters.categories)) {
    normalizedFilters.categories.forEach((value) => params.append('categories', value))
  }
  if (Array.isArray(normalizedFilters.excludeCategories)) {
    normalizedFilters.excludeCategories.forEach((value) => params.append('excludeCategories', value))
  }
  const queryString = params.toString()
  return request(`/api/documents${queryString ? `?${queryString}` : ''}`)
}

export function getDocumentCategories({ office, faculty, department } = {}) {
  const params = new URLSearchParams()
  if (office) params.set('office', office)
  if (faculty) params.set('faculty', faculty)
  if (department) params.set('department', department)
  const query = params.toString()
  return request(`/api/document-categories${query ? `?${query}` : ''}`)
}

export function createDocumentCategory(payload) {
  return request('/api/document-categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getDocumentTypes({ category, categoryDefinitionId, office, faculty, department } = {}) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (categoryDefinitionId) params.set('categoryDefinitionId', String(categoryDefinitionId))
  if (office) params.set('office', office)
  if (faculty) params.set('faculty', faculty)
  if (department) params.set('department', department)
  const query = params.toString()
  return request(`/api/document-types${query ? `?${query}` : ''}`)
}

export function createDocumentType(payload) {
  return request('/api/document-types', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getUserPreferences() {
  return request('/api/users/me/preferences')
}

export function updateUserPreferences(payload) {
  return request('/api/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function verifyDocumentIntegrity(documentId) {
  return request(`/api/documents/${encodeURIComponent(documentId)}/integrity`)
}

export function getStudentArchive(studentNumber) {
  return request(`/api/students/${encodeURIComponent(String(studentNumber || '').trim())}`)
}

export function lookupStudent(studentNumber) {
  return request(`/api/students/${encodeURIComponent(String(studentNumber || '').trim())}/lookup`)
}

export function getFolder(folderId) {
  return request(`/api/folders/${folderId}`)
}

export function getPublishedArchiveTree() {
  return request('/api/folders/published-archive/tree')
}

export function reserveDocument(documentId) {
  return request(`/api/reservations?documentId=${encodeURIComponent(documentId)}`, {
    method: 'POST'
  })
}

export function getMyReservations() {
  return request('/api/reservations/mine')
}

export function releaseReservation(reservationId) {
  return request(`/api/reservations/${reservationId}`, {
    method: 'DELETE'
  })
}

export function getReservationAvailability(documentId) {
  return request(`/api/reservations/availability?documentId=${encodeURIComponent(documentId)}`)
}

export function createSubfolder(parentId, name) {
  return request(`/api/folders/${parentId}/subfolders`, {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}

export function addDepartmentAcademicYear(departmentId, academicYear) {
  return request(`/api/folders/${departmentId}/academic-years`, {
    method: 'POST',
    body: JSON.stringify({ academicYear })
  })
}

export function importFolderArchive(folderId, { archive, files = [], paths = [] } = {}) {
  const formData = new FormData()
  if (archive) {
    formData.append('archive', archive, archive.name || 'import.zip')
  }
  if (files.length) {
    files.forEach((file) => {
      formData.append('files', file, file.name)
    })
    paths.forEach((path) => {
      formData.append('paths', path)
    })
  }
  return request(`/api/folders/${encodeURIComponent(folderId)}/import`, {
    method: 'POST',
    body: formData
  })
}

function appendImportPayload(formData, { archive, files = [], paths = [] } = {}) {
  if (archive) {
    formData.append('archive', archive, archive.name || 'import.zip')
  }
  if (files.length) {
    files.forEach((file) => {
      formData.append('files', file, file.name)
    })
    paths.forEach((path) => {
      formData.append('paths', path)
    })
  }
}

export function previewFolderImport(folderId, payload = {}, { defaultCategory, defaultSubtypeId } = {}) {
  const formData = new FormData()
  appendImportPayload(formData, payload)
  const params = new URLSearchParams()
  if (defaultCategory) params.set('defaultCategory', defaultCategory)
  if (defaultSubtypeId) params.set('defaultSubtypeId', String(defaultSubtypeId))
  const query = params.toString()
  return request(`/api/folders/${encodeURIComponent(folderId)}/import/preview${query ? `?${query}` : ''}`, {
    method: 'POST',
    body: formData
  })
}

export function commitFolderImport(folderId, commitRequest, payload = {}) {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(commitRequest)], { type: 'application/json' }))
  appendImportPayload(formData, payload)
  return request(`/api/folders/${encodeURIComponent(folderId)}/import/commit`, {
    method: 'POST',
    body: formData
  })
}

export function getDocumentSubtypes({ category, department } = {}) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (department) params.set('department', department)
  const query = params.toString()
  return request(`/api/document-subtypes${query ? `?${query}` : ''}`)
}

export function createDocumentSubtype(payload) {
  return request('/api/document-subtypes', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getDocumentTemplates({ category, office, faculty, department } = {}) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (office) params.set('office', office)
  if (faculty) params.set('faculty', faculty)
  if (department) params.set('department', department)
  const query = params.toString()
  return request(`/api/document-templates${query ? `?${query}` : ''}`)
}

export function uploadDocumentTemplate({
  file,
  category,
  documentTypeName,
  office,
  faculty,
  department,
  title,
  similarityThreshold
}) {
  const formData = new FormData()
  formData.append('file', file)
  const params = new URLSearchParams()
  params.set('category', category)
  params.set('documentTypeName', documentTypeName)
  params.set('office', office)
  if (faculty) params.set('faculty', faculty)
  if (department) params.set('department', department)
  if (title) params.set('title', title)
  if (similarityThreshold != null) params.set('similarityThreshold', String(similarityThreshold))
  return request(`/api/document-templates?${params.toString()}`, {
    method: 'POST',
    body: formData
  })
}

export function updateDocumentTemplate(templateId, payload) {
  return request(`/api/document-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function getDocumentTemplatePreviewText(templateId) {
  return request(`/api/document-templates/${templateId}/preview-text`)
}

export function getOcrHealth() {
  return request('/api/admin/ocr-health')
}

export function getOcrSettings() {
  return request('/api/admin/ocr-settings')
}

export function updateOcrSettings(payload) {
  return request('/api/admin/ocr-settings', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function renameFolder(folderId, name) {
  return request(`/api/folders/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name })
  })
}

export function moveFolder(folderId, targetParentId) {
  return request(`/api/folders/${folderId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetParentId })
  })
}

export function copyFolder(folderId, targetParentId) {
  return request(`/api/folders/${folderId}/copy`, {
    method: 'POST',
    body: JSON.stringify({ targetParentId })
  })
}

export function deleteFolder(folderId) {
  return request(`/api/folders/${folderId}`, {
    method: 'DELETE'
  })
}

export function folderHasContents(folderId) {
  return request(`/api/folders/${folderId}/has-contents`)
}

export function shareFolder(folderId, targetRole, permission = 'READ_ONLY') {
  return request(`/api/folders/${folderId}/share`, {
    method: 'POST',
    body: JSON.stringify({ targetRole, permission })
  })
}

export function shareItems({ targetRole, permission = 'READ_ONLY', folderIds = [], documentIds = [] }) {
  return request('/api/shares', {
    method: 'POST',
    body: JSON.stringify({ targetRole, permission, folderIds, documentIds })
  })
}

export function getSharedWithMe() {
  return request('/api/shares/with-me')
}

export function getSharedWithMeCount() {
  return request('/api/shares/with-me/count')
}

export async function downloadFolderZip(folderId, documentIds = [], folderIds = []) {
  const params = new URLSearchParams()
  if (documentIds.length) {
    documentIds.forEach((id) => params.append('documentIds', String(id)))
  }
  if (folderIds.length) {
    folderIds.forEach((id) => params.append('folderIds', String(id)))
  }
  const query = params.toString()
  const response = await fetch(`${API_BASE}/api/folders/${folderId}/download${query ? `?${query}` : ''}`, {
    headers: {
      ...getSessionRoleHeader()
    }
  })

  if (!response.ok) {
    let message = ''
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        const payload = await response.json()
        message = payload.message || payload.error || ''
      } catch {
        message = ''
      }
    } else {
      message = await response.text()
    }
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="(.+?)"/)
  const filename = match ? match[1] : 'folder.zip'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function replaceDocumentFile(documentId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return request(`/api/documents/${documentId}/file`, {
    method: 'PUT',
    body: formData
  })
}

export function getActivities(scope, topic) {
  const params = new URLSearchParams()
  if (scope) params.set('scope', scope)
  if (topic) params.set('topic', topic)
  const query = params.toString()
  return request(`/api/activity${query ? `?${query}` : ''}`)
}

async function fetchDocumentFile(documentId) {
  const response = await fetch(`${API_BASE}/api/documents/${documentId}/download`, {
    headers: {
      ...getSessionRoleHeader()
    }
  })

  if (!response.ok) {
    let message = ''
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        const payload = await response.json()
        message = payload.message || payload.error || ''
      } catch {
        message = ''
      }
    } else {
      message = await response.text()
    }
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="(.+?)"/)
  const filename = match ? match[1] : 'document.pdf'
  const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream'

  return { blob, filename, contentType }
}

export async function openDocument(documentId) {
  const { blob, filename, contentType } = await fetchDocumentFile(documentId)
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  const canPreview = extension === 'pdf' || contentType.includes('pdf')
  const previewBlob = canPreview && !contentType.includes('pdf')
    ? new Blob([blob], { type: 'application/pdf' })
    : blob
  const url = URL.createObjectURL(previewBlob)

  if (canPreview) {
    const tab = window.open(url, '_blank')
    if (!tab) {
      URL.revokeObjectURL(url)
      throw new Error('Pop-up blocked. Allow pop-ups for this site to preview documents.')
    }
    tab.opener = null
    window.setTimeout(() => URL.revokeObjectURL(url), 120000)
    return { mode: 'preview', filename }
  }

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { mode: 'download', filename }
}

export async function downloadDocument(documentId) {
  const { blob, filename } = await fetchDocumentFile(documentId)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function fetchDocumentCoverObjectUrl(documentId) {
  if (!documentId) {
    return null
  }
  const response = await fetch(`${API_BASE}/api/documents/${documentId}/cover`, {
    headers: {
      ...getSessionRoleHeader()
    }
  })
  if (!response.ok) {
    return null
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export function deleteDocument(documentId) {
  return request(`/api/documents/${documentId}`, {
    method: 'DELETE'
  })
}

export function getArchivedDocuments() {
  return request('/api/documents/archived')
}

export function restoreDocument(documentId) {
  return request(`/api/documents/${documentId}/restore`, {
    method: 'POST'
  })
}

export function permanentlyDeleteDocument(documentId) {
  return request(`/api/documents/${documentId}/permanent`, {
    method: 'DELETE'
  })
}

export function submitUpload(metadata, file, coverPhoto, { validationOverride = false } = {}) {
  const formData = new FormData()
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  formData.append('file', file)
  if (coverPhoto) {
    formData.append('coverPhoto', coverPhoto)
  }
  const query = validationOverride ? '?validationOverride=true' : ''
  return request(`/api/documents/upload${query}`, {
    method: 'POST',
    body: formData
  })
}

export function updatePendingFinalYearProject(documentId, metadata, file, coverPhoto) {
  const formData = new FormData()
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  if (file) {
    formData.append('file', file)
  }
  if (coverPhoto) {
    formData.append('coverPhoto', coverPhoto)
  }
  return request(`/api/documents/${documentId}/final-year-project`, {
    method: 'PUT',
    body: formData
  })
}

export function getDocument(documentId) {
  return request(`/api/documents/${documentId}`)
}

export function scanDocument(file, context = {}) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('context', new Blob([JSON.stringify(context)], { type: 'application/json' }))
  return request('/api/documents/scan', {
    method: 'POST',
    body: formData
  })
}

export function decideApproval(id, decision, note) {
  return request(`/api/approvals/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, note })
  })
}

export function getAdminDashboard() {
  return request('/api/admin/dashboard')
}

export function getAdminPrivileges() {
  return request('/api/admin/privileges')
}

export function createAdminUser(payload) {
  return request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateAdminUser(userId, payload) {
  return request(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}

export function getAdminActivity({ scope, userId, category, page = 0, size = 50 } = {}) {
  const params = new URLSearchParams()
  if (scope) params.set('scope', scope)
  if (userId) params.set('userId', String(userId))
  if (category) params.set('category', category)
  params.set('page', String(page))
  params.set('size', String(size))
  const query = params.toString()
  return request(`/api/admin/activity${query ? `?${query}` : ''}`)
}

export function getAdminRecentActivity(limit = 5) {
  return request(`/api/admin/activity/recent?limit=${encodeURIComponent(limit)}`)
}

export function getAdminOffices() {
  return request('/api/admin/offices')
}

export function getAdminArchiveTemplate() {
  return request('/api/admin/archive-template')
}

export function createMobileScanSession() {
  return request('/api/mobile-scan/sessions', { method: 'POST' })
}

export function getMobileScanNetworkUrl(frontendPort = 5173) {
  const port = Number(frontendPort) > 0 ? Number(frontendPort) : 5173
  return request(`/api/mobile-scan/network-url?frontendPort=${encodeURIComponent(port)}`)
}

export function getMobileScanSession(token) {
  return request(`/api/mobile-scan/sessions/${encodeURIComponent(token)}`)
}

export function addMobileScanPage(token, imageBlob) {
  const formData = new FormData()
  formData.append('image', imageBlob, 'scan-page.jpg')
  return request(`/api/mobile-scan/sessions/${encodeURIComponent(token)}/pages`, {
    method: 'POST',
    body: formData
  })
}

export function reorderMobileScanPages(token, pageIds) {
  return request(`/api/mobile-scan/sessions/${encodeURIComponent(token)}/pages/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ pageIds })
  })
}

export function deleteMobileScanPage(token, pageId) {
  return request(`/api/mobile-scan/sessions/${encodeURIComponent(token)}/pages/${encodeURIComponent(pageId)}`, {
    method: 'DELETE'
  })
}

export function finalizeMobileScanSession(token) {
  return request(`/api/mobile-scan/sessions/${encodeURIComponent(token)}/finalize`, {
    method: 'POST'
  })
}

export async function downloadMobileScanPdf(token) {
  const response = await fetch(`${API_BASE}/api/mobile-scan/sessions/${encodeURIComponent(token)}/pdf`, {
    headers: {
      ...getSessionRoleHeader()
    }
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Unable to download scanned PDF.')
  }
  return response.blob()
}
