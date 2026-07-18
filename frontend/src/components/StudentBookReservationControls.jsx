import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getReservationAvailability,
  getReservableBooks,
  releaseReservation,
  reserveDocument
} from '../api'

function formatCountdown(targetAt) {
  if (!targetAt) {
    return ''
  }
  const remainingMs = new Date(targetAt).getTime() - Date.now()
  if (remainingMs <= 0) {
    return 'Expired'
  }
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatSlotRange(startsAt, expiresAt) {
  const start = new Date(startsAt)
  const end = new Date(expiresAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }
  const datePart = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${datePart} · ${startTime} – ${endTime}`
}

function roundUpToNextFiveMinutes(date = new Date()) {
  const next = new Date(date)
  next.setSeconds(0, 0)
  const remainder = next.getMinutes() % 5
  if (remainder !== 0) {
    next.setMinutes(next.getMinutes() + (5 - remainder))
  } else if (date.getSeconds() > 0 || date.getMilliseconds() > 0) {
    next.setMinutes(next.getMinutes() + 5)
  }
  return next
}

function toLocalDateTimeInputValue(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIsoDateTime(localDateTimeValue) {
  if (!localDateTimeValue) {
    return null
  }
  const parsed = new Date(localDateTimeValue)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const pad = (value) => String(value).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:00`
}

function reservationPhase(reservation) {
  const now = Date.now()
  const startsAt = new Date(reservation?.myReservationStartsAt || reservation?.startsAt).getTime()
  const expiresAt = new Date(reservation?.myReservationExpiresAt || reservation?.expiresAt).getTime()
  if (Number.isNaN(startsAt) || Number.isNaN(expiresAt)) {
    return 'unknown'
  }
  if (now < startsAt) {
    return 'scheduled'
  }
  if (now < expiresAt) {
    return 'active'
  }
  return 'expired'
}

export function StudentBookReservationForm({
  documentId,
  documentTitle,
  studentNumber,
  documentStudentNumber,
  category,
  status,
  inPublishedArchive,
  compact = false,
  onNotify,
  onChanged
}) {
  const [availability, setAvailability] = useState(null)
  const [busy, setBusy] = useState(false)
  const [startsAtInput, setStartsAtInput] = useState(() => toLocalDateTimeInputValue(roundUpToNextFiveMinutes()))
  const [purpose, setPurpose] = useState('')
  const [countdown, setCountdown] = useState('')

  const isPeerBook = Boolean(
    inPublishedArchive
    && category === 'FINAL_YEAR_PROJECT'
    && String(status || '').toUpperCase() === 'APPROVED'
    && documentStudentNumber
    && studentNumber
    && documentStudentNumber.trim().toUpperCase() !== studentNumber.trim().toUpperCase()
  )

  const refreshAvailability = useCallback(async (requestedStartsAt) => {
    if (!documentId) {
      return
    }
    if (!inPublishedArchive && !documentId) {
      return
    }
    try {
      const isoStartsAt = requestedStartsAt ? toIsoDateTime(requestedStartsAt) : null
      const next = await getReservationAvailability(documentId, isoStartsAt)
      setAvailability(next)
    } catch (err) {
      onNotify?.(err.message || 'Unable to load reservation slots.')
    }
  }, [documentId, inPublishedArchive, onNotify])

  useEffect(() => {
    if (!documentId) {
      return undefined
    }
    refreshAvailability(startsAtInput)
  }, [documentId, refreshAvailability, startsAtInput])

  useEffect(() => {
    if (!availability?.reservedByMe) {
      setCountdown('')
      return undefined
    }
    const phase = reservationPhase({
      myReservationStartsAt: availability.myReservationStartsAt,
      myReservationExpiresAt: availability.myReservationExpiresAt
    })
    const tick = () => {
      if (phase === 'scheduled') {
        setCountdown(`Starts in ${formatCountdown(availability.myReservationStartsAt)}`)
      } else if (phase === 'active') {
        setCountdown(`${formatCountdown(availability.myReservationExpiresAt)} left`)
      } else {
        setCountdown('')
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [availability])

  const slotAvailable = availability?.requestedSlotAvailable !== false
  const bookedSlots = availability?.bookedSlots || []
  const max = availability?.maxConcurrent ?? 3

  async function handleReserve(event) {
    event?.preventDefault?.()
    if (busy || !documentId) {
      return
    }
    const isoStartsAt = toIsoDateTime(startsAtInput)
    if (!isoStartsAt) {
      onNotify?.('Choose a valid start time.')
      return
    }
    setBusy(true)
    try {
      const reservation = await reserveDocument(documentId, {
        startsAt: isoStartsAt,
        purpose: purpose.trim() || null
      })
      await refreshAvailability(startsAtInput)
      onChanged?.(reservation)
      onNotify?.('Book reserved for a 20-minute reading slot.')
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
      await refreshAvailability(startsAtInput)
      onChanged?.()
      onNotify?.('Reservation released.')
    } catch (err) {
      onNotify?.(err.message || 'Unable to release reservation.')
    } finally {
      setBusy(false)
    }
  }

  if (inPublishedArchive && !isPeerBook) {
    return null
  }

  if (!documentId) {
    return null
  }

  const phase = availability?.reservedByMe
    ? reservationPhase({
      myReservationStartsAt: availability.myReservationStartsAt,
      myReservationExpiresAt: availability.myReservationExpiresAt
    })
    : null

  return (
    <form
      className={`student-reservation-form${compact ? ' compact' : ''}`}
      onSubmit={handleReserve}
    >
      {documentTitle && !compact ? (
        <p className="student-reservation-form-title">{documentTitle}</p>
      ) : null}
      <p className="student-reservation-form-hint">
        Each book allows up to {max} overlapping 20-minute slots. Pick a start time that does not clash with booked slots below.
      </p>

      {bookedSlots.length ? (
        <div className="student-reservation-booked-slots">
          <span className="student-reservation-booked-label">Booked slots</span>
          <ul>
            {bookedSlots.map((slot) => (
              <li key={`${slot.startsAt}-${slot.expiresAt}`}>
                {formatSlotRange(slot.startsAt, slot.expiresAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="student-reservation-empty-slots">No reservations yet — all slots are open for scheduling.</p>
      )}

      {availability?.reservedByMe ? (
        <div className="student-reservation-active">
          <span className="student-reservation-timer">
            {phase === 'scheduled' ? 'Scheduled · ' : 'Active · '}
            {countdown || formatSlotRange(availability.myReservationStartsAt, availability.myReservationExpiresAt)}
          </span>
          <button type="button" className="ghost-btn compact" onClick={handleRelease} disabled={busy}>
            Release
          </button>
        </div>
      ) : (
        <>
          <label className="student-reservation-field">
            <span>Start time</span>
            <input
              type="datetime-local"
              value={startsAtInput}
              min={toLocalDateTimeInputValue(roundUpToNextFiveMinutes())}
              onChange={(event) => setStartsAtInput(event.target.value)}
              required
            />
          </label>
          <label className="student-reservation-field">
            <span>Purpose (optional)</span>
            <input
              type="text"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Research topic, chapter, or reason for reading"
              maxLength={500}
            />
          </label>
          {!slotAvailable ? (
            <p className="student-reservation-conflict">
              That start time overlaps with {max} existing reservations. Choose another time.
            </p>
          ) : null}
          <button
            type="submit"
            className="primary-btn compact"
            disabled={busy || !slotAvailable}
          >
            {busy ? 'Booking...' : 'Reserve 20-minute slot'}
          </button>
        </>
      )}
    </form>
  )
}

export default function StudentBookReservationControls(props) {
  return <StudentBookReservationForm {...props} compact />
}

export function StudentArchiveBookReservationPanel({ studentNumber, onNotify, onChanged, refreshToken = 0 }) {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBookId, setSelectedBookId] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getReservableBooks()
      .then((items) => {
        if (cancelled) {
          return
        }
        const nextBooks = Array.isArray(items) ? items : []
        setBooks(nextBooks)
        setSelectedBookId((current) => {
          if (current && nextBooks.some((book) => String(book.id) === String(current))) {
            return current
          }
          return nextBooks[0]?.id ? String(nextBooks[0].id) : ''
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setBooks([])
          onNotify?.(err.message || 'Unable to load department books.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [onNotify, refreshToken, studentNumber])

  const selectedBook = useMemo(
    () => books.find((book) => String(book.id) === String(selectedBookId)),
    [books, selectedBookId]
  )

  return (
    <section className="student-book-reservation-panel" aria-label="Reserve department books">
      <div className="student-panel-head">
        <div>
          <p className="eyebrow">Department archive</p>
          <h2>Reserve a book online</h2>
        </div>
      </div>
      <p className="student-reservation-panel-copy">
        Browse approved final year projects from your department. Each book supports up to 3 scheduled 20-minute reading slots at different times.
      </p>
      {loading ? (
        <p className="student-reservation-panel-status">Loading available books...</p>
      ) : !books.length ? (
        <p className="student-reservation-panel-status">
          No peer project books are published in your department archive yet.
        </p>
      ) : (
        <>
          <label className="student-reservation-field">
            <span>Select book</span>
            <select value={selectedBookId} onChange={(event) => setSelectedBookId(event.target.value)}>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {[book.title, book.ownerName, book.studentNumber].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
          {selectedBook ? (
            <StudentBookReservationForm
              key={`${selectedBook.id}-${refreshToken}`}
              documentId={selectedBook.id}
              documentTitle={selectedBook.title}
              studentNumber={studentNumber}
              documentStudentNumber={selectedBook.studentNumber}
              category="FINAL_YEAR_PROJECT"
              status="APPROVED"
              inPublishedArchive
              onNotify={onNotify}
              onChanged={onChanged}
            />
          ) : null}
        </>
      )}
    </section>
  )
}
