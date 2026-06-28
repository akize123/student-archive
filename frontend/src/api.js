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
    if (!session?.role) {
      return {}
    }
    return { 'X-User-Role': session.role }
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

export async function downloadDocument(documentId) {
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
    throw new Error(message || `Download failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="(.+?)"/)
  const filename = match ? match[1] : 'document.pdf'
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

export function submitUpload(metadata, file) {
  const formData = new FormData()
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  formData.append('file', file)
  return request('/api/documents/upload', {
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
