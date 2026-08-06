import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const REPORT_TYPES = [
  {
    id: 'general',
    label: 'All report types (general)',
    hint: 'Includes everything listed below: users, documents, activity, and uploads in one file'
  },
  { id: 'users', label: 'Users by role', hint: 'Account counts per role' },
  { id: 'documents-category', label: 'Documents by category', hint: 'Active files by document category' },
  { id: 'documents-status', label: 'Documents by status', hint: 'Pending, approved, rejected, and more' },
  { id: 'activity', label: 'Activity by type', hint: 'Uploads, shares, approvals, and more' },
  { id: 'uploads', label: 'Uploads — last 7 days', hint: 'Daily upload trend' }
]

export const EXPORT_FORMATS = [
  {
    id: 'pdf',
    label: 'PDF',
    hint: 'Readable printed report with titled sections and tables — best for sharing and presentations.'
  },
  {
    id: 'csv',
    label: 'CSV',
    hint: 'Spreadsheet-friendly values for Excel or further analysis.'
  }
]

function humanizeKey(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function stampFromReport(report) {
  return String(report?.generatedAt || new Date().toISOString()).replace(/[:T]/g, '-').slice(0, 16)
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadTextFile(filename, content, mime) {
  downloadBlob(filename, new Blob([content], { type: mime }))
}

function sectionCsv(title, pairs) {
  const lines = [
    ['Report', title],
    ['Label', 'Count'],
    ...pairs.map(([label, value]) => [humanizeKey(label), value])
  ]
  return lines.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
}

export function buildCsv(report, type = 'general') {
  if (type === 'users') {
    return sectionCsv('Users by role', Object.entries(report.usersByRole || {}))
  }
  if (type === 'documents-category') {
    return sectionCsv('Documents by category', Object.entries(report.documentsByCategory || {}))
  }
  if (type === 'documents-status') {
    return sectionCsv('Documents by status', Object.entries(report.documentsByStatus || {}))
  }
  if (type === 'activity') {
    return sectionCsv('Activity by type', Object.entries(report.activitiesByCategory || {}))
  }
  if (type === 'uploads') {
    return sectionCsv(
      'Uploads — last 7 days',
      (report.uploadTrend || []).map((point) => [point.date, point.count])
    )
  }

  const lines = [
    ['AUCA Smart Archive — General Report', ''],
    ['Generated at', report.generatedAt || ''],
    [],
    ['Metric', 'Value'],
    ['Total users', report.totalUsers ?? 0],
    ['Active users', report.activeUsers ?? 0],
    ['Inactive users', report.inactiveUsers ?? 0],
    ['Total documents', report.totalDocuments ?? 0],
    ['Active documents', report.activeDocuments ?? 0],
    ['Archived documents', report.archivedDocuments ?? 0],
    ['Uploads last 7 days', report.uploadsLast7Days ?? 0],
    ['Total activities', report.totalActivities ?? 0],
    ['Total shares', report.totalShares ?? 0],
    [],
    ['Users by role', 'Count'],
    ...Object.entries(report.usersByRole || {}).map(([key, value]) => [humanizeKey(key), value]),
    [],
    ['Documents by category', 'Count'],
    ...Object.entries(report.documentsByCategory || {}).map(([key, value]) => [humanizeKey(key), value]),
    [],
    ['Documents by status', 'Count'],
    ...Object.entries(report.documentsByStatus || {}).map(([key, value]) => [humanizeKey(key), value]),
    [],
    ['Activities by type', 'Count'],
    ...Object.entries(report.activitiesByCategory || {}).map(([key, value]) => [humanizeKey(key), value]),
    [],
    ['Activities by office', 'Count'],
    ...Object.entries(report.activitiesByOffice || {}).map(([key, value]) => [humanizeKey(key), value]),
    [],
    ['Upload trend date', 'Count'],
    ...(report.uploadTrend || []).map((point) => [point.date, point.count])
  ]
  return lines.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
}

function pairsFromMap(map) {
  return Object.entries(map || {}).map(([label, value]) => [humanizeKey(label), Number(value) || 0])
}

function sectionsForType(report, type) {
  const summary = [
    ['Total users', report.totalUsers ?? 0],
    ['Active users', report.activeUsers ?? 0],
    ['Inactive users', report.inactiveUsers ?? 0],
    ['Total documents', report.totalDocuments ?? 0],
    ['Active documents', report.activeDocuments ?? 0],
    ['Archived documents', report.archivedDocuments ?? 0],
    ['Uploads last 7 days', report.uploadsLast7Days ?? 0],
    ['Total activities', report.totalActivities ?? 0],
    ['Total shares', report.totalShares ?? 0]
  ]

  if (type === 'users') {
    return [
      { title: 'Summary', rows: summary.filter(([label]) => label.toLowerCase().includes('user')) },
      { title: 'Users by role', rows: pairsFromMap(report.usersByRole) }
    ]
  }
  if (type === 'documents-category') {
    return [
      { title: 'Summary', rows: summary.filter(([label]) => label.toLowerCase().includes('document') || label.toLowerCase().includes('upload')) },
      { title: 'Documents by category', rows: pairsFromMap(report.documentsByCategory) }
    ]
  }
  if (type === 'documents-status') {
    return [
      { title: 'Summary', rows: summary.filter(([label]) => label.toLowerCase().includes('document')) },
      { title: 'Documents by status', rows: pairsFromMap(report.documentsByStatus) }
    ]
  }
  if (type === 'activity') {
    return [
      { title: 'Summary', rows: [['Total activities', report.totalActivities ?? 0], ['Total shares', report.totalShares ?? 0]] },
      { title: 'Activity by type', rows: pairsFromMap(report.activitiesByCategory) },
      { title: 'Activity by office', rows: pairsFromMap(report.activitiesByOffice) }
    ]
  }
  if (type === 'uploads') {
    return [
      { title: 'Summary', rows: [['Uploads last 7 days', report.uploadsLast7Days ?? 0]] },
      {
        title: 'Uploads — last 7 days',
        rows: (report.uploadTrend || []).map((point) => [String(point.date || ''), Number(point.count) || 0])
      }
    ]
  }

  return [
    { title: 'Key metrics', rows: summary },
    { title: 'Users by role', rows: pairsFromMap(report.usersByRole) },
    { title: 'Documents by category', rows: pairsFromMap(report.documentsByCategory) },
    { title: 'Documents by status', rows: pairsFromMap(report.documentsByStatus) },
    { title: 'Activity by type', rows: pairsFromMap(report.activitiesByCategory) },
    { title: 'Activity by office', rows: pairsFromMap(report.activitiesByOffice) },
    {
      title: 'Uploads — last 7 days',
      rows: (report.uploadTrend || []).map((point) => [String(point.date || ''), Number(point.count) || 0])
    }
  ]
}

async function buildPdf(report, type = 'general') {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 48
  const navy = rgb(0.06, 0.2, 0.45)
  const muted = rgb(0.35, 0.4, 0.48)
  const line = rgb(0.82, 0.86, 0.92)
  const rowAlt = rgb(0.96, 0.97, 0.99)

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const ensureSpace = (needed) => {
    if (y - needed < margin) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  const drawText = (text, x, size, options = {}) => {
    const activeFont = options.bold ? fontBold : font
    const color = options.color || navy
    page.drawText(String(text ?? ''), {
      x,
      y,
      size,
      font: activeFont,
      color,
      maxWidth: options.maxWidth || pageWidth - margin * 2
    })
  }

  const typeMeta = REPORT_TYPES.find((item) => item.id === type) || REPORT_TYPES[0]
  const generated = report.generatedAt
    ? new Date(report.generatedAt).toLocaleString()
    : new Date().toLocaleString()

  drawText('AUCA Smart Archive', margin, 11, { bold: true, color: navy })
  y -= 18
  drawText(typeMeta.label, margin, 22, { bold: true, color: navy })
  y -= 16
  drawText(typeMeta.hint, margin, 10, { color: muted, maxWidth: pageWidth - margin * 2 })
  y -= 14
  drawText(`Generated: ${generated}`, margin, 9, { color: muted })
  y -= 10
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: line
  })
  y -= 22

  const colLabel = margin
  const colValue = pageWidth - margin - 90
  const rowHeight = 20

  for (const section of sectionsForType(report, type)) {
    ensureSpace(56)
    drawText(section.title, margin, 13, { bold: true, color: navy })
    y -= 8
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.8,
      color: line
    })
    y -= 18

    if (!section.rows.length) {
      drawText('No data available for this section.', margin, 10, { color: muted })
      y -= 22
      continue
    }

    ensureSpace(rowHeight + 8)
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: pageWidth - margin * 2,
      height: rowHeight,
      color: rgb(0.9, 0.93, 0.97)
    })
    drawText('Label', colLabel + 8, 9, { bold: true, color: navy })
    drawText('Count', colValue, 9, { bold: true, color: navy })
    y -= rowHeight + 2

    section.rows.forEach((row, index) => {
      ensureSpace(rowHeight + 4)
      if (index % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: y - 4,
          width: pageWidth - margin * 2,
          height: rowHeight,
          color: rowAlt
        })
      }
      const [label, value] = row
      drawText(label, colLabel + 8, 10, { color: rgb(0.12, 0.16, 0.22), maxWidth: colValue - colLabel - 20 })
      drawText(String(value), colValue, 10, { bold: true, color: navy })
      y -= rowHeight
    })

    y -= 16
  }

  const pages = pdf.getPages()
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: margin,
      y: 28,
      size: 8,
      font,
      color: muted
    })
    pdfPage.drawText('AUCA Smart Archive · Admin report', {
      x: pageWidth - margin - 160,
      y: 28,
      size: 8,
      font,
      color: muted
    })
  })

  return pdf.save()
}

/**
 * Generate and download an admin report in the chosen format.
 * @param {'pdf'|'csv'} format
 * @param {string} type report type id
 */
export async function generateAdminReport(report, { format = 'pdf', type = 'general' } = {}) {
  if (!report) {
    throw new Error('Report data is not loaded yet.')
  }
  const safeType = REPORT_TYPES.some((item) => item.id === type) ? type : 'general'
  const stamp = stampFromReport(report)
  const label = REPORT_TYPES.find((item) => item.id === safeType)?.label || safeType

  if (format === 'csv') {
    downloadTextFile(
      `auca-${safeType}-report-${stamp}.csv`,
      buildCsv(report, safeType),
      'text/csv;charset=utf-8'
    )
    return { format: 'csv', type: safeType, label }
  }

  const bytes = await buildPdf(report, safeType)
  downloadBlob(`auca-${safeType}-report-${stamp}.pdf`, new Blob([bytes], { type: 'application/pdf' }))
  return { format: 'pdf', type: safeType, label }
}
