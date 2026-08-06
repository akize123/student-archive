import React, { useEffect, useMemo, useState } from 'react'
import { addAcademicYear, getAcademicYearInputFeedback, getAcademicYearOptions } from '../academicYears'

export default function AcademicYearField({
  value,
  onChange,
  disabled = false,
  allowedYears = null,
  allowAdd = true,
  helperText = '',
  label = 'Academic year'
}) {
  const [options, setOptions] = useState(() => getAcademicYearOptions())
  const [adding, setAdding] = useState(false)
  const [draftYear, setDraftYear] = useState('')
  const [hint, setHint] = useState('')
  const [hintTone, setHintTone] = useState('info')
  const [existingYear, setExistingYear] = useState('')

  useEffect(() => {
    setOptions(getAcademicYearOptions())
  }, [value, adding])

  const sortedOptions = useMemo(() => {
    const base = Array.isArray(allowedYears) && allowedYears.length
      ? [...allowedYears]
      : [...options]
    return base.sort((left, right) => left.localeCompare(right))
  }, [options, allowedYears])

  const canAdd = allowAdd && !(Array.isArray(allowedYears) && allowedYears.length)

  function applyFeedback(feedback) {
    setHint(feedback.message)
    setHintTone(feedback.tone)
    setExistingYear(feedback.existingFolderName || '')
  }

  function updateDraftYear(nextValue) {
    setDraftYear(nextValue)
    applyFeedback(getAcademicYearInputFeedback(nextValue, options))
  }

  function startAdding() {
    applyFeedback(getAcademicYearInputFeedback('', options))
    setDraftYear('')
    setAdding(true)
  }

  function cancelAdding() {
    setAdding(false)
    setDraftYear('')
    setHint('')
    setHintTone('info')
    setExistingYear('')
  }

  function useExistingYear() {
    if (!existingYear) {
      return
    }
    onChange(existingYear)
    cancelAdding()
  }

  function handleAddYear(event) {
    event.preventDefault()
    const feedback = getAcademicYearInputFeedback(draftYear, options)
    if (feedback.tone === 'existing') {
      useExistingYear()
      return
    }
    if (feedback.tone === 'error') {
      applyFeedback(feedback)
      return
    }
    try {
      const created = addAcademicYear(draftYear)
      setOptions(getAcademicYearOptions())
      onChange(created)
      cancelAdding()
    } catch (err) {
      setHint(err.message || 'Unable to add academic year.')
      setHintTone('error')
    }
  }

  return (
    <div className="academic-year-field">
      <label>
        <span>{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || adding}
        >
          <option value="">Select {String(label || 'academic year').toLowerCase()}</option>
          {sortedOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      {canAdd && adding ? (
        <form className="academic-year-add" onSubmit={handleAddYear}>
          <input
            value={draftYear}
            onChange={(event) => updateDraftYear(event.target.value)}
            placeholder="2029-2030"
            aria-label="New academic year"
          />
          {hintTone === 'existing' ? (
            <button type="button" className="ghost-btn" onClick={useExistingYear}>
              Use {existingYear}
            </button>
          ) : (
            <button
              type="submit"
              className="ghost-btn"
              disabled={hintTone === 'error'}
            >
              Save
            </button>
          )}
          <button type="button" className="ghost-btn" onClick={cancelAdding}>
            Cancel
          </button>
        </form>
      ) : null}
      {canAdd && !adding ? (
        <button
          type="button"
          className="ghost-btn academic-year-add-btn"
          onClick={startAdding}
          disabled={disabled}
        >
          Add year
        </button>
      ) : null}
      {helperText ? (
        <small className="lookup-hint info">{helperText}</small>
      ) : null}
      {hint ? (
        <small className={`lookup-hint ${hintTone === 'error' ? 'error' : ''}`}>
          {hint}
        </small>
      ) : null}
    </div>
  )
}
