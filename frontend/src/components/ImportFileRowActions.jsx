import React from 'react'
import { EyeIcon, RefreshIcon, XIcon } from './Icons'

export default function ImportFileRowActions({
  replaced = false,
  excluded = false,
  previewBusy = false,
  onPreview,
  onReplace,
  onRemove
}) {
  return (
    <div className="import-file-actions">
      <button
        type="button"
        className="ghost-btn import-file-action"
        onClick={onPreview}
        disabled={previewBusy || excluded}
      >
        <EyeIcon className="icon" />
        Preview
      </button>
      <button
        type="button"
        className="ghost-btn import-file-action"
        onClick={onReplace}
        disabled={excluded}
      >
        <RefreshIcon className="icon" />
        Replace
      </button>
      {onRemove ? (
        <button
          type="button"
          className={`ghost-btn import-file-action ${excluded ? 'active' : ''}`}
          onClick={onRemove}
        >
          <XIcon className="icon" />
          {excluded ? 'Include' : 'Remove'}
        </button>
      ) : null}
      {replaced ? <span className="import-preview-badge replaced">Replaced</span> : null}
      {excluded ? <span className="import-preview-badge muted">Excluded</span> : null}
    </div>
  )
}
