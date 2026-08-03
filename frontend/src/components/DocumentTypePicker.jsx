import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  createDocumentCategory,
  createDocumentType,
  getDocumentCategories,
  getDocumentTypes
} from '../api'

function CatalogPicker({
  label,
  placeholder,
  items,
  value,
  onChange,
  disabled,
  compact,
  query,
  onQueryChange,
  onAdd,
  addTitle,
  emptyLabel
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const close = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  const selected = useMemo(
    () => items.find((item) => String(item.id) === String(value)) || null,
    [items, value]
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return items
    }
    return items.filter((item) => {
      const haystack = [item.name, item.code, item.office, item.department, item.categoryName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [items, query])

  return (
    <div className={`document-catalog-row ${compact ? 'is-compact' : ''}`}>
      <span className="document-catalog-label">{label}</span>
      <div className={`document-type-picker ${compact ? 'is-compact' : ''}`} ref={wrapRef}>
        <button
          type="button"
          className="document-type-picker-trigger"
          disabled={disabled}
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation()
            setOpen((current) => !current)
          }}
        >
          <span>{selected?.name || placeholder}</span>
          <em>{selected?.office || 'Choose from list'}</em>
        </button>

        {open ? (
          <div className="document-type-picker-menu" onClick={(event) => event.stopPropagation()}>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              autoFocus
            />
            <div className="document-type-picker-list">
              {filtered.length ? filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`document-type-picker-option ${String(item.id) === String(value) ? 'selected' : ''}`}
                  onClick={() => {
                    onChange?.(item.id, item)
                    setOpen(false)
                    onQueryChange('')
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>{[item.office, item.department, item.categoryName].filter(Boolean).join(' · ')}</span>
                </button>
              )) : (
                <p className="inline-note">
                  {query.trim()
                    ? 'No matches for this search.'
                    : (emptyLabel || 'No categories available yet. Use + to add one.')}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {onAdd ? (
        <button
          type="button"
          className="ghost-icon document-catalog-add-btn"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onAdd()
          }}
          title={addTitle}
          aria-label={addTitle}
        >
          +
        </button>
      ) : null}
    </div>
  )
}

export default function DocumentTypePicker({
  categoryDefinitionId,
  documentTypeId,
  onChange,
  category,
  office,
  onNotify,
  disabled = false,
  compact = false
}) {
  const [categories, setCategories] = useState([])
  const [types, setTypes] = useState([])
  const [categoryQuery, setCategoryQuery] = useState('')
  const [typeQuery, setTypeQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '' })
  const [typeForm, setTypeForm] = useState({ name: '' })

  const resolvedOffice = office || 'Registrar Office'

  useEffect(() => {
    let active = true
    setLoadError('')
    getDocumentCategories({
      office: office || undefined
    })
      .then((items) => {
        if (active) setCategories(items || [])
      })
      .catch((err) => {
        if (active) {
          setCategories([])
          setLoadError(err.message || 'Unable to load categories.')
        }
      })
    return () => {
      active = false
    }
  }, [office])

  useEffect(() => {
    if (!categoryDefinitionId) {
      setTypes([])
      return undefined
    }
    let active = true
    getDocumentTypes({
      categoryDefinitionId,
      office: office || undefined
    })
      .then((items) => {
        if (active) setTypes(items || [])
      })
      .catch(() => {
        if (active) setTypes([])
      })
    return () => {
      active = false
    }
  }, [categoryDefinitionId, office])

  async function handleCreateCategory() {
    if (!categoryForm.name.trim()) {
      onNotify?.('Category name is required.')
      return
    }
    setBusy(true)
    try {
      const created = await createDocumentCategory({
        name: categoryForm.name.trim(),
        office: resolvedOffice,
        faculty: null,
        department: null,
        legacyCategory: category || 'APPLICATION_DOCUMENTS'
      })
      setCategories((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)))
      onChange?.({
        categoryDefinitionId: created.id,
        documentTypeId: '',
        category: created.legacyCategory || category,
        categoryName: created.name,
        typeName: ''
      })
      setCategoryDialogOpen(false)
      setCategoryForm({ name: '' })
      onNotify?.(`Category "${created.name}" created.`)
    } catch (err) {
      onNotify?.(err.message || 'Unable to create category.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateType() {
    if (!categoryDefinitionId) {
      onNotify?.('Select a category first.')
      return
    }
    if (!typeForm.name.trim()) {
      onNotify?.('Document type name is required.')
      return
    }
    setBusy(true)
    try {
      const selectedCategory = categories.find((item) => String(item.id) === String(categoryDefinitionId))
      const created = await createDocumentType({
        categoryDefinitionId: Number(categoryDefinitionId),
        category: selectedCategory?.legacyCategory || category || 'APPLICATION_DOCUMENTS',
        name: typeForm.name.trim(),
        office: selectedCategory?.office || resolvedOffice,
        faculty: null,
        department: null
      })
      setTypes((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)))
      onChange?.({
        categoryDefinitionId,
        documentTypeId: created.id,
        category: created.category || selectedCategory?.legacyCategory || category,
        categoryName: created.categoryName || selectedCategory?.name,
        typeName: created.name
      })
      setTypeDialogOpen(false)
      setTypeForm({ name: '' })
      onNotify?.(`Document type "${created.name}" created under ${selectedCategory?.name || 'category'}.`)
    } catch (err) {
      onNotify?.(err.message || 'Unable to create document type.')
    } finally {
      setBusy(false)
    }
  }

  const selectedCategoryName = categories.find((item) => String(item.id) === String(categoryDefinitionId))?.name

  return (
    <div className={`document-catalog-picker ${compact ? 'is-compact' : ''}`}>
      {loadError ? <p className="lookup-hint error">{loadError}</p> : null}
      <CatalogPicker
        label="Category"
        placeholder="Select category"
        items={categories}
        value={categoryDefinitionId}
        query={categoryQuery}
        onQueryChange={setCategoryQuery}
        disabled={disabled || busy}
        compact={compact}
        addTitle="Add new category"
        emptyLabel="No categories for your office yet. Use + to add Application Documents, Registration Forms, etc."
        onAdd={() => setCategoryDialogOpen(true)}
        onChange={(nextCategoryId, selectedCategory) => {
          onChange?.({
            categoryDefinitionId: nextCategoryId,
            documentTypeId: '',
            category: selectedCategory?.legacyCategory || category,
            categoryName: selectedCategory?.name || '',
            typeName: ''
          })
        }}
      />

      <CatalogPicker
        label="Document type"
        placeholder={categoryDefinitionId ? 'Select document type' : 'Choose a category first'}
        items={types}
        value={documentTypeId}
        query={typeQuery}
        onQueryChange={setTypeQuery}
        disabled={disabled || busy || !categoryDefinitionId}
        compact={compact}
        addTitle={selectedCategoryName ? `Add document type inside ${selectedCategoryName}` : 'Add document type'}
        emptyLabel={categoryDefinitionId ? 'No document types yet. Use + to add one (e.g. Birth Certificate).' : 'Choose a category first.'}
        onAdd={categoryDefinitionId ? () => setTypeDialogOpen(true) : undefined}
        onChange={(nextTypeId, selectedType) => {
          onChange?.({
            categoryDefinitionId,
            documentTypeId: nextTypeId,
            category: selectedType?.category || category,
            categoryName: selectedType?.categoryName || selectedCategoryName || '',
            typeName: selectedType?.name || ''
          })
        }}
      />

      {categoryDialogOpen ? (
        <div
          className="modal-backdrop document-type-dialog-backdrop"
          onClick={() => !busy && setCategoryDialogOpen(false)}
          role="presentation"
        >
          <div className="modal document-type-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <p className="eyebrow">New category</p>
                <h2>Add category</h2>
              </div>
              <button type="button" className="ghost-icon" onClick={() => !busy && setCategoryDialogOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="inline-note">
              Examples: Application Documents, Registration Forms, Final Year Project.
            </p>
            <label>
              <span>Category name</span>
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm({ name: event.target.value })}
                placeholder="Application Documents"
                autoFocus
                disabled={busy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    handleCreateCategory()
                  }
                }}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setCategoryDialogOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleCreateCategory} disabled={busy || !categoryForm.name.trim()}>
                {busy ? 'Saving…' : 'Add category'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {typeDialogOpen ? (
        <div
          className="modal-backdrop document-type-dialog-backdrop"
          onClick={() => !busy && setTypeDialogOpen(false)}
          role="presentation"
        >
          <div className="modal document-type-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <p className="eyebrow">{selectedCategoryName || 'Document type'}</p>
                <h2>Add document type</h2>
              </div>
              <button type="button" className="ghost-icon" onClick={() => !busy && setTypeDialogOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="inline-note">
              {selectedCategoryName
                ? `Uploaded files will be stored inside "${selectedCategoryName}" under this type name.`
                : 'Choose the document type for this upload.'}
            </p>
            <label>
              <span>Document type name</span>
              <input
                value={typeForm.name}
                onChange={(event) => setTypeForm({ name: event.target.value })}
                placeholder="Birth Certificate"
                autoFocus
                disabled={busy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    handleCreateType()
                  }
                }}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setTypeDialogOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleCreateType} disabled={busy || !typeForm.name.trim()}>
                {busy ? 'Saving…' : 'Add type'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
