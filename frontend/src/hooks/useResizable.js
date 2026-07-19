import { useCallback, useEffect, useState } from 'react'

function readStoredWidth(key, fallback, min, max) {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(key)
    const value = Number(raw)
    if (!Number.isFinite(value)) {
      return fallback
    }
    return Math.min(max, Math.max(min, value))
  } catch {
    return fallback
  }
}

export function useResizable(storageKey, {
  initial = 248,
  min = 200,
  max = 480
} = {}) {
  const [width, setWidth] = useState(() => readStoredWidth(storageKey, initial, min, max))

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width))
    } catch {
      // ignore
    }
  }, [storageKey, width])

  const startResize = useCallback((event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width

    function onMove(moveEvent) {
      const next = Math.min(max, Math.max(min, startWidth + (moveEvent.clientX - startX)))
      setWidth(next)
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [max, min, width])

  return { width, setWidth, startResize }
}

export function useResizableFromRight(storageKey, {
  initial = 320,
  min = 240,
  max = 560
} = {}) {
  const [width, setWidth] = useState(() => readStoredWidth(storageKey, initial, min, max))

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width))
    } catch {
      // ignore
    }
  }, [storageKey, width])

  const startResize = useCallback((event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width

    function onMove(moveEvent) {
      const next = Math.min(max, Math.max(min, startWidth - (moveEvent.clientX - startX)))
      setWidth(next)
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [max, min, width])

  return { width, setWidth, startResize }
}
