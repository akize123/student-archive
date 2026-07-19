import React, { useEffect, useMemo, useState } from 'react'
import {
  getAdminOffices,
  getDocumentTemplates,
  getDocumentTemplatePreviewText,
  getOcrSettings,
  uploadDocumentTemplate,
  updateDocumentTemplate,
  updateOcrSettings
} from '../api'

const categoryOptions = [
  { value: 'REGISTRATION_FORM', label: 'Registration Forms' },
  { value: 'REINTEGRATION_FORM', label: 'Reintegration Forms' },
  { value: 'APPLICATION_DOCUMENTS', label: 'Application Documents' },
  { value: 'EXAMINATION_DOCUMENTS', label: 'Examination Documents' },
  { value: 'FINAL_YEAR_PROJECT', label: 'Final Year Project' }
]

const facultyOptions = [
  {
    value: 'Faculty of Business Administration',
    label: 'Faculty of Business Administration',
    departments: ['Accounting', 'Management', 'Finance']
  },
  {
    value: 'Faculty of Information Technology',
    label: 'Faculty of Information Technology',
    departments: ['Networking & Communication Systems', 'Software Engineering', 'Information Management']
  },
  {
    value: 'Faculty of Education',
    label: 'Faculty of Education',
    departments: ['Educational Psychology', 'Languages (English / French)', 'Religious Studies', 'Business Accounting & Computer Science']
  },
  {
    value: 'Faculty of Health Sciences (Nursing & Midwifery)',
    label: 'Faculty of Health Sciences (Nursing & Midwifery)',
    departments: ['Nursing', 'Midwifery']
  },
  {
    value: 'Faculty of Theology',
    label: 'Faculty of Theology',
    departments: ['Theology (Pastoral Training)']
  }
]

const categoryTypePresets = {
  REGISTRATION_FORM: ['Registration Form', 'Birth Certificate', 'National ID Copy'],
  REINTEGRATION_FORM: ['Reintegration Form', 'Leave Letter'],
  APPLICATION_DOCUMENTS: ['Application Letter', 'Transcript Request'],
  EXAMINATION_DOCUMENTS: ['Exam Paper', 'Marks Sheet'],
  FINAL_YEAR_PROJECT: ['Project Report', 'Supervisor Approval']
}

function getDepartments(faculty) {
  return facultyOptions.find((item) => item.value === faculty)?.departments || []
}

