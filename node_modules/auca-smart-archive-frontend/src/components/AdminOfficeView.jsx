import React, { useEffect, useMemo, useState } from 'react'
import { getActivities, getAdminDashboard, openDocument, searchDocuments } from '../api'
import { FolderIcon, RefreshIcon } from './Icons'

const OFFICE_META = {
  REGISTRAR: {
    label: 'Registrar',
    department: 'Registrar Office',
    summary: 'Registration, reintegration, and application archive work.',
    categories: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'REG', 'SREG', 'SRIN', 'SAPP', 'FLD', 'STD']
  },
  EXAMINATION_OFFICER: {
    label: 'Examination Office',
    department: 'Examination Office',
    summary: 'Exam papers, marks, and course-level archive work.',
    categories: ['EXAMINATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'SEXM', 'FLD', 'STD']
  },
  HOD: {
    label: 'Head of Department',
    department: 'Department Office',
    summary: 'Department approvals and application submissions.',
    categories: ['APPLICATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'SAPP', 'FLD', 'STD']
  },
  STUDENT: {
    label: 'Student',
    department: 'Student Workspace',
    summary: 'Student project uploads and personal archive files.',
    categories: ['FINAL_YEAR_PROJECT'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'STD', 'STU', 'SFYP', 'SREG', 'SRIN', 'SAPP', 'MY', 'FLD']
  },
  LIBRARIAN: {
    label: 'Librarian',
    department: 'University Library',
    summary: 'Final year project review and archive approval.',
    categories: ['FINAL_YEAR_PROJECT'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'STD', 'SFYP', 'FLD']
  }
}

const CATEGORY_LABELS = {
  REGISTRATION_FORM: 'Registration Forms',
  REINTEGRATION_FORM: 'Reintegration Forms',
  APPLICATION_DOCUMENTS: 'Application Documents',
  EXAMINATION_DOCUMENTS: 'Exams',
  FINAL_YEAR_PROJECT: 'Final Year Project'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function activityCategoryLabel(category) {
  const normalized = String(category || '').toUpperCase()
  if (normalized === 'UPLOAD') return 'Upload'
  if (normalized === 'APPROVAL') return 'Approval'
  if (normalized === 'ARCHIVE') return 'Archive'
  if (normalized === 'SHARE') return 'Share'
  if (normalized === 'SYNC') return 'Sync'
  return normalized || 'Action'
}

function roleLabel(role) {
  return OFFICE_META[role]?.label
    || String(role || '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
}

function officeFolderPrefixes(role) {
  return OFFICE_META[role]?.folderPrefixes || ['AUCA', 'FAC', 'AY', 'SEM', 'FLD', 'STD']
}

function folderMatchesOffice(node, prefixes) {
  const code = String(node?.code || '').toUpperCase()
  if (!code) {
    return true
  }
  return prefixes.some((prefix) => {
    const token = String(prefix || '').toUpperCase()
    if (!token) {
      return false
    }
    return code === token
      || code.startsWith(`${token}-`)
      || code.includes(`-${token}-`)
      || code.endsWith(`-${token}`)
  })
}

function isStudentDocumentFolder(node) {
  const code = String(node?.code || '').toUpperCase()
  const name = String(node?.name || '').toLowerCase()
  return code.includes('-STU-')
    || code.includes('-SFYP')
    || code.endsWith('SFYP')
    || code.includes('-MY-')
    || code.includes('-SREG')
    || code.includes('-SRIN')
    || code.includes('-SAPP')
    || name.includes('final year project')
    || name.includes('fyp')
    || name.includes('student')
}

function isStructureFolderForStudentPath(node) {
  const code = String(node?.code || '').toUpperCase()
  return code === 'AUCA'
    || /^FAC-[A-Z0-9]+$/.test(code)
    || /^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$/.test(code)
    || code.includes('-AY-')
    || code.includes('-SEM-')
    || /^AY-/.test(code)
    || /^SEM-/.test(code)
}

function filterArchiveTreeForOffice(nodes, role) {
  if (role === 'STUDENT') {
    function walkStudent(list) {
      return (list || []).reduce((acc, node) => {
        const children = walkStudent(node.children || [])
        const keep = isStudentDocumentFolder(node)
          || isStructureFolderForStudentPath(node)
          || children.length
        if (keep) {
          acc.push({
            ...node,
            children
          })
        }
        return acc
      }, [])
    }
    return walkStudent(nodes)
  }

  const prefixes = officeFolderPrefixes(role)

  function walk(list) {
    return (list || []).reduce((acc, node) => {
      const children = walk(node.children || [])
      const selfVisible = folderMatchesOffice(node, prefixes)
      if (selfVisible || children.length) {
        acc.push({
          ...node,
          children
        })
      }
      return acc
    }, [])
  }

  return walk(nodes)
}

function collectExpandedIds(nodes, depth = 0, expanded = new Set()) {
  for (const node of nodes || []) {
    if (depth < 2) {
      expanded.add(node.id)
    }
    if (node.children?.length) {
      collectExpandedIds(node.children, depth + 1, expanded)
    }
  }
  return expanded
}

function OfficeArchiveTree({ nodes, onOpenFolder, isStudentOffice = false }) {
  const [expandedIds, setExpandedIds] = useState(() => collectExpandedIds(nodes))
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setExpandedIds(collectExpandedIds(nodes))
  }, [nodes])

  const visibleNodes = useMemo(() => {
    const trimmed = filter.trim().toLowerCase()
    if (!trimmed) {
      return nodes
    }
    function walk(list) {
      return (list || []).reduce((acc, node) => {
        const children = walk(node.children || [])
        const matches = String(node.name || '').toLowerCase().includes(trimmed)
          || String(node.code || '').toLowerCase().includes(trimmed)
        if (matches || children.length) {
          acc.push({ ...node, children })
        }
        return acc
      }, [])
    }
    return walk(nodes)
  }, [nodes, filter])

  function toggleExpand(folderId) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  function renderNodes(list) {
    return (
      <ul className="tree-list office-tree-list" role="tree">
        {(list || []).map((node) => {
          const hasChildren = Boolean(node.children?.length)
          const isExpanded = expandedIds.has(node.id)
          return (
            <li key={node.id} className="tree-item" role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
              <div className="tree-item-row">
                <button
                  type="button"
                  className={`tree-toggle ${hasChildren ? '' : 'tree-toggle-spacer'}`}
                  onClick={hasChildren ? () => toggleExpand(node.id) : undefined}
                  tabIndex={hasChildren ? 0 : -1}
                  aria-hidden={!hasChildren}
                >
                  {hasChildren ? (
                    <span className={`office-tree-chevron ${isExpanded ? 'expanded' : ''}`}>▸</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="tree-label-btn"
                  onClick={() => onOpenFolder?.(node.id)}
                  title={`Open ${node.name}`}
                >
                  <FolderIcon className="icon folder tree-folder" />
                  <span className="tree-label">{node.name}</span>
                </button>
                <span className="tree-count">{node.itemCount ?? 0}</span>
              </div>
              {hasChildren && isExpanded ? (
                <div className="tree-children">
                  {renderNodes(node.children)}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="admin-office-tree">
      <label className="admin-office-tree-filter">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={isStudentOffice ? 'Filter student archive folders...' : 'Filter this office archive...'}
          aria-label={isStudentOffice ? 'Filter student archive folders' : 'Filter office archive tree'}
        />
      </label>
      <div className="admin-office-tree-scroll">
        {visibleNodes.length ? renderNodes(visibleNodes) : (
          <p className="admin-muted-cell">No archive folders visible for this office yet.</p>
        )}
      </div>
    </div>
  )
}

export function buildAdminOffices(users = [], usersByRole = {}) {
  const roles = new Set()
  Object.keys(usersByRole || {}).forEach((role) => {
    if (role && role !== 'ADMIN') {
      roles.add(role)
    }
  })
  ;(users || []).forEach((user) => {
    if (user?.role && user.role !== 'ADMIN') {
      roles.add(user.role)
    }
  })

  const preferred = ['REGISTRAR', 'EXAMINATION_OFFICER', 'HOD', 'LIBRARIAN', 'STUDENT']
  const ordered = [
    ...preferred.filter((role) => roles.has(role)),
    ...[...roles].filter((role) => !preferred.includes(role)).sort()
  ]

  return ordered.map((role) => {
    const meta = OFFICE_META[role]
    const count = Number(usersByRole?.[role] || (users || []).filter((user) => user.role === role).length || 0)
    return {
      role,
      label: meta?.label || roleLabel(role),
      department: meta?.department || roleLabel(role),
      summary: meta?.summary || `Live archive activity for ${roleLabel(role)}.`,
      categories: meta?.categories || [],
      userCount: count
    }
  })
}

export default function AdminOfficeView({
  officeRole,
  archiveTree = [],
  onNotify,
  onOpenFolder,
  onBack
}) {
  const [users, setUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const office = useMemo(() => {
    const meta = OFFICE_META[officeRole] || {}
    return {
      role: officeRole,
      label: meta.label || roleLabel(officeRole),
      department: meta.department || roleLabel(officeRole),
      summary: meta.summary || `Live archive activity for ${roleLabel(officeRole)}.`,
      categories: meta.categories || []
    }
  }, [officeRole])

  const officeArchiveTree = useMemo(
    () => filterArchiveTreeForOffice(archiveTree, officeRole),
    [archiveTree, officeRole]
  )

  async function loadOffice(silent = false) {
    if (!officeRole) {
      return
    }
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const [dashboard, activityEntries, allDocuments] = await Promise.all([
        getAdminDashboard(),
        getActivities(officeRole),
        searchDocuments('')
      ])
      const officeUsers = (dashboard?.users || []).filter((user) => user.role === officeRole)
      const usernames = new Set(officeUsers.map((user) => String(user.username || '').toLowerCase()))
      const fullNames = new Set(officeUsers.map((user) => String(user.fullName || '').toLowerCase()))
      const categorySet = new Set(office.categories)

      const officeDocuments = (allDocuments || []).filter((doc) => {
        if (categorySet.size && categorySet.has(doc.category)) {
          return true
        }
        const owner = String(doc.ownerName || '').toLowerCase()
        return usernames.has(owner) || fullNames.has(owner)
      })

      setUsers(officeUsers)
      setActivities(activityEntries || [])
      setDocuments(officeDocuments)
      setLastUpdatedAt(new Date())
    } catch (err) {
      onNotify?.(err.message || 'Unable to load office updates.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadOffice(false)
    const timer = window.setInterval(() => {
      loadOffice(true)
    }, 15000)
    return () => window.clearInterval(timer)
  }, [officeRole])

  if (loading) {
    return (
      <section className="admin-page admin-office-page">
        <p className="admin-loading">Loading {office.label} office…</p>
      </section>
    )
  }

  return (
    <section className="admin-page admin-office-page">
      <header className="admin-office-top">
        <div>
          <button type="button" className="ghost-btn admin-office-back" onClick={onBack}>
            Back to users
          </button>
          <h1>{office.label}</h1>
          <p>{office.summary}</p>
          <span className="dash-meta">
            {office.department}
            {lastUpdatedAt ? ` · Updated ${formatDateTime(lastUpdatedAt)}` : ''}
            {refreshing ? ' · Refreshing…' : ''}
          </span>
        </div>
        <button
          type="button"
          className="ghost-btn admin-btn-sm"
          onClick={() => loadOffice(true)}
          disabled={refreshing}
        >
          <RefreshIcon className="icon" />
          Refresh
        </button>
      </header>

      <div className="admin-overview">
        <dl className="admin-metrics">
          <div className="admin-metric">
            <dt>Accounts</dt>
            <dd>{users.length}</dd>
          </div>
          <div className="admin-metric">
            <dt>Active</dt>
            <dd>{users.filter((user) => user.active).length}</dd>
          </div>
          <div className="admin-metric">
            <dt>Documents</dt>
            <dd>{documents.length}</dd>
          </div>
          <div className="admin-metric">
            <dt>Recent actions</dt>
            <dd>{activities.length}</dd>
          </div>
        </dl>
      </div>

      <div className="admin-card admin-office-tree-card">
        <div className="admin-activity-head">
          <div>
            <h2>{office.role === 'STUDENT' ? 'Student archive tree' : `${office.label} archive tree`}</h2>
            <p>
              {office.role === 'STUDENT'
                ? 'Archive folders where student documents are saved, including Final Year Project folders.'
                : 'Folders this office can access. Click a folder to open it.'}
            </p>
          </div>
        </div>
        <OfficeArchiveTree
          nodes={officeArchiveTree}
          onOpenFolder={onOpenFolder}
          isStudentOffice={office.role === 'STUDENT'}
        />
      </div>

      <div className="admin-office-grid">
        <div className="admin-card">
          <div className="admin-activity-head">
            <div>
              <h2>Office accounts</h2>
              <p>Users assigned to this office.</p>
            </div>
          </div>
          <div className="table-shell admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {users.length ? users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <strong>{user.fullName}</strong>
                        <span>{user.department}</span>
                      </div>
                    </td>
                    <td>{user.username}</td>
                    <td>
                      <span className={`admin-status ${user.active ? 'is-active' : 'is-inactive'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="admin-muted-cell">{formatDateTime(user.lastLoginAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="admin-muted-cell">No accounts in this office yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-activity-head">
            <div>
              <h2>Live activity</h2>
              <p>Newest actions related to this office.</p>
            </div>
          </div>
          <div className="table-shell admin-table-shell">
            <table className="admin-table admin-activity-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>By</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {activities.length ? activities.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.message}</strong></td>
                    <td>{entry.actor}</td>
                    <td><span className="admin-tag">{activityCategoryLabel(entry.category)}</span></td>
                    <td className="admin-muted-cell">{formatDateTime(entry.createdAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="admin-muted-cell">No recent activity for this office.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-activity-head">
          <div>
            <h2>Saved documents</h2>
            <p>Files linked to this office’s categories and users.</p>
          </div>
        </div>
        <div className="table-shell admin-table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Student</th>
                <th>Category</th>
                <th>Department</th>
                <th>Modified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documents.length ? documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="admin-user-cell">
                      <strong>{doc.title}</strong>
                      <span>{doc.fileName}</span>
                    </div>
                  </td>
                  <td>
                    <strong>{doc.studentNumber || '-'}</strong>
                    <div className="admin-muted-cell">{doc.ownerName || '-'}</div>
                  </td>
                  <td><span className="admin-tag">{CATEGORY_LABELS[doc.category] || doc.category || '-'}</span></td>
                  <td>{doc.department || '-'}</td>
                  <td className="admin-muted-cell">{formatDateTime(doc.modifiedAt || doc.issueDate)}</td>
                  <td>
                    <div className="admin-office-doc-actions">
                      {doc.folderId ? (
                        <button
                          type="button"
                          className="admin-row-action"
                          onClick={() => onOpenFolder?.(doc.folderId)}
                        >
                          <FolderIcon className="icon tiny" />
                          Open
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-row-action"
                        onClick={() => openDocument(doc.id).catch((err) => onNotify?.(err.message || 'Unable to open document.'))}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="admin-muted-cell">No documents saved for this office yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
