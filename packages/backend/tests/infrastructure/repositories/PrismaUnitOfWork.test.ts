import { PrismaUnitOfWork } from '../../../src/infrastructure/repositories/PrismaUnitOfWork';
import { basePrisma, prismaTxLocalStorage } from '../../../src/db';

jest.mock('../../../src/db', () => ({
  basePrisma: {
    $transaction: jest.fn()
  },
  prismaTxLocalStorage: {
    getStore: jest.fn(),
    run: jest.fn()
  }
}));

describe('PrismaUnitOfWork', () => {
  let uow: PrismaUnitOfWork;

  beforeEach(() => {
    uow = new PrismaUnitOfWork();
    jest.clearAllMocks();
  });

  it('should execute work within an existing transaction if one exists', async () => {
    const existingTx = {};
    (prismaTxLocalStorage.getStore as jest.Mock).mockReturnValue(existingTx);

    const work = jest.fn().mockResolvedValue('result');

    const result = await uow.execute(work);

    expect(result).toBe('result');
    expect(work).toHaveBeenCalled();
    expect(basePrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should start a new transaction if none exists', async () => {
    (prismaTxLocalStorage.getStore as jest.Mock).mockReturnValue(undefined);
    
    const mockTx = {};
    (basePrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    (prismaTxLocalStorage.run as jest.Mock).mockImplementation((tx, callback) => {
      expect(tx).toBe(mockTx);
      return callback();
    });

    const work = jest.fn().mockResolvedValue('new-tx-result');

    const result = await uow.execute(work);

    expect(result).toBe('new-tx-result');
    expect(basePrisma.$transaction).toHaveBeenCalled();
    expect(prismaTxLocalStorage.run).toHaveBeenCalled();
    expect(work).toHaveBeenCalled();
  });
});
