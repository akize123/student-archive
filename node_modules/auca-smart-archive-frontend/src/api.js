const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'
const AUTH_SESSION_KEY = 'auca-archive-session'

function getSessionRoleHeader() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
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

export function searchDocuments(query, category) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (category) params.set('category', category)
  return request(`/api/documents${params.toString() ? `?${params.toString()}` : ''}`)
}

export function getStudentArchive(studentNumber) {
  return request(`/api/students/${encodeURIComponent(String(studentNumber || '').trim())}`)
}

export function getFolder(folderId) {
  return request(`/api/folders/${folderId}`)
}

export function createSubfolder(parentId, name) {
  return request(`/api/folders/${parentId}/subfolders`, {
    method: 'POST',
    body: JSON.stringify({ name })
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

export function shareFolder(folderId, targetRole) {
  return request(`/api/folders/${folderId}/share`, {
    method: 'POST',
    body: JSON.stringify({ targetRole })
  })
}

export async function downloadFolderZip(folderId, documentIds = []) {
  const params = new URLSearchParams()
  if (documentIds.length) {
    documentIds.forEach((id) => params.append('documentIds', String(id)))
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

export function submitUpload(metadata, file) {
  const formData = new FormData()
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  formData.append('file', file)
  return request('/api/documents/upload', {
    method: 'POST',
    body: formData
  })
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
