import React, { useEffect, useMemo, useState } from 'react'
import { getDocument, submitUpload, updatePendingFinalYearProject } from '../api'
import { validateImageFile, validateZipFile } from '../fileSignatures'
import { CheckIcon, UploadIcon, XIcon } from './Icons'

const STEPS = [
  { id: 1, title: 'Student details', hint: 'Confirm your identity and project title' },
  { id: 2, title: 'Face photo', hint: 'Upload a clear photo of your face' },
  { id: 3, title: 'External links', hint: 'Add safe GitHub and project links' },
  { id: 4, title: 'Project ZIP', hint: 'Upload the PDF book as a ZIP (max 1 MB)' },
  { id: 5, title: 'Review & submit', hint: 'Confirm and send for librarian approval' }
]

const FYP_ZIP_MAX_BYTES = 1024 * 1024
const BLOCKED_LINK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function isSafeHttpUrl(value, { requireGithub = false } = {}) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: true, normalized: '' }
  }
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:') || lower.startsWith('vbscript:')) {
    return { ok: false, message: 'Blocked URL scheme. Use https:// links only.' }
  }
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, message: 'Links must start with https:// or http://' }
    }
    const host = String(url.hostname || '').toLowerCase()
    if (!host || BLOCKED_LINK_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
      return { ok: false, message: 'Local or private network links are not allowed.' }
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      const [a, b] = host.split('.').map(Number)
      if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) {
        return { ok: false, message: 'Private IP links are not allowed.' }
      }
    }
    if (url.username || url.password) {
      return { ok: false, message: 'Links cannot include usernames or passwords.' }
    }
    if (requireGithub) {
      if (host !== 'github.com' && host !== 'www.github.com') {
        return { ok: false, message: 'GitHub link must be a github.com repository URL.' }
      }
      if (!url.pathname || url.pathname === '/') {
        return { ok: false, message: 'GitHub link must include a repository path, e.g. https://github.com/user/repo' }
      }
    }
    return { ok: true, normalized: url.toString() }
  } catch {
    return { ok: false, message: 'Enter a valid URL.' }
  }
}

