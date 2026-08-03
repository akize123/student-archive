import React from 'react'
import { EyeIcon, RefreshIcon } from './Icons'

export default function ImportFileRowActions({
  replaced = false,
  previewBusy = false,
  onPreview,
  onReplace
}) {
  return (
    <div className="import-file-actions">
      <button
        type="button"
        className="ghost-btn import-file-action"
        onClick={onPreview}
        disabled={previewBusy}
      >
        <EyeIcon className="icon" />
        Preview
      </button>
      <button type="button" className="ghost-btn import-file-action" onClick={onReplace}>
        <RefreshIcon className="icon" />
        Replace
      </button>
      {replaced ? <span className="import-preview-badge replaced">Replaced</span> : null}
    </div>
  )
}
