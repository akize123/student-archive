import React, { useMemo } from 'react'
import {
  CUSTOM_SUBFOLDER_TYPE,
  buildPrimaryDocumentTypeOptions,
  getDocumentTypeDefinition,
  hasSubcategories,
  resolveDocumentTypeSelection
} from '../studentDocumentTypes'

export default function DocumentTypeSelector({
  documentType = '',
  documentSubType = '',
  customSubType = '',
  onChange,
  userRole,
  disabled = false,
  compact = false,
  idPrefix = 'doc-type'
}) {
  const primaryOptions = useMemo(
    () => buildPrimaryDocumentTypeOptions(userRole),
    [userRole]
  )
  const definition = getDocumentTypeDefinition(documentType)
  const showSubcategories = hasSubcategories(documentType)
  const subOptions = definition?.subcategories || []

  function patchSelection(patch) {
    const next = {
      documentType: patch.documentType ?? documentType,
      documentSubType: patch.documentSubType ?? documentSubType,
      customSubType: patch.customSubType ?? customSubType
    }
    const resolved = resolveDocumentTypeSelection(next)
    onChange?.({
      ...next,
      title: resolved.title,
      category: resolved.category
    })
  }

  return (
    <div className={`document-type-selector${compact ? ' is-compact' : ''}`}>
      <label className="document-type-selector-field">
        <span>Document type</span>
        <select
          value={documentType}
          onChange={(event) => {
            patchSelection({
              documentType: event.target.value,
              documentSubType: '',
              customSubType: ''
            })
          }}
          disabled={disabled}
        >
          <option value="">Select document type</option>
          {primaryOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      {showSubcategories ? (
        <label className="document-type-selector-field">
          <span>Sub-category</span>
          <select
            value={documentSubType}
            onChange={(event) => {
              patchSelection({
                documentSubType: event.target.value,
                customSubType: event.target.value === CUSTOM_SUBFOLDER_TYPE ? customSubType : ''
              })
            }}
            disabled={disabled || !documentType}
          >
            <option value="">Select sub-category</option>
            {subOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {showSubcategories && documentSubType === CUSTOM_SUBFOLDER_TYPE ? (
        <label className="document-type-selector-field document-type-selector-custom">
          <span>Custom sub-category</span>
          <input
            type="text"
            value={customSubType}
            onChange={(event) => patchSelection({ customSubType: event.target.value })}
            disabled={disabled}
            placeholder="Enter sub-document type name"
          />
        </label>
      ) : null}

      {!showSubcategories && documentType ? (
        <p className="document-type-selector-hint">
          This document type uses a single folder — no sub-category needed.
        </p>
      ) : null}
    </div>
  )
}
