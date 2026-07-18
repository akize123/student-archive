import React, { useEffect, useState } from 'react'
import { DownloadIcon } from './Icons'
import { downloadDocument, getMyReservations, releaseReservation } from '../api'

function formatCountdown(targetAt) {
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
    return '20-minute slot'
  }
  const datePart = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${datePart} · ${startTime} – ${endTime}`
}

function reservationStatus(reservation, now) {
  const startsAt = new Date(reservation.startsAt || reservation.createdAt).getTime()
  const expiresAt = new Date(reservation.expiresAt).getTime()
  if (expiresAt <= now) {
    return 'expired'
  }
  if (startsAt > now) {
    return 'scheduled'
  }
  return 'active'
}

export default function StudentReservationsPanel({ onNotify, onRefreshToken = 0 }) {
  const [reservations, setReservations] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    getMyReservations()
      .then((items) => setReservations(Array.isArray(items) ? items : []))
      .catch(() => setReservations([]))
  }, [onRefreshToken])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function handleDownload(reservation) {
    if (!reservation?.documentId) {
      return
    }
    if (reservationStatus(reservation, now) !== 'active') {
      onNotify?.('Download unlocks when your scheduled slot starts.')
      return
    }
    try {
      await downloadDocument(reservation.documentId)
      onNotify?.(`Downloading ${reservation.documentTitle || 'book'}...`)
    } catch (err) {
      onNotify?.(err.message || 'Unable to download book.')
    }
  }

  async function handleRelease(reservation) {
    if (!reservation?.id || busyId) {
      return
    }
    setBusyId(reservation.id)
    try {
      await releaseReservation(reservation.id)
      setReservations((current) => current.filter((item) => item.id !== reservation.id))
      onNotify?.('Reservation released.')
    } catch (err) {
      onNotify?.(err.message || 'Unable to release reservation.')
    } finally {
      setBusyId(null)
    }
  }

  const activeReservations = reservations.filter(
    (reservation) => reservationStatus(reservation, now) !== 'expired'
  )

  if (!activeReservations.length) {
    return null
  }

  return (
    <section className="student-documents-panel student-documents-panel-compact">
      <div className="student-panel-head">
        <div>
          <p className="eyebrow">Department archive</p>
          <h2>My reservations</h2>
        </div>
      </div>
      <div className="student-document-list">
        {activeReservations.map((reservation) => {
          const status = reservationStatus(reservation, now)
          const startsAt = reservation.startsAt || reservation.createdAt
          const countdown = status === 'scheduled'
            ? `Starts in ${formatCountdown(startsAt)}`
            : `${formatCountdown(reservation.expiresAt)} left`

          return (
            <article key={reservation.id} className="student-document-row">
              <div className="student-document-copy">
                <div>
                  <strong>{reservation.documentTitle || 'Reserved book'}</strong>
                  <span>
                    {status === 'scheduled' ? 'Scheduled · ' : 'Active · '}
                    {formatSlotRange(startsAt, reservation.expiresAt)}
                  </span>
                  <span>{countdown}</span>
                  {reservation.purpose ? <em>{reservation.purpose}</em> : null}
                </div>
              </div>
              <div className="student-document-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => handleDownload(reservation)}
                  disabled={status !== 'active'}
                  title={status !== 'active' ? 'Available when your slot starts' : 'Download book'}
                >
                  <DownloadIcon className="icon" />
                  Download
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => handleRelease(reservation)}
                  disabled={busyId === reservation.id}
                >
                  Release
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
