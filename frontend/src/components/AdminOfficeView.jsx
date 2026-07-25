import React, { useEffect, useMemo, useState } from 'react'
import { getAdminActivity, getAdminDashboard, getAdminOffices, openDocument, searchDocuments } from '../api'
import {
  CATEGORY_LABELS,
  OFFICE_META,
  roleLabel
} from '../adminOfficeUtils'
import { FolderIcon, RefreshIcon } from './Icons'

const ACTIVITY_PAGE_SIZE = 10

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

export default function AdminOfficeView({
  officeRole,
  onNotify,
  onOpenFolder,
  onBack,
  onShowArchiveTree
}) {
  const [users, setUsers] = useState([])
  const [officeMembers, setOfficeMembers] = useState([])
  const [activities, setActivities] = useState([])
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityPage, setActivityPage] = useState(0)
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const office = useMemo(() => {
    const meta = OFFICE_META[officeRole] || {}
    return {
      role: officeRole,
      label: meta.label || roleLabel(officeRole),
      categories: meta.categories || []
    }
  }, [officeRole])

  const hasMoreActivity = activities.length < activityTotal

  async function loadOfficeActivities(page = 0, append = false) {
    const activityResponse = await getAdminActivity({
      scope: officeRole,
      page,
      size: ACTIVITY_PAGE_SIZE
    })
    const items = activityResponse?.items || []
    setActivities((current) => (append ? [...current, ...items] : items))
    setActivityTotal(activityResponse?.total ?? items.length)
    setActivityPage(page)
    return activityResponse
  }

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
      const [dashboard, , allDocuments, officeData] = await Promise.all([
        getAdminDashboard(),
        loadOfficeActivities(0, false),
        searchDocuments(''),
        getAdminOffices()
      ])
      const officeUsers = (dashboard?.users || []).filter((user) => user.role === officeRole)
      const members = (officeData || []).find((entry) => entry.role === officeRole)?.members || []
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
      setOfficeMembers(members)
      setDocuments(officeDocuments)
      setLastUpdatedAt(new Date())
    } catch (err) {
      onNotify?.(err.message || 'Unable to load office updates.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadMoreActivities() {
    if (!hasMoreActivity || loadingMoreActivity) {
      return
    }
    setLoadingMoreActivity(true)
    try {
      await loadOfficeActivities(activityPage + 1, true)
    } catch (err) {
      onNotify?.(err.message || 'Unable to load more activity.')
    } finally {
      setLoadingMoreActivity(false)
    }
  }

  useEffect(() => {
    setActivities([])
    setActivityTotal(0)
    setActivityPage(0)
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
    <section className="admin-page admin-office-page admin-office-activity-panel">
      <header className="admin-office-top">
        <div>
          {onShowArchiveTree ? (
            <button type="button" className="ghost-btn admin-office-back" onClick={onShowArchiveTree}>
              Back to archive tree
            </button>
          ) : (
            <button type="button" className="ghost-btn admin-office-back" onClick={onBack}>
              Back to users
            </button>
          )}
          {lastUpdatedAt || refreshing ? (
            <span className="dash-meta">
              {lastUpdatedAt ? `Updated ${formatDateTime(lastUpdatedAt)}` : ''}
              {refreshing ? `${lastUpdatedAt ? ' · ' : ''}Refreshing…` : ''}
            </span>
          ) : null}
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
            <dd>{activityTotal}</dd>
          </div>
        </dl>
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
                  <th>Recent actions</th>
                  <th>Status</th>
                  <th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {officeMembers.length ? officeMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="admin-user-cell">
                        <strong>{member.fullName}</strong>
                        <span>{member.username}</span>
                      </div>
                    </td>
                    <td>{member.username}</td>
                    <td>{member.recentActivityCount ?? 0}</td>
                    <td>
                      <span className={`admin-status ${member.active ? 'is-active' : 'is-inactive'}`}>
                        {member.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="admin-muted-cell">
                      {formatDateTime(users.find((user) => user.id === member.id)?.lastLoginAt)}
                    </td>
                  </tr>
                )) : users.length ? users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <strong>{user.fullName}</strong>
                        <span>{user.username}</span>
                      </div>
                    </td>
                    <td>{user.username}</td>
                    <td>—</td>
                    <td>
                      <span className={`admin-status ${user.active ? 'is-active' : 'is-inactive'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="admin-muted-cell">{formatDateTime(user.lastLoginAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="admin-muted-cell">No accounts in this office yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card admin-live-activity-card">
          <div className="admin-activity-head">
            <div>
              <h2>Live activity</h2>
              <p>
                {activityTotal
                  ? `Showing ${activities.length} of ${activityTotal} actions for this office.`
                  : 'Newest actions related to this office.'}
              </p>
            </div>
          </div>
          <div className="table-shell admin-table-shell admin-live-activity-shell">
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
                    <td>{entry.actorUsername || entry.actor}</td>
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
          {hasMoreActivity ? (
            <div className="admin-live-activity-footer">
              <button
                type="button"
                className="ghost-btn admin-btn-sm"
                onClick={loadMoreActivities}
                disabled={loadingMoreActivity}
              >
                {loadingMoreActivity
                  ? 'Loading…'
                  : `Show more (${activityTotal - activities.length} remaining)`}
              </button>
            </div>
          ) : null}
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
