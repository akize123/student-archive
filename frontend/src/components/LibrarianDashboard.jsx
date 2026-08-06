import React, { useState, useMemo } from 'react'
import { CheckIcon, ChevronDownIcon, DocumentIcon, DownloadIcon, FolderIcon } from './Icons'

const LIBRARIAN_FYP_PANEL_KEY = 'librarian-fyp-panel-open'
const LIBRARIAN_ACTIVITY_PANEL_KEY = 'librarian-activity-panel-open'

function loadPanelOpen(storageKey, defaultOpen = true) {
  if (typeof window === 'undefined') {
    return defaultOpen
  }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw == null) {
      return defaultOpen
    }
    return raw !== 'false'
  } catch {
    return defaultOpen
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
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

function formatShortDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(value))
}

function formatTimeAgo(value) {
  if (!value) return '-'
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0 || isNaN(diffMs)) return 'just now'
  
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  
  return formatShortDate(value)
}

function statusBadge(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'APPROVED') return 'librarian-badge accepted'
  if (normalized === 'REJECTED') return 'librarian-badge rejected'
  return 'librarian-badge pending'
}

function statusLabel(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'APPROVED') return 'Accepted'
  if (normalized === 'REJECTED') return 'Rejected'
  return 'Pending review'
}

function activityCategoryBadge(category) {
  const normalized = String(category || '').toUpperCase()
  if (normalized.includes('APPROVAL')) return { label: 'Approval', className: 'cat-approval' }
  if (normalized.includes('UPLOAD')) return { label: 'Upload', className: 'cat-upload' }
  if (normalized.includes('ARCHIVE')) return { label: 'Archive', className: 'cat-archive' }
  if (normalized.includes('SHARE')) return { label: 'Share', className: 'cat-share' }
  return { label: category || 'Action', className: 'cat-default' }
}

