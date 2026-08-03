import React, { useState, useMemo } from 'react'
import { CheckIcon, DocumentIcon, DownloadIcon, FolderIcon } from './Icons'



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

  const visibleSubmissions = useMemo(() => {
    if (submissionTab === 'pending') return pendingApprovals
    if (submissionTab === 'accepted') return acceptedApprovals
    if (submissionTab === 'rejected') return rejectedApprovals
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

  return (
    <section className="librarian-dashboard">
      {/* Top Header Banner */}
      <header className="librarian-top">
        <div className="librarian-top-copy">
          <div className="librarian-title-row">
            <h1>Library Dashboard</h1>
            <span className="librarian-pulse-badge">
              <span className="pulse-dot" /> Live Sync
            </span>
          </div>
          <p>Review final year project submissions, audit approvals, and manage library archives.</p>
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


      {/* FYP Submissions Table Card */}
      <div className="librarian-card">
        <div className="librarian-card-head">
          <h2>Final Year Project Submissions</h2>
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

      {/* Arranged Live Activity Timeline Card */}
      <div className="librarian-card librarian-activity-card">
        <div className="librarian-card-head">
          <div>
            <h2>Recent Activity Timeline</h2>
            <p>Chronological feed of approvals, uploads, and library archive management actions.</p>
          </div>
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
    </section>
  )
}
