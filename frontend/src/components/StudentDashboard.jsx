import React, { useMemo } from 'react'
import { DocumentIcon, DownloadIcon, UploadIcon } from './Icons'
import StudentReservationsPanel from './StudentReservationsPanel'

const registrarCategories = new Set([
  'REGISTRATION_FORM',
  'REINTEGRATION_FORM',
  'APPLICATION_DOCUMENTS'
])

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(value))
}

function statusLabel(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'APPROVED') return 'Accepted'
  if (normalized === 'REJECTED') return 'Rejected'
  return 'Pending review'
}

export default function StudentDashboard({
  session,
  dashboard,
  fypCounts = { pending: 0, rejected: 0, accepted: 0 },
  fypTab = 'pending',
  onFypTabChange,
  onOpenDocument,
  onEditFinalYearProject,
  onStartProject,
  onNotify,
  reservationRefreshToken = 0,
  profileMenu
}) {
  const storagePercent = dashboard.storageLimitBytes
    ? Math.min(100, Math.round((dashboard.storageUsedBytes / dashboard.storageLimitBytes) * 100))
    : 0
  const storageState = storagePercent >= 95 ? 'critical' : storagePercent >= 80 ? 'warning' : 'healthy'

  const documents = dashboard.recentFiles || []
  const receivedDocuments = useMemo(
    () => documents.filter((item) => registrarCategories.has(item.category)),
    [documents]
  )
  const personalDocuments = useMemo(
    () => documents.filter((item) => item.category === 'FINAL_YEAR_PROJECT'),
    [documents]
  )
  const pendingProjects = useMemo(
    () => personalDocuments.filter((item) => String(item.status || '').toUpperCase() === 'PENDING'),
    [personalDocuments]
  )
  const acceptedProjects = useMemo(
    () => personalDocuments.filter((item) => String(item.status || '').toUpperCase() === 'APPROVED'),
    [personalDocuments]
  )
  const rejectedProjects = useMemo(
    () => personalDocuments.filter((item) => String(item.status || '').toUpperCase() === 'REJECTED'),
    [personalDocuments]
  )

  const visibleProjects = fypTab === 'accepted'
    ? acceptedProjects
    : fypTab === 'rejected'
      ? rejectedProjects
      : pendingProjects

  function selectTab(tab) {
    onFypTabChange?.(tab)
  }

  return (
    <div className="dashboard-workspace student-dashboard">
      <header className="dash-header student-dash-header student-dash-header-compact">
        <div className="dash-header-copy">
          <nav className="dash-crumbs" aria-label="Breadcrumb">
            <span>Student workspace</span>
            <strong>{session.fullName}</strong>
          </nav>
          <div className="student-dash-title-row">
            <h1>My archive</h1>
            <span className="student-id-pill">{session.studentNumber}</span>
          </div>
        </div>
        <div className="dash-header-actions">
          {fypCounts.pending === 0 && fypCounts.rejected === 0 ? (
            <button className="primary-btn dash-action-btn" type="button" onClick={onStartProject}>
              <UploadIcon className="icon" />
              Submit project
            </button>
          ) : null}
          {profileMenu}
        </div>
      </header>

      {fypCounts.rejected > 0 ? (
        <div className="student-alert-banner student-alert-banner-compact" role="status">
          <strong>Revision required</strong>
          <span>
            {fypCounts.rejected} project{fypCounts.rejected === 1 ? '' : 's'} need{fypCounts.rejected === 1 ? 's' : ''} changes — open Rejected or edit below.
          </span>
        </div>
      ) : null}

      <section className={`student-overview-strip storage-${storageState}`} aria-label="Workspace overview">
        <div className="student-overview-storage">
          <span className="student-overview-label">Storage</span>
          <span className="student-overview-value">
            {formatBytes(dashboard.storageUsedBytes)} / {formatBytes(dashboard.storageLimitBytes)}
          </span>
          <div className="student-storage-meter student-storage-meter-slim" aria-hidden="true">
            <div className="student-storage-fill" style={{ width: `${storagePercent}%` }} />
          </div>
        </div>
        <div className="student-stat-chips" aria-label="Document counts">
          <span className="student-stat-chip">
            Registrar <strong>{receivedDocuments.length}</strong>
          </span>
          <span className="student-stat-chip">
            Pending <strong>{pendingProjects.length}</strong>
          </span>
          <span className="student-stat-chip">
            Accepted <strong>{acceptedProjects.length}</strong>
          </span>
          <span className="student-stat-chip">
            Rejected <strong>{rejectedProjects.length}</strong>
          </span>
        </div>
      </section>

      <div className="student-dashboard-panels">
        <section className="student-documents-panel student-documents-panel-compact">
          <div className="student-panel-head student-panel-head-split">
            <div>
              <p className="eyebrow">Final Year Project</p>
              <h2>Submission status</h2>
            </div>
            <div className="student-project-tabs" role="tablist" aria-label="Project status">
              <button
                type="button"
                role="tab"
                aria-selected={fypTab === 'pending'}
                className={fypTab === 'pending' ? 'active' : ''}
                onClick={() => selectTab('pending')}
              >
                Pending ({pendingProjects.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fypTab === 'accepted'}
                className={fypTab === 'accepted' ? 'active' : ''}
                onClick={() => selectTab('accepted')}
              >
                Accepted ({acceptedProjects.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fypTab === 'rejected'}
                className={fypTab === 'rejected' ? 'active' : ''}
                onClick={() => selectTab('rejected')}
              >
                Rejected ({rejectedProjects.length})
              </button>
            </div>
          </div>

          {visibleProjects.length ? (
            <div className="student-document-list" role="tabpanel">
              {visibleProjects.map((document) => (
                <article key={document.id} className="student-document-row student-project-row">
                  <div className="student-document-copy">
                    <DocumentIcon className="icon" />
                    <div>
                      <strong>{document.title}</strong>
                      <span>
                        {statusLabel(document.status)} · {formatBytes(document.sizeBytes)} · {formatDate(document.modifiedAt)}
                      </span>
                      {fypTab === 'rejected' && document.reviewNote ? (
                        <span className="student-feedback">Librarian feedback: {document.reviewNote}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="student-document-actions">
                    <button type="button" className="ghost-btn" onClick={() => onOpenDocument(document.id)}>
                      <DownloadIcon className="icon" />
                      View
                    </button>
                    {(fypTab === 'pending' || fypTab === 'rejected') ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => onEditFinalYearProject?.(document.id)}
                      >
                        {fypTab === 'rejected' ? 'Revise & resubmit' : 'Edit'}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="student-empty-copy student-empty-copy-compact" role="tabpanel">
              {fypTab === 'pending'
                ? 'No pending submissions. Use Submit project in the sidebar.'
                : fypTab === 'accepted'
                  ? 'No accepted projects yet.'
                  : 'No rejected projects.'}
            </p>
          )}
        </section>

        {receivedDocuments.length ? (
          <section className="student-documents-panel student-documents-panel-compact">
            <div className="student-panel-head">
              <div>
                <p className="eyebrow">Official Documents</p>
                <h2>From registrar</h2>
              </div>
            </div>
            <div className="student-document-list">
              {receivedDocuments.map((document) => (
                <article key={document.id} className="student-document-row">
                  <div className="student-document-copy">
                    <DocumentIcon className="icon" />
                    <div>
                      <strong>{document.title}</strong>
                      <span>{formatDate(document.issueDate)}</span>
                    </div>
                  </div>
                  <button type="button" className="ghost-btn" onClick={() => onOpenDocument(document.id)}>
                    <DownloadIcon className="icon" />
                    Open
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <StudentReservationsPanel onNotify={onNotify} onRefreshToken={reservationRefreshToken} />
      </div>
    </div>
  )
}
