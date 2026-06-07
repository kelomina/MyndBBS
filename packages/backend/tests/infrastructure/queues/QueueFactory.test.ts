const close = jest.fn();
const workerClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name: string) => ({ name, close })),
  Worker: jest.fn().mockImplementation((name: string) => ({ name, close: workerClose })),
}));

describe('queueFactory', () => {
  beforeEach(() => {
    jest.resetModules();
    close.mockReset();
    workerClose.mockReset();
  });

  it('reuses queue instances for repeated getters', async () => {
    const { getIndexQueue, SEARCH_INDEX_QUEUE_NAME } = await import('../../../src/infrastructure/queues/queueFactory');

    const first = getIndexQueue();
    const second = getIndexQueue();

    expect(first).toBe(second);
    expect(first.name).toBe(SEARCH_INDEX_QUEUE_NAME);
  });

  it('tracks workers and closes queues on shutdown', async () => {
    const { createWorker, getCleanupQueue, shutdownQueues } = await import('../../../src/infrastructure/queues/queueFactory');

    getCleanupQueue();
    createWorker('myndbbs-scheduler', async () => undefined);
    await shutdownQueues();

    expect(workerClose).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