export default function DocumentTemplateManager({ onNotify }) {
  const [category, setCategory] = useState('REGISTRATION_FORM')
  const [documentTypeName, setDocumentTypeName] = useState('Registration Form')
  const [office, setOffice] = useState('')
  const [faculty, setFaculty] = useState('')
  const [department, setDepartment] = useState('')
  const [offices, setOffices] = useState([])
  const [templates, setTemplates] = useState([])
  const [title, setTitle] = useState('')
  const [threshold, setThreshold] = useState(80)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [ocrSettings, setOcrSettings] = useState(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [filterOffice, setFilterOffice] = useState('')

  const typePresets = useMemo(() => {
    const fromTemplates = templates
      .filter((item) => item.category === category)
      .map((item) => item.documentTypeName)
      .filter(Boolean)
    const defaults = categoryTypePresets[category] || []
    return [...new Set([...defaults, ...fromTemplates])]
  }, [category, templates])

  useEffect(() => {
    getOcrSettings().then(setOcrSettings).catch(() => setOcrSettings(null))
    getAdminOffices()
      .then((items) => {
        setOffices(items)
        if (items.length && !office) {
          setOffice(items[0].department || items[0].label)
        }
      })
      .catch(() => setOffices([]))
  }, [])

  useEffect(() => {
    const preset = categoryTypePresets[category]?.[0] || ''
    setDocumentTypeName(preset)
  }, [category])

  useEffect(() => {
    getDocumentTemplates({
      category,
      office: filterOffice || undefined
    })
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [category, filterOffice])

  async function handleUploadTemplate(event) {
    event.preventDefault()
    if (!file) {
      onNotify?.('Choose a PDF template file.')
      return
    }
    if (!documentTypeName.trim()) {
      onNotify?.('Enter a document type name.')
      return
    }
    if (!office.trim()) {
      onNotify?.('Select the office this template belongs to.')
      return
    }
    setBusy(true)
    try {
      await uploadDocumentTemplate({
        file,
        category,
        documentTypeName: documentTypeName.trim(),
        office: office.trim(),
        faculty: faculty || undefined,
        department: department || undefined,
        title: title.trim() || undefined,
        similarityThreshold: Number(threshold)
      })
      onNotify?.('Template uploaded and baseline text stored.')
      setFile(null)
      setTitle('')
      const nextTemplates = await getDocumentTemplates({
        category,
        office: filterOffice || undefined
      })
      setTemplates(nextTemplates)
    } catch (err) {
      onNotify?.(err.message || 'Unable to upload template.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePreviewTemplate(templateId) {
    try {
      const result = await getDocumentTemplatePreviewText(templateId)
      setPreviewText(result.preview || '')
    } catch (err) {
      onNotify?.(err.message || 'Unable to load template preview.')
    }
  }

  async function handleOcrToggle(enabled) {
    setOcrBusy(true)
    try {
      const next = await updateOcrSettings({ enabled })
      setOcrSettings(next)
      onNotify?.(enabled ? 'OCR enabled for scanned PDFs.' : 'OCR disabled.')
    } catch (err) {
      onNotify?.(err.message || 'Unable to update OCR settings.')
    } finally {
      setOcrBusy(false)
    }
  }

  const filteredTemplates = templates.filter((template) => template.category === category)

  return (
    <section className="document-template-manager">
      <div className="document-template-head">
        <div>
          <p className="eyebrow">Document templates</p>
          <h3>Official form baselines for OCR validation</h3>
          <p>
            Upload blank official PDFs by category, office, faculty, and department.
            User uploads are compared against the stored baseline text.
          </p>
        </div>
      </div>

      <div className="template-manager-grid">
        <article className="template-panel template-upload-panel">
          <div className="template-panel-head">
            <strong>Upload template</strong>
            <span>Blank official PDF used as the validation baseline</span>
          </div>

          <form className="template-upload-form" onSubmit={handleUploadTemplate}>
            <label className="template-field span-2">
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="template-field span-2">
              <span>Document type</span>
              <input
                list="document-type-presets"
                value={documentTypeName}
                onChange={(event) => setDocumentTypeName(event.target.value)}
                placeholder="Registration Form, Birth Certificate…"
              />
              <datalist id="document-type-presets">
                {typePresets.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
              <small>Type a new name if it is not listed.</small>
            </label>

            <label className="template-field span-2">
              <span>Office</span>
              <select value={office} onChange={(event) => setOffice(event.target.value)}>
                {offices.map((item) => (
                  <option key={item.role} value={item.department || item.label}>
                    {item.label}{item.department ? ` · ${item.department}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="template-field">
              <span>Faculty (optional)</span>
              <select
                value={faculty}
                onChange={(event) => {
                  setFaculty(event.target.value)
                  setDepartment('')
                }}
              >
                <option value="">Any faculty</option>
                {facultyOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="template-field">
              <span>Department (optional)</span>
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                disabled={!faculty}
              >
                <option value="">{faculty ? 'Any department' : 'Select faculty first'}</option>
                {getDepartments(faculty).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="template-field span-2">
              <span>Template title (optional)</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={documentTypeName ? `${documentTypeName} Template` : 'Template title'}
              />
            </label>

            <label className="template-field">
              <span>Similarity threshold (%)</span>
              <input
                type="number"
                min="50"
                max="100"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </label>

            <label className="template-field span-2">
              <span>Original PDF</span>
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>

            <div className="template-form-actions span-2">
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy ? 'Uploading…' : 'Upload template'}
              </button>
            </div>
          </form>
        </article>

        <article className="template-panel template-ocr-panel">
          <div className="template-panel-head">
            <strong>OCR settings</strong>
            <span>Enable text extraction from scanned PDFs</span>
          </div>

          {ocrSettings ? (
            <div className="template-ocr-body">
              <div className="template-ocr-status-row">
                <span className={`template-ocr-badge ${ocrSettings.enabled && ocrSettings.available ? 'ok' : 'warn'}`}>
                  {ocrSettings.enabled
                    ? (ocrSettings.available ? 'OCR enabled' : 'OCR enabled · Tesseract missing')
                    : 'OCR disabled'}
                </span>
                <label className="template-ocr-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(ocrSettings.enabled)}
                    disabled={ocrBusy}
                    onChange={(event) => handleOcrToggle(event.target.checked)}
                  />
                  <span>{ocrSettings.enabled ? 'Turn off OCR' : 'Enable OCR'}</span>
                </label>
              </div>
              <p className="template-ocr-note">{ocrSettings.note}</p>
              {ocrSettings.tessdataPath ? (
                <small className="inline-note">Tessdata: {ocrSettings.tessdataPath}</small>
              ) : null}
            </div>
          ) : (
            <p className="inline-note">Unable to load OCR settings.</p>
          )}
        </article>
      </div>

      <div className="template-list-head">
        <div>
          <strong>Stored templates</strong>
          <span>{filteredTemplates.length} active template{filteredTemplates.length === 1 ? '' : 's'} for this category</span>
        </div>
        <label className="template-filter">
          <span>Filter by office</span>
          <select value={filterOffice} onChange={(event) => setFilterOffice(event.target.value)}>
            <option value="">All offices</option>
            {offices.map((item) => (
              <option key={item.role} value={item.department || item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="template-list">
        {filteredTemplates.length ? filteredTemplates.map((template) => (
          <article key={template.id} className="template-card">
            <div className="template-card-main">
              <strong>{template.title}</strong>
              <div className="template-card-meta">
                <span className="template-chip">{template.documentTypeName}</span>
                {template.office ? <span className="template-chip">{template.office}</span> : null}
                {template.faculty ? <span className="template-chip muted">{template.faculty}</span> : null}
                {template.department ? <span className="template-chip muted">{template.department}</span> : null}
              </div>
              <small>
                {template.pageCount} pages · threshold {template.similarityThreshold}% · {template.ocrMethod}
              </small>
            </div>
            <div className="template-card-actions">
              <button type="button" className="ghost-btn tiny-btn" onClick={() => handlePreviewTemplate(template.id)}>
                Preview text
              </button>
              <button
                type="button"
                className="ghost-btn tiny-btn"
                onClick={() => updateDocumentTemplate(template.id, { active: false }).then(() => {
                  setTemplates((current) => current.filter((item) => item.id !== template.id))
                })}
              >
                Deactivate
              </button>
            </div>
          </article>
        )) : (
          <div className="template-empty-state">
            No templates yet for this category. Upload a blank official PDF above.
          </div>
        )}
      </div>

      {previewText ? (
        <div className="template-preview-box">
          <strong>Extracted baseline preview</strong>
          <p>{previewText}</p>
        </div>
      ) : null}
    </section>
  )
}