export default function LibrarianDashboard({
  session,
  dashboard,
  onNotify,
  onOpenDocument,
  onOpenFolder,
  onBrowse,
  onReviewTask
}) {
  const [submissionTab, setSubmissionTab] = useState('pending')
  const [activityCategoryFilter, setActivityCategoryFilter] = useState('ALL')
  const [fypPanelOpen, setFypPanelOpen] = useState(() => loadPanelOpen(LIBRARIAN_FYP_PANEL_KEY, true))
  const [activityPanelOpen, setActivityPanelOpen] = useState(() => loadPanelOpen(LIBRARIAN_ACTIVITY_PANEL_KEY, true))

  const approvalList = dashboard.awaitingApproval || []
  const pendingApprovals = useMemo(
    () => approvalList.filter((task) => String(task.status || '').toUpperCase() === 'PENDING'),
    [approvalList]
  )
  const acceptedApprovals = useMemo(
    () => approvalList.filter((task) => String(task.status || '').toUpperCase() === 'APPROVED'),
    [approvalList]
  )
  const rejectedApprovals = useMemo(
    () => approvalList.filter((task) => String(task.status || '').toUpperCase() === 'REJECTED'),
    [approvalList]
  )

  const storagePercent = dashboard.storageLimitBytes
    ? Math.min(100, Math.round((dashboard.storageUsedBytes / dashboard.storageLimitBytes) * 100))
    : 0

  const visibleSubmissions = useMemo(() => {
    if (submissionTab === 'pending') {
      return pendingApprovals
    }
    if (submissionTab === 'accepted') {
      return acceptedApprovals
    }
    if (submissionTab === 'rejected') {
      return rejectedApprovals
    }
    return approvalList
  }, [submissionTab, pendingApprovals, acceptedApprovals, rejectedApprovals, approvalList])

  const rawActivities = dashboard.recentActivity || dashboard.departmentActivity || []
  
  const filteredActivities = useMemo(() => {
    if (activityCategoryFilter === 'ALL') {
      return rawActivities
    }
    return rawActivities.filter((entry) => {
      const cat = String(entry.category || '').toUpperCase()
      return cat.includes(activityCategoryFilter)
    })
  }, [rawActivities, activityCategoryFilter])

  function togglePanel(storageKey, setter) {
    setter((current) => {
      const next = !current
      try {
        window.localStorage.setItem(storageKey, String(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }

  return (
    <section className="librarian-dashboard">
      {/* Top Header Banner */}
      <header className="librarian-top">
        <div className="librarian-top-copy">
          <div className="librarian-title-row">
            <h1>Library Dashboard</h1>
          </div>
        </div>
        <div className="librarian-top-actions">
          {onBrowse ? (
            <button type="button" className="ghost-btn librarian-top-btn" onClick={onBrowse}>
              <FolderIcon className="icon" />
              Browse Archive Folders
            </button>
          ) : null}
        </div>
      </header>

      {/* Unified workspace card */}
      <div className="librarian-workspace-card">
        <div className="librarian-metrics">
        <article className="librarian-metric metric-pending">
          <div className="librarian-metric-icon-wrap" aria-hidden="true">
            <DocumentIcon className="icon" />
          </div>
          <div className="librarian-metric-body">
            <span className="librarian-metric-label">Pending Reviews</span>
            <div className="librarian-metric-val-row">
              <strong>{pendingApprovals.length}</strong>
              {pendingApprovals.length > 0 ? (
                <span className="librarian-badge-chip pending-chip">Needs attention</span>
              ) : (
                <span className="librarian-badge-chip neutral-chip">All caught up</span>
              )}
            </div>
            <span className="librarian-metric-caption">FYP submissions awaiting review</span>
          </div>
        </article>

        <article className="librarian-metric metric-files">
          <div className="librarian-metric-icon-wrap" aria-hidden="true">
            <FolderIcon className="icon" />
          </div>
          <div className="librarian-metric-body">
            <span className="librarian-metric-label">Department Files</span>
            <div className="librarian-metric-val-row">
              <strong>{dashboard.departmentFiles ?? 0}</strong>
              <span className="librarian-badge-chip neutral-chip">Total Documents</span>
            </div>
            <span className="librarian-metric-caption">Across all academic departments</span>
          </div>
        </article>

        <article className="librarian-metric metric-storage">
          <div className="librarian-metric-icon-wrap" aria-hidden="true">
            <DownloadIcon className="icon" />
          </div>
          <div className="librarian-metric-body">
            <span className="librarian-metric-label">Storage Capacity</span>
            <div className="librarian-metric-val-row">
              <strong>{formatBytes(dashboard.storageUsedBytes)}</strong>
              <span className="librarian-badge-chip neutral-chip">
                {storagePercent.toFixed(0)}% used
              </span>
            </div>
            <div className="librarian-storage-bar-track">
              <div
                className="librarian-storage-bar-fill"
                style={{ width: `${Math.max(4, storagePercent)}%` }}
              />
            </div>
            <span className="librarian-metric-caption">
              of {formatBytes(dashboard.storageLimitBytes)} total allocated storage
            </span>
          </div>
        </article>
        </div>

        <section className={`librarian-panel ${fypPanelOpen ? 'is-open' : 'is-collapsed'}`}>
          <button
            type="button"
            className="librarian-panel-toggle"
            aria-expanded={fypPanelOpen}
            onClick={() => togglePanel(LIBRARIAN_FYP_PANEL_KEY, setFypPanelOpen)}
          >
            <h2 className="librarian-panel-title">Final Year Project Submissions</h2>
            <span className="librarian-panel-count">{approvalList.length} total</span>
            <ChevronDownIcon className={`icon small librarian-panel-chevron ${fypPanelOpen ? 'is-open' : ''}`} />
          </button>

          {fypPanelOpen ? (
            <div className="librarian-panel-body">
              <div className="librarian-panel-toolbar">
                <div className="librarian-tabs" role="tablist">
                  <button
                    type="button"
                    className={`librarian-tab ${submissionTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setSubmissionTab('pending')}
                  >
                    Pending ({pendingApprovals.length})
                  </button>
                  <button
                    type="button"
                    className={`librarian-tab ${submissionTab === 'accepted' ? 'active' : ''}`}
                    onClick={() => setSubmissionTab('accepted')}
                  >
                    Accepted ({acceptedApprovals.length})
                  </button>
                  <button
                    type="button"
                    className={`librarian-tab ${submissionTab === 'rejected' ? 'active' : ''}`}
                    onClick={() => setSubmissionTab('rejected')}
                  >
                    Rejected ({rejectedApprovals.length})
                  </button>
                  <button
                    type="button"
                    className={`librarian-tab ${submissionTab === 'all' ? 'active' : ''}`}
                    onClick={() => setSubmissionTab('all')}
                  >
                    All ({approvalList.length})
                  </button>
                </div>
              </div>

              <div className="table-shell librarian-table-shell">
          <table className="librarian-table">
            <thead>
              <tr>
                <th>Project Title</th>
                <th>Student Details</th>
                <th>Submission Date</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="align-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleSubmissions.length ? (
                visibleSubmissions.map((task) => (
                  <tr key={task.id} className={`librarian-row-${String(task.status || '').toLowerCase()}`}>
                    <td>
                      <div className="librarian-doc-cell">
                        <div className="doc-icon-badge">
                          <DocumentIcon className="icon doc" />
                        </div>
                        <div className="doc-details">
                          <strong className="doc-title">{task.documentTitle}</strong>
                          {task.note ? <span className="librarian-note-hint">{task.note}</span> : null}
                          {task.githubUrl ? (
                            <span className="doc-meta-link">GitHub: {task.githubUrl}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="student-cell">
                        <span className="student-name">{task.requestedBy || 'Student'}</span>
                        {task.studentNumber ? (
                          <span className="student-id-tag">{task.studentNumber}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="librarian-muted">
                      {formatShortDate(task.requestedAt)}
                    </td>
                    <td>
                      <span className={`priority ${String(task.priority || 'MEDIUM').toLowerCase()}`}>
                        {task.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <span className={statusBadge(task.status)}>
                        {statusLabel(task.status)}
                      </span>
                    </td>
                    <td className="align-right">
                      <div className="librarian-actions">
                        {String(task.status || '').toUpperCase() === 'PENDING' ? (
                          <button
                            type="button"
                            className="primary-btn librarian-btn-sm"
                            onClick={() => onReviewTask?.(task)}
                          >
                            <CheckIcon className="icon tiny" />
                            Review
                          </button>
                        ) : null}
                        {task.documentId ? (
                          <button
                            type="button"
                            className="ghost-btn librarian-btn-sm"
                            onClick={() => onOpenDocument?.(task.documentId)}
                            title="Open submitted file"
                          >
                            <DownloadIcon className="icon tiny" />
                            File
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="librarian-empty-state">
                    <div className="empty-wrap">
                      <DocumentIcon className="icon empty-icon" />
                      <p className="empty-title">
                        {submissionTab === 'pending'
                          ? 'No pending submissions'
                          : submissionTab === 'accepted'
                            ? 'No accepted projects recorded'
                            : submissionTab === 'rejected'
                              ? 'No rejected projects'
                              : 'No submissions found'}
                      </p>
                      <p className="empty-sub">
                        {submissionTab === 'pending'
                          ? 'All student final year project submissions have been reviewed!'
                          : 'Student project submissions will appear here once submitted and reviewed.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className={`librarian-panel librarian-activity-panel ${activityPanelOpen ? 'is-open' : 'is-collapsed'}`}>
          <button
            type="button"
            className="librarian-panel-toggle"
            aria-expanded={activityPanelOpen}
            onClick={() => togglePanel(LIBRARIAN_ACTIVITY_PANEL_KEY, setActivityPanelOpen)}
          >
            <h2 className="librarian-panel-title">Recent Activity Timeline</h2>
            <span className="librarian-panel-count">{filteredActivities.length} shown</span>
            <ChevronDownIcon className={`icon small librarian-panel-chevron ${activityPanelOpen ? 'is-open' : ''}`} />
          </button>

          {activityPanelOpen ? (
            <div className="librarian-panel-body">
              <div className="librarian-panel-toolbar">
                <div className="activity-filter-tabs">
                  <button
                    type="button"
                    className={`activity-filter-btn ${activityCategoryFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('ALL')}
                  >
                    All Activity
                  </button>
                  <button
                    type="button"
                    className={`activity-filter-btn ${activityCategoryFilter === 'APPROVAL' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('APPROVAL')}
                  >
                    Approvals
                  </button>
                  <button
                    type="button"
                    className={`activity-filter-btn ${activityCategoryFilter === 'UPLOAD' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('UPLOAD')}
                  >
                    Uploads
                  </button>
                  <button
                    type="button"
                    className={`activity-filter-btn ${activityCategoryFilter === 'ARCHIVE' ? 'active' : ''}`}
                    onClick={() => setActivityCategoryFilter('ARCHIVE')}
                  >
                    Archive
                  </button>
                </div>
              </div>

              <div className="librarian-timeline-shell">
          {filteredActivities.length ? (
            <div className="librarian-timeline">
              {filteredActivities.map((entry, index) => {
                const catMeta = activityCategoryBadge(entry.category)
                return (
                  <div key={entry.id || index} className="timeline-item">
                    <div className="timeline-marker">
                      <span className={`timeline-dot ${catMeta.className}`} />
                      {index < filteredActivities.length - 1 ? <div className="timeline-line" /> : null}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <strong className="timeline-message">{entry.message}</strong>
                        <span className={`timeline-cat-pill ${catMeta.className}`}>
                          {catMeta.label}
                        </span>
                      </div>
                      <div className="timeline-meta-row">
                        <span className="timeline-actor">
                          By <strong>{entry.actor || entry.actorUsername || 'Librarian'}</strong>
                        </span>
                        {entry.studentNumber ? (
                          <span className="timeline-student-tag">Student ID: {entry.studentNumber}</span>
                        ) : null}
                        {entry.academicDepartment ? (
                          <span className="timeline-dept-tag">{entry.academicDepartment}</span>
                        ) : null}
                        <span className="timeline-time" title={formatDateTime(entry.createdAt)}>
                          {formatTimeAgo(entry.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="librarian-empty-state">
              <div className="empty-wrap">
                <FolderIcon className="icon empty-icon" />
                <p className="empty-title">No recent activity recorded</p>
                <p className="empty-sub">Actions taken in the library workspace will be tracked in real-time here.</p>
              </div>
            </div>
          )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}
