import React, { useEffect, useState } from 'react'
import { DownloadIcon } from './Icons'
import { downloadDocument, getMyReservations, releaseReservation } from '../api'

function formatCountdown(expiresAt) {
  const remainingMs = new Date(expiresAt).getTime() - Date.now()
  if (remainingMs <= 0) {
    return 'Expired'
  }
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
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
    (reservation) => new Date(reservation.expiresAt).getTime() > now
  )

  if (!activeReservations.length) {
    return (
      <section className="student-documents-panel">
        <div className="student-panel-head">
          <div>
            <p className="eyebrow">Department archive</p>
            <h2>My reservations</h2>
          </div>
        </div>
        <p className="student-empty-copy">
          No active book reservations. Browse the department archive and reserve an approved final year project for a 20-minute reading slot (max 3 students per book).
        </p>
      </section>
    )
  }

  return (
    <section className="student-documents-panel">
      <div className="student-panel-head">
        <div>
          <p className="eyebrow">Department archive</p>
          <h2>My reservations</h2>
        </div>
      </div>
      <div className="student-document-list">
        {activeReservations.map((reservation) => (
          <article key={reservation.id} className="student-document-row">
            <div className="student-document-copy">
              <div>
                <strong>{reservation.documentTitle || 'Reserved book'}</strong>
                <span>{formatCountdown(reservation.expiresAt)} · 20-minute slot</span>
              </div>
            </div>
            <div className="student-document-actions">
              <button type="button" className="ghost-btn" onClick={() => handleDownload(reservation)}>
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
        ))}
      </div>
    </section>
  )
}
