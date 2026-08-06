import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getAdminReport } from '../api'
import {
  EXPORT_FORMATS,
  REPORT_TYPES,
  generateAdminReport
} from '../adminReportExport'

const CHART_COLORS = ['#0054a6', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#15803d', '#9333ea']
const REFRESH_MS = 15000

function humanizeKey(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function entriesFromMap(map) {
  return Object.entries(map || {}).map(([label, value]) => ({
    label: humanizeKey(label),
    value: Number(value) || 0
  }))
}

function BarChart({ title, items, emptyLabel = 'No data yet', onExport }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <article className="admin-report-card" data-report-section={title}>
      <header className="admin-report-card-head">
        <h3>{title}</h3>
        {onExport ? (
          <button type="button" className="ghost-btn admin-btn-sm" onClick={onExport}>
            Export
          </button>
        ) : null}
      </header>
      {items.length === 0 ? (
        <p className="admin-muted-cell">{emptyLabel}</p>
      ) : (
        <ul className="admin-report-bars">
          {items.map((item, index) => (
            <li key={item.label}>
              <div className="admin-report-bar-meta">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <div className="admin-report-bar-track">
                <span
                  className="admin-report-bar-fill"
                  style={{
                    width: `${Math.max(4, Math.round((item.value / max) * 100))}%`,
                    background: CHART_COLORS[index % CHART_COLORS.length]
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function DonutChart({ title, items, emptyLabel = 'No data yet', onExport }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <article className="admin-report-card" data-report-section={title}>
      <header className="admin-report-card-head">
        <h3>{title}</h3>
        {onExport ? (
          <button type="button" className="ghost-btn admin-btn-sm" onClick={onExport}>
            Export
          </button>
        ) : null}
      </header>
      {items.length === 0 || total === 0 ? (
        <p className="admin-muted-cell">{emptyLabel}</p>
      ) : (
        <div className="admin-report-donut-wrap">
          <svg className="admin-report-donut" viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="16" />
            {items.map((item, index) => {
              const length = (item.value / total) * circumference
              const segment = (
                <circle
                  key={item.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth="16"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                />
              )
              offset += length
              return segment
            })}
            <text x="70" y="66" textAnchor="middle" className="admin-report-donut-total">{total}</text>
            <text x="70" y="84" textAnchor="middle" className="admin-report-donut-caption">total</text>
          </svg>
          <ul className="admin-report-legend">
            {items.map((item, index) => (
              <li key={item.label}>
                <span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                {item.label}
                <em>{item.value}</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function TrendChart({ title, points, onExport }) {
  const values = (points || []).map((point) => Number(point.count) || 0)
  const max = Math.max(...values, 1)
  const width = 360
  const height = 140
  const padX = 18
  const padY = 16
  const step = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0
  const coords = values.map((value, index) => {
    const x = padX + index * step
    const y = height - padY - ((value / max) * (height - padY * 2))
    return `${x},${y}`
  })

  return (
    <article className="admin-report-card admin-report-card-wide" data-report-section={title}>
      <header className="admin-report-card-head">
        <h3>{title}</h3>
        {onExport ? (
          <button type="button" className="ghost-btn admin-btn-sm" onClick={onExport}>
            Export
          </button>
        ) : null}
      </header>
      {(points || []).length === 0 ? (
        <p className="admin-muted-cell">No uploads in the last 7 days.</p>
      ) : (
        <>
          <svg className="admin-report-trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
            <polyline fill="none" stroke="#0054a6" strokeWidth="3" points={coords.join(' ')} />
            {coords.map((point, index) => {
              const [x, y] = point.split(',')
              return <circle key={points[index]?.date || index} cx={x} cy={y} r="4" fill="#0054a6" />
            })}
          </svg>
          <div className="admin-report-trend-labels">
            {(points || []).map((point) => (
              <span key={point.date}>{String(point.date || '').slice(5)}</span>
            ))}
          </div>
        </>
      )}
    </article>
  )
}

export default function AdminReports({ onNotify }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState('general')
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exportBusy, setExportBusy] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')

  const loadReport = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
    }
    try {
      const data = await getAdminReport()
      setReport(data)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (!silent) {
        setReport(null)
        onNotify?.(err.message || 'Unable to load reports.')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [onNotify])

  useEffect(() => {
    loadReport()
    const timer = window.setInterval(() => loadReport({ silent: true }), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [loadReport])

  const usersByRole = useMemo(() => entriesFromMap(report?.usersByRole), [report])
  const documentsByCategory = useMemo(() => entriesFromMap(report?.documentsByCategory), [report])
  const documentsByStatus = useMemo(() => entriesFromMap(report?.documentsByStatus), [report])
  const activitiesByCategory = useMemo(() => entriesFromMap(report?.activitiesByCategory), [report])
  const selectedType = REPORT_TYPES.find((item) => item.id === reportType) || REPORT_TYPES[0]
  const selectedFormat = EXPORT_FORMATS.find((item) => item.id === exportFormat) || EXPORT_FORMATS[0]

  async function runExport({ type = reportType, format = exportFormat } = {}) {
    if (!report || exportBusy) return
    setExportBusy(true)
    try {
      const result = await generateAdminReport(report, { type, format })
      onNotify?.(
        format === 'pdf'
          ? `${result.label} PDF downloaded — open it to review the formatted tables.`
          : `${result.label} CSV downloaded.`
      )
    } catch (err) {
      onNotify?.(err.message || 'Unable to generate report.')
    } finally {
      setExportBusy(false)
    }
  }

  if (loading && !report) {
    return (
      <section className="admin-page admin-reports-page">
        <p className="admin-loading">Loading reports…</p>
      </section>
    )
  }

  if (!report) {
    return (
      <section className="admin-page admin-reports-page">
        <p className="admin-loading">Unable to load report data.</p>
        <button type="button" className="primary-btn admin-btn-sm" onClick={() => loadReport()}>Retry</button>
      </section>
    )
  }

  const showUsers = reportType === 'general' || reportType === 'users'
  const showDocCategory = reportType === 'general' || reportType === 'documents-category'
  const showDocStatus = reportType === 'general' || reportType === 'documents-status'
  const showActivity = reportType === 'general' || reportType === 'activity'
  const showUploads = reportType === 'general' || reportType === 'uploads'

  return (
    <section className="admin-page admin-reports-page" id="admin-reports-panel">
      <header className="admin-top admin-reports-top">
        <div className="admin-top-copy">
          <h1>Reports</h1>
          <p>
            Live archive analytics. Auto-refreshes every {REFRESH_MS / 1000}s
            {lastUpdated ? ` · Updated ${lastUpdated}` : ''}.
          </p>
        </div>
        <div className="admin-top-actions">
          <button type="button" className="ghost-btn admin-btn-sm" onClick={() => loadReport()} disabled={exportBusy}>
            Refresh now
          </button>
        </div>
      </header>

      <section className="admin-report-export-panel" aria-label="Generate report">
        <div className="admin-report-export-copy">
          <strong>Generate a report</strong>
        </div>

        <div className="admin-report-export-controls">
          <label className="admin-report-type-select">
            <span>Report type</span>
            <select value={reportType} onChange={(event) => setReportType(event.target.value)} disabled={exportBusy}>
              {REPORT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </label>

          <fieldset className="admin-report-format-group">
            <legend>File format</legend>
            <div className="admin-report-format-options">
              {EXPORT_FORMATS.map((format) => (
                <label
                  key={format.id}
                  className={`admin-report-format-option ${exportFormat === format.id ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="admin-report-format"
                    value={format.id}
                    checked={exportFormat === format.id}
                    onChange={() => setExportFormat(format.id)}
                    disabled={exportBusy}
                  />
                  <span className="admin-report-format-label">{format.label}</span>
                  <span className="admin-report-format-hint">{format.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="admin-report-export-actions">
            <p className="admin-report-export-summary">
              Ready to generate <strong>{selectedType.label}</strong> as <strong>{selectedFormat.label}</strong>.
              {selectedType.hint ? ` ${selectedType.hint}.` : ''}
            </p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => runExport()}
              disabled={exportBusy}
            >
              {exportBusy
                ? 'Generating…'
                : `Generate ${selectedFormat.label}`}
            </button>
          </div>
        </div>
      </section>

      <dl className="admin-metrics admin-report-metrics">
        <div className="admin-metric">
          <dt>Users</dt>
          <dd>{report.totalUsers ?? 0}</dd>
        </div>
        <div className="admin-metric">
          <dt>Active</dt>
          <dd>{report.activeUsers ?? 0}</dd>
        </div>
        <div className="admin-metric">
          <dt>Documents</dt>
          <dd>{report.activeDocuments ?? 0}</dd>
        </div>
        <div className="admin-metric">
          <dt>Uploads (7d)</dt>
          <dd>{report.uploadsLast7Days ?? 0}</dd>
        </div>
        <div className="admin-metric">
          <dt>Activities</dt>
          <dd>{report.totalActivities ?? 0}</dd>
        </div>
        <div className="admin-metric">
          <dt>Shares</dt>
          <dd>{report.totalShares ?? 0}</dd>
        </div>
      </dl>

      <div className="admin-report-grid">
        {showUsers ? (
          <DonutChart
            title="Users by role"
            items={usersByRole}
            onExport={() => runExport({ type: 'users', format: exportFormat })}
          />
        ) : null}
        {showDocCategory ? (
          <BarChart
            title="Documents by category"
            items={documentsByCategory}
            onExport={() => runExport({ type: 'documents-category', format: exportFormat })}
          />
        ) : null}
        {showDocStatus ? (
          <BarChart
            title="Documents by status"
            items={documentsByStatus}
            onExport={() => runExport({ type: 'documents-status', format: exportFormat })}
          />
        ) : null}
        {showActivity ? (
          <BarChart
            title="Activity by type"
            items={activitiesByCategory}
            onExport={() => runExport({ type: 'activity', format: exportFormat })}
          />
        ) : null}
        {showUploads ? (
          <TrendChart
            title="Uploads — last 7 days"
            points={report.uploadTrend || []}
            onExport={() => runExport({ type: 'uploads', format: exportFormat })}
          />
        ) : null}
      </div>
    </section>
  )
}
