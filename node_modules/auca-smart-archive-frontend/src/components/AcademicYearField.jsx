import React, { useEffect, useMemo, useState } from 'react'
import { addAcademicYear, getAcademicYearOptions } from '../academicYears'

export default function AcademicYearField({ value, onChange, disabled = false }) {
  const [options, setOptions] = useState(() => getAcademicYearOptions())
  const [adding, setAdding] = useState(false)
  const [draftYear, setDraftYear] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setOptions(getAcademicYearOptions())
  }, [value, adding])

  const sortedOptions = useMemo(
    () => [...options].sort((left, right) => left.localeCompare(right)),
    [options]
  )

  function handleAddYear(event) {
    event.preventDefault()
    try {
      const created = addAcademicYear(draftYear)
      setOptions(getAcademicYearOptions())
      onChange(created)
      setDraftYear('')
      setAdding(false)
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to add academic year.')
    }
  }

  return (
    <div className="academic-year-field">
      <label>
        <span>Academic year</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || adding}
        >
          <option value="">Select academic year</option>
          {sortedOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      {adding ? (
        <form className="academic-year-add" onSubmit={handleAddYear}>
          <input
            value={draftYear}
            onChange={(event) => {
              setDraftYear(event.target.value)
              setError('')
            }}
            placeholder="2029-2030"
            aria-label="New academic year"
          />
          <button type="submit" className="ghost-btn">Save</button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setAdding(false)
              setDraftYear('')
              setError('')
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="ghost-btn academic-year-add-btn"
          onClick={() => setAdding(true)}
          disabled={disabled}
        >
          Add academic year
        </button>
      )}
      {error ? <small className="lookup-hint error">{error}</small> : null}
    </div>
  )
}
