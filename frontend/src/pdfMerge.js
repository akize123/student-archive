import { PDFDocument } from 'pdf-lib'

/**
 * Merge multiple PDF File/Blob objects into one multi-page PDF File.
 */
export async function mergePdfFiles(files, fileName = 'phone-scan-combined.pdf') {
  const inputs = (files || []).filter(Boolean)
  if (!inputs.length) {
    throw new Error('No PDF files to join.')
  }
  if (inputs.length === 1) {
    const only = inputs[0]
    return only instanceof File
      ? only
      : new File([only], fileName, { type: 'application/pdf' })
  }

  const merged = await PDFDocument.create()
  for (const file of inputs) {
    const bytes = await file.arrayBuffer()
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const pages = await merged.copyPages(source, source.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }

  const output = await merged.save()
  return new File([output], fileName, { type: 'application/pdf' })
}

export async function countMergedPdfPages(file) {
  if (!file) return 0
  const bytes = await file.arrayBuffer()
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return pdf.getPageCount()
}
