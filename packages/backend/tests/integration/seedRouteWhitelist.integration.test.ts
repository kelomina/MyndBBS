import { DEFAULT_ROUTE_WHITELIST_ROUTES, ensureDefaultRouteWhitelist } from '../../prisma/seed';

describe('ensureDefaultRouteWhitelist integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates all default whitelist routes when the whitelist is empty', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const findUnique = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue(undefined);

    await ensureDefaultRouteWhitelist({
      routeWhitelist: {
        findUnique,
        create,
      },
    });

    expect(findUnique).toHaveBeenCalledTimes(DEFAULT_ROUTE_WHITELIST_ROUTES.length);
    expect(create).toHaveBeenCalledTimes(DEFAULT_ROUTE_WHITELIST_ROUTES.length);
    expect(create.mock.calls.map(([call]) => call.data.path)).toEqual(
      DEFAULT_ROUTE_WHITELIST_ROUTES.map((route) => route.path)
    );
    expect(consoleLogSpy).toHaveBeenCalledTimes(DEFAULT_ROUTE_WHITELIST_ROUTES.length);
  });

  it('only inserts default routes that are still missing', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'existing-api' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-privacy' });
    const create = jest.fn().mockResolvedValue(undefined);

    await ensureDefaultRouteWhitelist({
      routeWhitelist: {
        findUnique,
        create,
      },
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        path: '/terms',
      }),
    });
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });
});
