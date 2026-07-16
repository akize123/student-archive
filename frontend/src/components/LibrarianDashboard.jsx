import React, { useState } from 'react'
import { CheckIcon, DocumentIcon, DownloadIcon, FolderIcon, XIcon } from './Icons'

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

export default function LibrarianDashboard({
  session,
  dashboard,
  onNotify,
  onOpenDocument,
  onOpenFolder,
  onBrowse,
  onReviewTask
}) {
  const [tab, setTab] = useState('pending')

  const approvalList = dashboard.awaitingApproval || []
  const pendingApprovals = approvalList.filter((task) => String(task.status || '').toUpperCase() === 'PENDING')
  const storagePercent = dashboard.storageLimitBytes
    ? Math.min(100, Math.round((dashboard.storageUsedBytes / dashboard.storageLimitBytes) * 100))
    : 0

  return (
    <section className="librarian-dashboard">
      <header className="librarian-top">
        <div className="librarian-top-copy">
          <h1>Library Dashboard</h1>
          <p>Review final year project submissions and manage library archives.</p>
        </div>
      </header>

      <div className="librarian-metrics">
        <article className="librarian-metric">
          <span className="librarian-metric-icon" aria-hidden="true">
            <DocumentIcon className="icon" />
          </span>
          <div className="librarian-metric-body">
            <span className="librarian-metric-label">Pending reviews</span>
            <strong>{pendingApprovals.length}</strong>
            <span className="librarian-metric-caption">FYP submissions</span>
          </div>
        </article>
        <article className="librarian-metric">
          <span className="librarian-metric-icon" aria-hidden="true">
            <FolderIcon className="icon" />
          </span>
          <div className="librarian-metric-body">
            <span className="librarian-metric-label">Department files</span>
            <strong>{dashboard.departmentFiles ?? 0}</strong>
            <span className="librarian-metric-caption">All departments</span>
          </div>
        </article>
        <article className="librarian-metric">
          <span className="librarian-metric-icon" aria-hidden="true">
            <DownloadIcon className="icon" />
          </span>
          <div className="librarian-metric-body">
            <span className="librarian-metric-label">Storage used</span>
            <strong>{formatBytes(dashboard.storageUsedBytes)}</strong>
            <span className="librarian-metric-caption">of {formatBytes(dashboard.storageLimitBytes)} ({storagePercent.toFixed(0)}%)</span>
          </div>
        </article>
      </div>

      <div className="librarian-card">
        <div className="librarian-card-head">
          <div>
            <h2>FYP Submissions</h2>
            <p>Review and approve or reject student final year project submissions.</p>
          </div>
          <div className="librarian-tabs">
            <button
              type="button"
              className={`librarian-tab ${tab === 'pending' ? 'active' : ''}`}
              onClick={() => setTab('pending')}
            >
              Pending ({pendingApprovals.length})
            </button>
            <button
              type="button"
              className={`librarian-tab ${tab === 'all' ? 'active' : ''}`}
              onClick={() => setTab('all')}
            >
              All ({approvalList.length})
            </button>
          </div>
        </div>

        <div className="table-shell librarian-table-shell">
          <table className="librarian-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Student</th>
                <th>Date</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'pending' ? pendingApprovals : approvalList).length ? (
                (tab === 'pending' ? pendingApprovals : approvalList).map((task) => (
                  <tr key={task.id}>
                    <td>
                      <div className="librarian-doc-cell">
                        <DocumentIcon className="icon doc" />
                        <div>
                          <strong>{task.documentTitle}</strong>
                          {task.note ? <span className="librarian-note-hint">{task.note}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>{task.requestedBy}</span>
                        {task.studentNumber ? <span className="librarian-muted">{task.studentNumber}</span> : null}
                      </div>
                    </td>
                    <td className="librarian-muted">{formatShortDate(task.requestedAt)}</td>
                    <td><span className={`priority ${String(task.priority || '').toLowerCase()}`}>{task.priority}</span></td>
                    <td><span className={statusBadge(task.status)}>{statusLabel(task.status)}</span></td>
                    <td>
                      <div className="librarian-actions">
                        {String(task.status || '').toUpperCase() === 'PENDING' ? (
                          <button
                            type="button"
                            className="primary-btn librarian-btn-sm"
                            onClick={() => onReviewTask?.(task)}
                          >
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
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">
                    {tab === 'pending'
                      ? 'No pending submissions. All caught up!'
                      : 'No project submissions recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="librarian-card">
        <div className="librarian-card-head">
          <div>
            <h2>Recent activity</h2>
            <p>Latest actions across the library workspace.</p>
          </div>
        </div>
        <div className="librarian-activity-list">
          {(dashboard.departmentActivity || []).length ? (
            (dashboard.departmentActivity || []).map((entry) => (
              <div key={entry.id} className="librarian-activity-row">
                <div className="librarian-activity-dot" />
                <div className="librarian-activity-body">
                  <strong>{entry.message}</strong>
                  <span>{entry.actor} · {formatDateTime(entry.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="librarian-empty">No activity recorded yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}
