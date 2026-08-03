import React, { useId, useMemo } from 'react'
import { buildDocumentTypePresetList } from '../studentDocumentTypes'

export default function DocumentTypeCombobox({
  value,
  onChange,
  userRole,
  id,
  placeholder = 'Type or pick a document type…',
  required = false,
  compact = false,
  listId: listIdProp
}) {
  const generatedId = useId()
  const listId = listIdProp || `document-type-list-${generatedId.replace(/:/g, '')}`
  const presets = useMemo(() => buildDocumentTypePresetList(userRole), [userRole])

  return (
    <div className={`document-type-combobox${compact ? ' document-type-combobox-compact' : ''}`}>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        autoComplete="off"
      />
      <datalist id={listId}>
        {presets.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
    </div>
  )
}
