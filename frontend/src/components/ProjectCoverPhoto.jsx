import React, { useEffect, useState } from 'react'
import { fetchDocumentCoverObjectUrl } from '../api'

export default function ProjectCoverPhoto({ documentId, hasCoverPhoto, alt = 'Project face photo', className = '' }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let active = true
    let objectUrl = null

    async function load() {
      if (!documentId || !hasCoverPhoto) {
        setSrc(null)
        return
      }
      try {
        objectUrl = await fetchDocumentCoverObjectUrl(documentId)
        if (active) {
          setSrc(objectUrl)
        } else if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
        }
      } catch {
        if (active) {
          setSrc(null)
        }
      }
    }

    load()
    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [documentId, hasCoverPhoto])

  if (!src) {
    return (
      <div className={`project-cover-fallback ${className}`} aria-hidden="true">
        <span>{(alt || 'P').slice(0, 1).toUpperCase()}</span>
      </div>
    )
  }

  return <img className={`project-cover-photo ${className}`} src={src} alt={alt} />
}
