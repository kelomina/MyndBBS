import { Queue, Worker, type Processor, type ConnectionOptions, type WorkerOptions } from 'bullmq';

function getConnectionOpts(): ConnectionOptions {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
    };
  }
  return { host: '127.0.0.1', port: 6379 };
}

const queues = new Map<string, Queue>();
const workers = new Set<Worker>();

export function createQueue(name: string): Queue {
  return new Queue(name, { connection: getConnectionOpts() });
}

export function createWorker(name: string, processor: Processor, opts?: { concurrency?: number; limiter?: { max: number; duration: number }; settings?: Record<string, unknown> }): Worker {
  const workerOpts: WorkerOptions = { connection: getConnectionOpts() };
  if (opts?.concurrency !== undefined) workerOpts.concurrency = opts.concurrency;
  if (opts?.limiter !== undefined) workerOpts.limiter = opts.limiter;
  if (opts?.settings !== undefined) workerOpts.settings = opts.settings as NonNullable<WorkerOptions['settings']>;
  const worker = new Worker(name, processor, workerOpts);
  workers.add(worker);
  return worker;
}

export const EMAIL_QUEUE_NAME = 'myndbbs-email';
export const SEARCH_INDEX_QUEUE_NAME = 'myndbbs-search-index';
export const CLEANUP_QUEUE_NAME = 'myndbbs-scheduler';

function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = createQueue(name);
    queues.set(name, queue);
  }
  return queue;
}

export const getEmailQueue = (): Queue => getQueue(EMAIL_QUEUE_NAME);
export const getIndexQueue = (): Queue => getQueue(SEARCH_INDEX_QUEUE_NAME);
export const getCleanupQueue = (): Queue => getQueue(CLEANUP_QUEUE_NAME);

export async function shutdownQueues(): Promise<void> {
  const closeWorkers = [...workers].map(async (worker) => {
    await worker.close();
    workers.delete(worker);
  });
  const closeQueues = [...queues.values()].map(async (queue) => {
    await queue.close();
  });

  await Promise.all([...closeWorkers, ...closeQueues]);
  queues.clear();
}
