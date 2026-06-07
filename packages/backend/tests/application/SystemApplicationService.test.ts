import { SystemApplicationService } from '../../src/application/system/SystemApplicationService';
import { IStoragePort } from '../../src/domain/system/ports/IStoragePort';

describe('SystemApplicationService', () => {
  it('should upload file using storage port', async () => {
    const mockStorage: IStoragePort = { saveFile: jest.fn().mockResolvedValue('/uploads/test.png') };
    const service = new SystemApplicationService({
      routeWhitelistRepository: {} as any,
      storagePort: mockStorage,
      unitOfWork: { execute: jest.fn((work) => work()) } as any,
    });
    
    const buffer = Buffer.from('test');
    const result = await service.uploadAttachment(buffer);
    
    expect(mockStorage.saveFile).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-fA-F-]{36}\.enc$/), buffer);
    expect(result).toBe('/uploads/test.png');
  });
});
