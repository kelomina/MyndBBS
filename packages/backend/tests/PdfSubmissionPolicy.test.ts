import { assertSubmissionPdf, MAX_SUBMISSION_PDF_BYTES } from '../src/domain/journal/PdfSubmissionPolicy'

const valid = { originalName: 'paper.pdf', mimeType: 'application/pdf', sizeBytes: 100, header: new TextEncoder().encode('%PDF-1.7') }

describe('PDF submission policy', () => {
  it('accepts a valid PDF signature and metadata', () => expect(() => assertSubmissionPdf(valid)).not.toThrow())
  it('rejects non-PDF, oversized, and spoofed files', () => {
    expect(() => assertSubmissionPdf({ ...valid, originalName: 'paper.docx' })).toThrow('ERR_SUBMISSION_PDF_ONLY')
    expect(() => assertSubmissionPdf({ ...valid, sizeBytes: MAX_SUBMISSION_PDF_BYTES + 1 })).toThrow('ERR_SUBMISSION_PDF_SIZE_INVALID')
    expect(() => assertSubmissionPdf({ ...valid, header: new TextEncoder().encode('not-pdf') })).toThrow('ERR_SUBMISSION_PDF_SIGNATURE_INVALID')
  })
})
