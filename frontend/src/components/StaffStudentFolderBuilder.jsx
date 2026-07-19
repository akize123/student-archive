import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  STUDENT_ID_FORMAT_HINT,
  normalizeStudentId,
  parseStudentId,
  validateStaffFolderName,
  validateStudentIdForNewEntry
} from '../studentId'

function semesterFromFolder(semester) {
  const match = String(semester || '').match(/\/([123])$/)
  return match ? match[1] : ''
}

function yearFromAcademicYear(academicYear) {
  const start = String(academicYear || '').split('-')[0]
  return /^\d{4}$/.test(start) ? start : ''
}

function codeForDepartmentName(departmentName) {
  if (!departmentName) {
    return ''
  }
  const map = {
    'Software Engineering': 'SENG',
    'Information Management': 'IMA',
    'Networking & Communication Systems': 'NET',
    Accounting: 'ACC',
    Management: 'MGT',
    Finance: 'FIN',
    'Educational Psychology': 'EPS',
    'Languages (English / French)': 'LNG',
    'Religious Studies': 'REL',
    'Business Accounting & Computer Science': 'BAC',
    Nursing: 'NUR',
    Midwifery: 'MID',
    'Theology (Pastoral Training)': 'THE'
  }
  return map[departmentName] || ''
}

function suggestPrefix(placement) {
  const year = yearFromAcademicYear(placement?.academicYear)
  const semester = semesterFromFolder(placement?.semester)
  const dept = codeForDepartmentName(placement?.department)
  if (!year || !semester || !dept) {
    return ''
  }
  return `${year}${semester}${dept}`
}

export default function StaffStudentFolderBuilder({
  placement,
  value,
  onChange,
  disabled = false
}) {
  const prefix = useMemo(() => suggestPrefix(placement), [placement])
  const [studentId, setStudentId] = useState(() => normalizeStudentId(value || prefix || ''))
  const namingError = useMemo(() => {
    if (!studentId.trim()) {
      return 'Student ID is required to create the folder.'
    }
    return validateStaffFolderName(studentId) || validateStudentIdForNewEntry(studentId)
  }, [studentId])
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    onChangeRef.current?.(normalizeStudentId(studentId), namingError)
  }, [studentId, namingError])

  useEffect(() => {
    if (!value) {
      return
    }
    const normalized = normalizeStudentId(value)
    if (normalized && normalized !== normalizeStudentId(studentId)) {
      setStudentId(normalized)
    }
  }, [value])

  const parsed = parseStudentId(studentId)

  return (
    <div className="staff-folder-builder">
      <p className="inline-note">
        Create a <strong>student folder</strong> under this semester. Files are stored inside the student ID folder — not directly in the semester.
      </p>

      <label>
        <span>Student ID</span>
        <input
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          placeholder={prefix ? `${prefix}041` : 'e.g. 20241ACC041'}
          disabled={disabled}
          autoFocus
        />
      </label>

      {prefix ? (
        <div className="staff-folder-builder-actions">
          <button
            type="button"
            className="ghost-btn tiny-btn"
            disabled={disabled}
            onClick={() => setStudentId(prefix)}
          >
            Use semester prefix ({prefix})
          </button>
        </div>
      ) : null}

      <div className="staff-folder-builder-preview">
        <span>Student folder name</span>
        <strong>{normalizeStudentId(studentId) || '—'}</strong>
      </div>

      {namingError ? (
        <small className="lookup-hint error">{namingError}</small>
      ) : (
        <small className="lookup-hint info">
          Format: {STUDENT_ID_FORMAT_HINT}
          {parsed?.departmentName ? ` · ${parsed.departmentName}` : ''}
        </small>
      )}
    </div>
  )
}
