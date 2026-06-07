const poolEnd = jest.fn().mockResolvedValue(undefined);
const poolConstructor = jest.fn().mockImplementation(() => ({ end: poolEnd }));
const prismaConnect = jest.fn().mockResolvedValue(undefined);
const prismaQueryRawUnsafe = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
const prismaDisconnect = jest.fn().mockResolvedValue(undefined);
const prismaClientConstructor = jest.fn().mockImplementation(() => ({
  $connect: prismaConnect,
  $queryRawUnsafe: prismaQueryRawUnsafe,
  $disconnect: prismaDisconnect,
}));
const prismaPgConstructor = jest.fn().mockImplementation((pool) => ({ pool }));

jest.mock('pg', () => ({
  Pool: poolConstructor,
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: prismaPgConstructor,
}));

jest.mock('../../../src/generated/prisma/client', () => ({
  PrismaClient: prismaClientConstructor,
}));

describe('PrismaDatabaseConnectionValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    'mysql://db.example.com/myndbbs',
    'postgresql://user:pass@127.0.0.1:5432/myndbbs',
    'postgresql://user:pass@10.0.0.2:5432/myndbbs',
    'postgresql://user:pass@192.168.1.2:5432/myndbbs',
    'postgresql://user:pass@169.254.169.254:5432/myndbbs',
  ])('rejects unsafe database URL %s before opening a connection', async (dbUrl) => {
    const { PrismaDatabaseConnectionValidator } = await import(
      '../../../src/infrastructure/services/provisioning/PrismaDatabaseConnectionValidator'
    );

    const validator = new PrismaDatabaseConnectionValidator();
    await expect(validator.validate(dbUrl)).resolves.toBe(false);

    expect(poolConstructor).not.toHaveBeenCalled();
    expect(prismaClientConstructor).not.toHaveBeenCalled();
  });

  it('continues to the database connection check for allowed public hosts', async () => {
    const networkSecurity = await import('../../../src/lib/networkSecurity');
    jest.spyOn(networkSecurity, 'assertAllowedResolvedHost').mockResolvedValueOnce(undefined);

    const { PrismaDatabaseConnectionValidator } = await import(
      '../../../src/infrastructure/services/provisioning/PrismaDatabaseConnectionValidator'
    );

    const validator = new PrismaDatabaseConnectionValidator();
    await expect(
      validator.validate('postgresql://user:pass@db.example.com:5432/myndbbs'),
    ).resolves.toBe(true);

    expect(networkSecurity.assertAllowedResolvedHost).toHaveBeenCalledWith('db.example.com');
    expect(poolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgresql://user:pass@db.example.com:5432/myndbbs',
        connectionTimeoutMillis: 5000,
      }),
    );
    expect(prismaConnect).toHaveBeenCalled();
    expect(prismaQueryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(prismaDisconnect).toHaveBeenCalled();
    expect(poolEnd).toHaveBeenCalled();
  });
});
