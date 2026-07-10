import React, { useMemo, useState } from 'react'
import { submitUpload } from '../api'
import { CheckIcon, UploadIcon, XIcon } from './Icons'

const STEPS = [
  { id: 1, title: 'Student details', hint: 'Confirm your identity and project title' },
  { id: 2, title: 'Cover photo', hint: 'Upload a background / cover image' },
  { id: 3, title: 'External links', hint: 'Add GitHub and other project links' },
  { id: 4, title: 'Project ZIP', hint: 'Upload the PDF book as a ZIP file' },
  { id: 5, title: 'Review & submit', hint: 'Confirm and send for librarian approval' }
]

function isLikelyUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return true
  }
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export default function StudentFypWizard({ session, onClose, onSubmitted, onNotify }) {
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    projectTitle: '',
    faculty: session.faculty || '',
    department: session.department || '',
    description: '',
    githubUrl: '',
    externalLinks: '',
    coverPhoto: null,
    zipFile: null
  })
  const [coverPreview, setCoverPreview] = useState('')

  const studentNumber = session.studentNumber || ''
  const studentName = session.fullName || ''

  const progressLabel = useMemo(
    () => `Step ${step} of ${STEPS.length}`,
    [step]
  )

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleCoverChange(event) {
    const file = event.target.files?.[0] || null
    updateField('coverPhoto', file)
    if (coverPreview) {
      URL.revokeObjectURL(coverPreview)
    }
    setCoverPreview(file ? URL.createObjectURL(file) : '')
  }

  function validateStep(currentStep) {
    if (currentStep === 1) {
      if (!String(form.projectTitle || '').trim()) {
        return 'Enter your final year project title.'
      }
      if (!studentNumber || !studentName) {
        return 'Student account details are incomplete. Sign out and sign in again.'
      }
    }
    if (currentStep === 2) {
      if (!form.coverPhoto) {
        return 'Upload a cover / background photo for your project.'
      }
    }
    if (currentStep === 3) {
      if (!isLikelyUrl(form.githubUrl)) {
        return 'GitHub link must be a valid http(s) URL.'
      }
      const links = String(form.externalLinks || '')
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
      if (links.some((link) => !isLikelyUrl(link))) {
        return 'Each external link must be a valid http(s) URL.'
      }
    }
    if (currentStep === 4) {
      if (!form.zipFile) {
        return 'Upload a ZIP file that contains your PDF project book.'
      }
      const name = String(form.zipFile.name || '').toLowerCase()
      if (!name.endsWith('.zip')) {
        return 'Only ZIP files are accepted for the project book.'
      }
      if (form.zipFile.size > 5 * 1024 * 1024) {
        return 'ZIP file must be 5 MB or smaller.'
      }
    }
    return ''
  }

  function goNext() {
    const error = validateStep(step)
    if (error) {
      onNotify?.(error)
      return
    }
    setStep((current) => Math.min(STEPS.length, current + 1))
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1))
  }

  async function handleSubmit() {
    for (let current = 1; current <= STEPS.length; current += 1) {
      const error = validateStep(current)
      if (error) {
        setStep(current)
        onNotify?.(error)
        return
      }
    }

    setBusy(true)
    try {
      const externalLinks = String(form.externalLinks || '')
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .join('\n')
      const metadata = {
        title: form.projectTitle.trim(),
        projectTitle: form.projectTitle.trim(),
        studentNumber,
        studentName,
        faculty: form.faculty || null,
        department: form.department || null,
        uploadedBy: studentName,
        category: 'FINAL_YEAR_PROJECT',
        pageCount: 1,
        issueDate: new Date().toISOString().slice(0, 10),
        description: form.description.trim() || null,
        tags: 'final-year-project,student-submission',
        githubUrl: form.githubUrl.trim() || null,
        externalLinks: externalLinks || null
      }
      await submitUpload(metadata, form.zipFile, form.coverPhoto)
      onNotify?.('Project submitted. It will appear in Accepted only after librarian approval.')
      onSubmitted?.()
      onClose?.()
    } catch (err) {
      onNotify?.(err.message || 'Unable to submit final year project.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose} role="presentation">
      <div
        className="modal student-fyp-wizard"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-fyp-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Final year project</p>
            <h2 id="student-fyp-title">Submit project for librarian review</h2>
            <p>{progressLabel}: {STEPS[step - 1].hint}</p>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} disabled={busy} aria-label="Close">
            <XIcon className="icon" />
          </button>
        </div>

        <ol className="fyp-stepper">
          {STEPS.map((item) => (
            <li key={item.id} className={`fyp-step ${step === item.id ? 'active' : ''} ${step > item.id ? 'done' : ''}`}>
              <span>{item.id}</span>
              <strong>{item.title}</strong>
            </li>
          ))}
        </ol>

        <div className="fyp-step-body">
          {step === 1 ? (
            <div className="fyp-form-grid">
              <label>
                <span>Student number</span>
                <input value={studentNumber} readOnly />
              </label>
              <label>
                <span>Full name</span>
                <input value={studentName} readOnly />
              </label>
              <label className="fyp-span-2">
                <span>Project title</span>
                <input
                  value={form.projectTitle}
                  onChange={(event) => updateField('projectTitle', event.target.value)}
                  placeholder="e.g. Smart Archive System for AUCA"
                />
              </label>
              <label>
                <span>Faculty</span>
                <input
                  value={form.faculty}
                  onChange={(event) => updateField('faculty', event.target.value)}
                  placeholder="Faculty name"
                />
              </label>
              <label>
                <span>Department</span>
                <input
                  value={form.department}
                  onChange={(event) => updateField('department', event.target.value)}
                  placeholder="Department name"
                />
              </label>
              <label className="fyp-span-2">
                <span>Short description</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  placeholder="Brief summary of your project"
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="fyp-photo-step">
              <label className="fyp-file-card">
                <UploadIcon className="icon" />
                <strong>Upload cover / background photo</strong>
                <span>JPG, PNG, or WEBP · max 2 MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverChange} />
              </label>
              {coverPreview ? (
                <div className="fyp-cover-preview" style={{ backgroundImage: `url(${coverPreview})` }}>
                  <span>Preview</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="fyp-form-grid">
              <label className="fyp-span-2">
                <span>GitHub repository URL</span>
                <input
                  value={form.githubUrl}
                  onChange={(event) => updateField('githubUrl', event.target.value)}
                  placeholder="https://github.com/username/project"
                />
              </label>
              <label className="fyp-span-2">
                <span>Other external links</span>
                <textarea
                  rows={4}
                  value={form.externalLinks}
                  onChange={(event) => updateField('externalLinks', event.target.value)}
                  placeholder={'One link per line, e.g.\nhttps://demo.example.com\nhttps://docs.example.com'}
                />
              </label>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="fyp-photo-step">
              <label className="fyp-file-card">
                <UploadIcon className="icon" />
                <strong>Upload PDF book as ZIP</strong>
                <span>ZIP only · max 5 MB · include the project PDF inside</span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(event) => updateField('zipFile', event.target.files?.[0] || null)}
                />
              </label>
              {form.zipFile ? (
                <p className="fyp-file-selected">
                  Selected: <strong>{form.zipFile.name}</strong>
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="fyp-review">
              <p>Your project will be sent to the librarian for approval. Until it is accepted, it will not appear in the shared archive for other offices.</p>
              <dl>
                <div><dt>Title</dt><dd>{form.projectTitle || '-'}</dd></div>
                <div><dt>Student</dt><dd>{studentName} ({studentNumber})</dd></div>
                <div><dt>Cover photo</dt><dd>{form.coverPhoto?.name || '-'}</dd></div>
                <div><dt>GitHub</dt><dd>{form.githubUrl || 'Not provided'}</dd></div>
                <div><dt>Other links</dt><dd>{form.externalLinks || 'Not provided'}</dd></div>
                <div><dt>ZIP file</dt><dd>{form.zipFile?.name || '-'}</dd></div>
              </dl>
            </div>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={step === 1 ? onClose : goBack} disabled={busy}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length ? (
            <button type="button" className="primary-btn" onClick={goNext} disabled={busy}>
              Continue
            </button>
          ) : (
            <button type="button" className="primary-btn" onClick={handleSubmit} disabled={busy}>
              <CheckIcon className="icon" />
              {busy ? 'Submitting...' : 'Submit for approval'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