async function detectFaceInImage(file) {
  if (!file) {
    return { ok: false, message: 'Upload a clear photo of your face.' }
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read the selected image.'))
      img.src = objectUrl
    })
    if (image.naturalWidth < 180 || image.naturalHeight < 180) {
      return { ok: false, message: 'Face photo is too small. Use at least 180x180 pixels.' }
    }
    if (image.naturalWidth > image.naturalHeight * 1.6) {
      return { ok: false, message: 'Upload a portrait face photo, not a wide landscape image.' }
    }
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
        const faces = await detector.detect(image)
        if (!faces?.length) {
          return { ok: false, message: 'No face detected. Upload a clear photo of your own face.' }
        }
      } catch {
        // Fall through to confirmation requirement when FaceDetector fails.
      }
    }
    return { ok: true }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function StudentFypWizard({
  session,
  existingDocumentId = null,
  onClose,
  onSubmitted,
  onNotify
}) {
  const isEditMode = Boolean(existingDocumentId)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(isEditMode)
  const [faceConfirmed, setFaceConfirmed] = useState(false)
  const [existingCoverName, setExistingCoverName] = useState('')
  const [existingZipName, setExistingZipName] = useState('')
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

  useEffect(() => {
    let active = true
    async function loadExisting() {
      if (!existingDocumentId) {
        setLoadingExisting(false)
        return
      }
      setLoadingExisting(true)
      try {
        const detail = await getDocument(existingDocumentId)
        if (!active) {
          return
        }
        setForm((current) => ({
          ...current,
          projectTitle: detail.title || '',
          faculty: session.faculty || current.faculty,
          department: detail.department || session.department || current.department,
          description: detail.description || '',
          githubUrl: detail.githubUrl || '',
          externalLinks: detail.externalLinks || ''
        }))
        setExistingCoverName(detail.coverPhotoPath ? 'Current face photo on file' : '')
        setExistingZipName(detail.fileName || '')
        setFaceConfirmed(Boolean(detail.coverPhotoPath))
      } catch (err) {
        onNotify?.(err.message || 'Unable to load the pending submission.')
        onClose?.()
      } finally {
        if (active) {
          setLoadingExisting(false)
        }
      }
    }
    loadExisting()
    return () => {
      active = false
    }
  }, [existingDocumentId, onClose, onNotify, session.department, session.faculty])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleCoverChange(event) {
    const file = event.target.files?.[0] || null
    updateField('coverPhoto', file)
    setFaceConfirmed(false)
    if (coverPreview) {
      URL.revokeObjectURL(coverPreview)
    }
    setCoverPreview(file ? URL.createObjectURL(file) : '')
    if (!file) {
      return
    }
    const signatureCheck = await validateImageFile(file)
    if (!signatureCheck.ok) {
      onNotify?.(signatureCheck.message)
      updateField('coverPhoto', null)
      setCoverPreview('')
      event.target.value = ''
      return
    }
    const detection = await detectFaceInImage(file)
    if (!detection.ok) {
      onNotify?.(detection.message)
      updateField('coverPhoto', null)
      setCoverPreview('')
      event.target.value = ''
    }
  }

  async function validateStep(currentStep) {
    if (currentStep === 1) {
      if (!String(form.projectTitle || '').trim()) {
        return 'Enter your final year project title.'
      }
      if (!studentNumber || !studentName) {
        return 'Student account details are incomplete. Sign out and sign in again.'
      }
    }
    if (currentStep === 2) {
      if (!form.coverPhoto && !(isEditMode && existingCoverName)) {
        return 'Upload a clear photo of your face.'
      }
      if (form.coverPhoto) {
        const detection = await detectFaceInImage(form.coverPhoto)
        if (!detection.ok) {
          return detection.message
        }
      }
      if (!faceConfirmed) {
        return 'Confirm that the uploaded image is a clear photo of your face.'
      }
    }
    if (currentStep === 3) {
      const github = isSafeHttpUrl(form.githubUrl, { requireGithub: true })
      if (!github.ok) {
        return github.message || 'GitHub link is invalid.'
      }
      const links = String(form.externalLinks || '')
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
      if (links.length > 8) {
        return 'You can add at most 8 external links.'
      }
      for (const link of links) {
        const result = isSafeHttpUrl(link)
        if (!result.ok) {
          return result.message || `Invalid external link: ${link}`
        }
      }
    }
    if (currentStep === 4) {
      if (!form.zipFile && !(isEditMode && existingZipName)) {
        return 'Upload a ZIP file that contains your PDF project book.'
      }
      if (form.zipFile) {
        const name = String(form.zipFile.name || '').toLowerCase()
        if (!name.endsWith('.zip')) {
          return 'Only ZIP files are accepted for the project book.'
        }
        const signatureCheck = await validateZipFile(form.zipFile)
        if (!signatureCheck.ok) {
          return signatureCheck.message
        }
        if (form.zipFile.size > FYP_ZIP_MAX_BYTES) {
          return 'ZIP file must be 1 MB or smaller.'
        }
      }
    }
    return ''
  }

  async function goNext() {
    const error = await validateStep(step)
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
      const error = await validateStep(current)
      if (error) {
        setStep(current)
        onNotify?.(error)
        return
      }
    }

    setBusy(true)
    try {
      const github = isSafeHttpUrl(form.githubUrl, { requireGithub: Boolean(String(form.githubUrl || '').trim()) })
      const externalLinks = String(form.externalLinks || '')
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => isSafeHttpUrl(item).normalized || item)
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
        githubUrl: github.normalized || null,
        externalLinks: externalLinks || null
      }
      if (isEditMode) {
        await updatePendingFinalYearProject(existingDocumentId, metadata, form.zipFile, form.coverPhoto)
        onNotify?.('Project updated and kept as pending for librarian approval.')
      } else {
        await submitUpload(metadata, form.zipFile, form.coverPhoto)
        onNotify?.('Project submitted. It is now pending librarian approval. You can still view and edit it while pending.')
      }
      onSubmitted?.()
      onClose?.()
    } catch (err) {
      onNotify?.(err.message || 'Unable to submit final year project.')
    } finally {
      setBusy(false)
    }
  }

  if (loadingExisting) {
    return (
      <div className="modal-backdrop" role="presentation">
        <div className="modal student-fyp-wizard">
          <p>Loading your pending submission...</p>
        </div>
      </div>
    )
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
            <h2 id="student-fyp-title">
              {isEditMode ? 'Edit pending project submission' : 'Submit project for librarian review'}
            </h2>
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
                <strong>Upload a clear photo of your face</strong>
                <span>JPG, PNG, or WEBP · max 2 MB · portrait preferred</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverChange} />
              </label>
              {coverPreview ? (
                <div className="fyp-cover-preview" style={{ backgroundImage: `url(${coverPreview})` }}>
                  <span>Preview</span>
                </div>
              ) : existingCoverName ? (
                <p className="fyp-file-selected">{existingCoverName}. Choose a new file only if you need to replace it.</p>
              ) : null}
              <label className="fyp-confirm-face">
                <input
                  type="checkbox"
                  checked={faceConfirmed}
                  onChange={(event) => setFaceConfirmed(event.target.checked)}
                />
                <span>I confirm this is a clear photo of my face (not a landscape, logo, or unrelated image).</span>
              </label>
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
                  placeholder={'One https link per line, e.g.\nhttps://demo.example.com\nhttps://docs.example.com'}
                />
              </label>
              <p className="fyp-help-copy fyp-span-2">
                Only safe http(s) links are accepted. Localhost, private IPs, and script/data URLs are blocked.
              </p>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="fyp-photo-step">
              <label className="fyp-file-card">
                <UploadIcon className="icon" />
                <strong>Upload PDF book as ZIP</strong>
                <span>ZIP only · max 1 MB · include the project PDF inside</span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={async (event) => {
                    const nextFile = event.target.files?.[0] || null
                    if (!nextFile) {
                      updateField('zipFile', null)
                      return
                    }
                    const signatureCheck = await validateZipFile(nextFile)
                    if (!signatureCheck.ok) {
                      onNotify?.(signatureCheck.message)
                      event.target.value = ''
                      updateField('zipFile', null)
                      return
                    }
                    updateField('zipFile', nextFile)
                  }}
                />
              </label>
              {form.zipFile ? (
                <p className="fyp-file-selected">
                  Selected: <strong>{form.zipFile.name}</strong>
                </p>
              ) : existingZipName ? (
                <p className="fyp-file-selected">
                  Current ZIP: <strong>{existingZipName}</strong>. Choose a new file only if you need to replace it.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="fyp-review">
              <p>
                Your project will stay pending until the librarian approves it. You can reopen this wizard later to fix details while it is still pending or rejected.
              </p>
              <dl>
                <div><dt>Title</dt><dd>{form.projectTitle || '-'}</dd></div>
                <div><dt>Student</dt><dd>{studentName} ({studentNumber})</dd></div>
                <div><dt>Face photo</dt><dd>{form.coverPhoto?.name || existingCoverName || '-'}</dd></div>
                <div><dt>GitHub</dt><dd>{form.githubUrl || 'Not provided'}</dd></div>
                <div><dt>Other links</dt><dd>{form.externalLinks || 'Not provided'}</dd></div>
                <div><dt>ZIP file</dt><dd>{form.zipFile?.name || existingZipName || '-'}</dd></div>
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
              {busy ? 'Saving...' : isEditMode ? 'Save and keep pending' : 'Submit for approval'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
