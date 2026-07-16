import React, { useCallback, useEffect, useState } from 'react'
import {
  getReservationAvailability,
  releaseReservation,
  reserveDocument
} from '../api'

function formatCountdown(expiresAt) {
  if (!expiresAt) {
    return ''
  }
  const remainingMs = new Date(expiresAt).getTime() - Date.now()
  if (remainingMs <= 0) {
    return 'Expired'
  }
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} left`
}

export default function StudentBookReservationControls({
  documentId,
  studentNumber,
  documentStudentNumber,
  category,
  status,
  inPublishedArchive,
  onNotify,
  onChanged
}) {
  const [availability, setAvailability] = useState(null)
  const [busy, setBusy] = useState(false)
  const [countdown, setCountdown] = useState('')

  const isPeerBook = Boolean(
    inPublishedArchive
    && category === 'FINAL_YEAR_PROJECT'
    && String(status || '').toUpperCase() === 'APPROVED'
    && documentStudentNumber
    && studentNumber
    && documentStudentNumber.trim().toUpperCase() !== studentNumber.trim().toUpperCase()
  )

  const refreshAvailability = useCallback(async () => {
    if (!isPeerBook || !documentId) {
      return
    }
    try {
      const next = await getReservationAvailability(documentId)
      setAvailability(next)
    } catch (err) {
      onNotify?.(err.message || 'Unable to load reservation slots.')
    }
  }, [documentId, isPeerBook, onNotify])

  useEffect(() => {
    refreshAvailability()
  }, [refreshAvailability])

  useEffect(() => {
    if (!availability?.reservedByMe || !availability?.myReservationId) {
      setCountdown('')
      return undefined
    }
    const tick = () => {
      setCountdown(formatCountdown(availability?.myReservationExpiresAt))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [availability])

  if (!isPeerBook) {
    return null
  }

  async function handleReserve() {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      const reservation = await reserveDocument(documentId)
      await refreshAvailability()
      onChanged?.(reservation)
      onNotify?.('Book reserved for 20 minutes. You can download while your slot is active.')
    } catch (err) {
      onNotify?.(err.message || 'Unable to reserve this book.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRelease() {
    if (busy || !availability?.myReservationId) {
      return
    }
    setBusy(true)
    try {
      await releaseReservation(availability.myReservationId)
      await refreshAvailability()
      onChanged?.()
      onNotify?.('Reservation released.')
    } catch (err) {
      onNotify?.(err.message || 'Unable to release reservation.')
    } finally {
      setBusy(false)
    }
  }

  const active = availability?.activeReservations ?? 0
  const max = availability?.maxConcurrent ?? 3
  const available = availability?.availableSlots ?? Math.max(0, max - active)

  return (
    <div className="student-reservation-controls">
      <span className="student-reservation-slots">
        {active}/{max} slots in use · {available} available
      </span>
      {availability?.reservedByMe ? (
        <>
          <span className="student-reservation-timer">{countdown || 'Active slot'}</span>
          <button type="button" className="ghost-btn compact" onClick={handleRelease} disabled={busy}>
            Release
          </button>
        </>
      ) : (
        <button
          type="button"
          className="primary-btn compact"
          onClick={handleReserve}
          disabled={busy || available <= 0}
        >
          {busy ? 'Reserving...' : available > 0 ? 'Reserve 20 min' : 'Slots full'}
        </button>
      )}
    </div>
  )
}
