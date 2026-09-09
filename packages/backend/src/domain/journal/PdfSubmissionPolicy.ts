export const MAX_SUBMISSION_PDF_BYTES = 20 * 1024 * 1024

export function assertSubmissionPdf(input: { originalName: string; mimeType: string; sizeBytes: number; header: Uint8Array }): void {
  if (!input.originalName.toLowerCase().endsWith('.pdf')) throw new Error('ERR_SUBMISSION_PDF_ONLY')
  if (input.mimeType !== 'application/pdf') throw new Error('ERR_SUBMISSION_PDF_MIME_INVALID')
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_SUBMISSION_PDF_BYTES) throw new Error('ERR_SUBMISSION_PDF_SIZE_INVALID')
  const signature = new TextDecoder().decode(input.header.slice(0, 5))
  if (signature !== '%PDF-') throw new Error('ERR_SUBMISSION_PDF_SIGNATURE_INVALID')
}
