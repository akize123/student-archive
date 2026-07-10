import React, { useMemo, useState } from 'react'
import StudentFypWizard from './StudentFypWizard'
import { DocumentIcon, DownloadIcon, FolderPlusIcon, UploadIcon } from './Icons'

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

function categoryLabel(category) {
  const labels = {
    REGISTRATION_FORM: 'Registration',
    REINTEGRATION_FORM: 'Reintegration',
    APPLICATION_DOCUMENTS: 'Application',
    FINAL_YEAR_PROJECT: 'Final Year Project',
    EXAMINATION_DOCUMENTS: 'Exam'
  }
  return labels[category] || category || 'Document'
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
  onOpenDocument,
  onCreateFolder,
  onBrowse,
  onNotify,
  onRefresh
}) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [projectTab, setProjectTab] = useState('pending')

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

  const visibleProjects = projectTab === 'accepted'
    ? acceptedProjects
    : projectTab === 'rejected'
      ? rejectedProjects
      : pendingProjects

  return (
    <div className="dashboard-workspace student-dashboard">
      <header className="dash-header student-dash-header">
        <div className="dash-header-copy">
          <nav className="dash-crumbs" aria-label="Breadcrumb">
            <span>Student workspace</span>
            <strong>{session.fullName}</strong>
          </nav>
          <h1>My archive</h1>
          <p>
            Submit your final year project in 5 clear steps. The librarian must approve it before it appears in the shared archive.
          </p>
          <span className="dash-meta">Student ID: {session.studentNumber}</span>
        </div>
        <div className="dash-header-actions">
          <button className="ghost-btn dash-action-btn" type="button" onClick={onCreateFolder}>
            <FolderPlusIcon className="icon" />
            New folder
          </button>
          <button className="ghost-btn dash-action-btn" type="button" onClick={onBrowse}>
            Browse
          </button>
          <button className="primary-btn dash-action-btn" type="button" onClick={() => setWizardOpen(true)}>
            <UploadIcon className="icon" />
            Submit project
          </button>
        </div>
      </header>

      <section className={`student-storage-card storage-${storageState}`}>
        <div>
          <p className="eyebrow">Personal storage</p>
          <strong>{formatBytes(dashboard.storageUsedBytes)} used</strong>
          <span>{formatBytes(dashboard.storageLimitBytes)} available</span>
        </div>
        <div className="student-storage-meter" aria-hidden="true">
          <div className="student-storage-fill" style={{ width: `${storagePercent}%` }} />
        </div>
        <p className="student-storage-note">
          {storageState === 'critical'
            ? 'Storage is almost full. Delete older project files before uploading again.'
            : storageState === 'warning'
              ? 'You are nearing your personal storage limit.'
              : 'Upload a ZIP (PDF book inside) up to 5 MB. Pending projects stay private until librarian approval.'}
        </p>
      </section>

      <div className="student-summary-grid">
        <article className="student-summary-card">
          <p className="eyebrow">From registrar</p>
          <strong>{receivedDocuments.length}</strong>
          <span>Registration and application documents</span>
        </article>
        <article className="student-summary-card">
          <p className="eyebrow">Pending</p>
          <strong>{pendingProjects.length}</strong>
          <span>Waiting for librarian review</span>
        </article>
        <article className="student-summary-card">
          <p className="eyebrow">Accepted</p>
          <strong>{acceptedProjects.length}</strong>
          <span>Approved into the archive</span>
        </article>
        <article className="student-summary-card">
          <p className="eyebrow">Rejected</p>
          <strong>{rejectedProjects.length}</strong>
          <span>Needs revision with feedback</span>
        </article>
      </div>

      <section className="student-documents-panel">
        <div className="student-panel-head">
          <div>
            <p className="eyebrow">Received from registrar</p>
            <h2>Official documents</h2>
          </div>
        </div>
        {receivedDocuments.length ? (
          <div className="student-document-list">
            {receivedDocuments.map((document) => (
              <article key={document.id} className="student-document-row">
                <div className="student-document-copy">
                  <DocumentIcon className="icon" />
                  <div>
                    <strong>{document.title}</strong>
                    <span>{categoryLabel(document.category)} · {formatDate(document.issueDate)}</span>
                  </div>
                </div>
                <button type="button" className="ghost-btn" onClick={() => onOpenDocument(document.id)}>
                  <DownloadIcon className="icon" />
                  Open
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="student-empty-copy">
            No registrar documents yet. When the registrar uploads files to your student ID, they will appear here.
          </p>
        )}
      </section>

      <section className="student-documents-panel">
        <div className="student-panel-head student-panel-head-split">
          <div>
            <p className="eyebrow">My final year project</p>
            <h2>Submission status</h2>
          </div>
          <div className="student-project-tabs" role="tablist" aria-label="Project status">
            <button
              type="button"
              className={projectTab === 'pending' ? 'active' : ''}
              onClick={() => setProjectTab('pending')}
            >
              Pending ({pendingProjects.length})
            </button>
            <button
              type="button"
              className={projectTab === 'accepted' ? 'active' : ''}
              onClick={() => setProjectTab('accepted')}
            >
              Accepted ({acceptedProjects.length})
            </button>
            <button
              type="button"
              className={projectTab === 'rejected' ? 'active' : ''}
              onClick={() => setProjectTab('rejected')}
            >
              Rejected ({rejectedProjects.length})
            </button>
          </div>
        </div>

        {visibleProjects.length ? (
          <div className="student-document-list">
            {visibleProjects.map((document) => (
              <article key={document.id} className="student-document-row student-project-row">
                <div className="student-document-copy">
                  <DocumentIcon className="icon" />
                  <div>
                    <strong>{document.title}</strong>
                    <span>
                      {statusLabel(document.status)} · {formatBytes(document.sizeBytes)} · {formatDate(document.modifiedAt)}
                    </span>
                    {document.githubUrl ? <span className="student-link-line">GitHub: {document.githubUrl}</span> : null}
                    {projectTab === 'rejected' && document.reviewNote ? (
                      <span className="student-feedback">Feedback: {document.reviewNote}</span>
                    ) : null}
                    {projectTab === 'pending' ? (
                      <span className="student-feedback soft">Waiting for librarian approval. Not visible in the shared archive yet.</span>
                    ) : null}
                    {projectTab === 'accepted' ? (
                      <span className="student-feedback soft">Approved and available in the archive project folders.</span>
                    ) : null}
                  </div>
                </div>
                <button type="button" className="ghost-btn" onClick={() => onOpenDocument(document.id)}>
                  <DownloadIcon className="icon" />
                  Open
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="student-empty-copy">
            {projectTab === 'pending'
              ? 'No pending submissions. Use Submit project to start the 5-step upload.'
              : projectTab === 'accepted'
                ? 'No accepted projects yet. Approved submissions will appear here and in the shared archive.'
                : 'No rejected projects. If a submission is rejected, librarian feedback will show here.'}
          </p>
        )}
      </section>

      {wizardOpen ? (
        <StudentFypWizard
          session={session}
          onClose={() => setWizardOpen(false)}
          onNotify={onNotify}
          onSubmitted={async () => {
            setProjectTab('pending')
            await onRefresh?.()
          }}
        />
      ) : null}
    </div>
  )
}
