import { SubmissionFileApplicationService } from '../src/application/journal/SubmissionFileApplicationService'

describe('SubmissionFileApplicationService', () => {
  const content = Buffer.from('%PDF-1.7 test content')
  it('stores a private PDF and persists metadata', async () => {
    const put = jest.fn(async () => undefined)
    const save = jest.fn(async () => undefined)
    const service = new SubmissionFileApplicationService({ put, remove: jest.fn(async () => undefined) }, { save })
    const result = await service.uploadPdf({ journalId: 'j', submissionId: 's', versionId: 'v', originalName: 'x.pdf', mimeType: 'application/pdf', content })
    expect(result.storageKey).toContain('journals/j/submissions/s/versions/v/')
    expect(result.sha256).toHaveLength(64)
    expect(put).toHaveBeenCalledWith(result.storageKey, content, 'application/pdf')
    expect(save).toHaveBeenCalledWith(result)
  })

  it('removes an uploaded object if metadata persistence fails', async () => {
    const remove = jest.fn(async () => undefined)
    const service = new SubmissionFileApplicationService({ put: jest.fn(async () => undefined), remove }, { save: jest.fn(async () => { throw new Error('db') }) })
    await expect(service.uploadPdf({ journalId: 'j', submissionId: 's', versionId: 'v', originalName: 'x.pdf', mimeType: 'application/pdf', content })).rejects.toThrow('db')
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
