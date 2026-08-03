import React from 'react'
import DocumentTypeCombobox from './DocumentTypeCombobox'

export default function DocumentTitlePicker({
  value,
  onChange,
  userRole,
  compact = false,
  required = false,
  customPlaceholder = 'Type or pick a document type…'
}) {
  return (
    <div className={`document-title-picker${compact ? ' document-title-picker-compact' : ''}`}>
      <DocumentTypeCombobox
        value={value}
        onChange={onChange}
        userRole={userRole}
        compact={compact}
        required={required}
        placeholder={customPlaceholder}
      />
    </div>
  )
}
