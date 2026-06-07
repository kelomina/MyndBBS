import {
  getClientIp,
  searchLimiter,
  publicReadLimiter,
  postLimiter,
  uploadLimiter,
  friendRequestLimiter,
} from '../src/lib/rateLimit'

function createMockReq(ip = '127.0.0.1') {
  return {
    ip,
    socket: { remoteAddress: ip },
    headers: {},
    app: { get: () => false },
  }
}

function createMockRes() {
  const headers: Record<string, string> = {}
  return {
    statusCode: 200,
    headers,
    body: null as any,
    writableEnded: false,
    headersSent: false,
    setHeader(key: string, value: string) {
      headers[key] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(data: any) {
      this.body = data
      this.writableEnded = true
      return this
    },
    on() {
      return this
    },
    once() {
      return this
    },
  }
}

async function callLimiter(
  limiter: (req: any, res: any, next: () => void) => Promise<void>,
  ip = '127.0.0.1',
) {
  const req = createMockReq(ip)
  const res = createMockRes()
  let nextCalled = false
  const next = () => {
    nextCalled = true
  }
  await limiter(req, res, next)
  return { req, res, nextCalled }
}

describe('getClientIp', () => {
  it('should use Express-calculated req.ip instead of raw X-Forwarded-For', () => {
    const request = {
      ip: '198.51.100.10',
      socket: { remoteAddress: '203.0.113.10' },
      headers: { 'x-forwarded-for': '1.1.1.1' },
    }

    expect(getClientIp(request as never)).toBe('198.51.100.10')
  })

  it('should fall back to socket.remoteAddress when req.ip is undefined', () => {
    const request = {
      socket: { remoteAddress: '203.0.113.10' },
    }

    expect(getClientIp(request as never)).toBe('203.0.113.10')
  })

  it('should fall back to unknown when both ip and socket are undefined', () => {
    const request = {}

    expect(getClientIp(request as never)).toBe('unknown')
  })
})

describe('publicReadLimiter', () => {
  afterEach(async () => {
    await publicReadLimiter.resetKey('127.0.0.1')
    await publicReadLimiter.resetKey('10.0.0.1')
    await searchLimiter.resetKey('127.0.0.1')
    await searchLimiter.resetKey('10.0.0.1')
  })

  it('should be a valid Express middleware with resetKey and getKey methods', () => {
    expect(typeof publicReadLimiter).toBe('function')
    expect(typeof publicReadLimiter.resetKey).toBe('function')
    expect(typeof publicReadLimiter.getKey).toBe('function')
  })

  it('should limit to 30 requests per minute', async () => {
    const { req } = await callLimiter(publicReadLimiter)
    expect((req as any).rateLimit.limit).toBe(30)
  })

  it('should use getClientIp as keyGenerator (different IPs tracked independently)', async () => {
    const { req } = await callLimiter(publicReadLimiter, '127.0.0.1')
    expect((req as any).rateLimit.key).toBe('127.0.0.1')

    const info = await publicReadLimiter.getKey('127.0.0.1')
    expect(info?.totalHits).toBe(1)

    const otherInfo = await publicReadLimiter.getKey('192.168.1.1')
    expect(otherInfo).toBeUndefined()
  })

  it('should have ip validation disabled (work with undefined req.ip)', async () => {
    const req = {
      socket: { remoteAddress: '10.0.0.1' },
      headers: {},
      app: { get: () => false },
    }
    const res = createMockRes()
    let nextCalled = false
    const next = () => {
      nextCalled = true
    }

    await publicReadLimiter(req, res, next)
    expect(nextCalled).toBe(true)
  })

  it('should return appropriate rate limit error message when rate-limited', async () => {
    for (let i = 0; i < 30; i++) {
      await callLimiter(publicReadLimiter)
    }
    const { res } = await callLimiter(publicReadLimiter)
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      error: 'Too many requests from this IP, please try again later.',
    })
  })
})

describe('searchLimiter', () => {
  afterEach(async () => {
    await searchLimiter.resetKey('127.0.0.1')
  })

  it('should limit search to 20 requests per minute', async () => {
    const { req } = await callLimiter(searchLimiter)
    expect((req as any).rateLimit.limit).toBe(20)
  })

  it('should return a search-specific rate limit error message', async () => {
    for (let i = 0; i < 20; i++) {
      await callLimiter(searchLimiter)
    }
    const { res } = await callLimiter(searchLimiter)
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      error: 'Too many search requests from this IP, please try again later.',
    })
  })
})

describe('rateLimit configurations consistency', () => {
  afterEach(async () => {
    await postLimiter.resetKey('127.0.0.1')
    await uploadLimiter.resetKey('127.0.0.1')
    await friendRequestLimiter.resetKey('127.0.0.1')
    await postLimiter.resetKey('10.0.0.2')
    await uploadLimiter.resetKey('10.0.0.2')
    await friendRequestLimiter.resetKey('10.0.0.2')
  })

  it('postLimiter should limit to 10 requests per 5 minutes', async () => {
    const { req } = await callLimiter(postLimiter)
    expect((req as any).rateLimit.limit).toBe(10)
  })

  it('uploadLimiter should limit to 5 uploads per 10 minutes', async () => {
    const { req } = await callLimiter(uploadLimiter)
    expect((req as any).rateLimit.limit).toBe(5)
  })

  it('friendRequestLimiter should limit to 20 requests per hour', async () => {
    const { req } = await callLimiter(friendRequestLimiter)
    expect((req as any).rateLimit.limit).toBe(20)
  })

  it('all limiters should use getClientIp as keyGenerator (different IPs tracked independently)', async () => {
    const { req } = await callLimiter(postLimiter, '127.0.0.1')
    expect((req as any).rateLimit.key).toBe('127.0.0.1')

    const info = await postLimiter.getKey('127.0.0.1')
    expect(info?.totalHits).toBe(1)

    const otherInfo = await postLimiter.getKey('192.168.1.1')
    expect(otherInfo).toBeUndefined()
  })

  it('all limiters should have ip validation disabled (work with undefined req.ip)', async () => {
    const limiters = [postLimiter, uploadLimiter, friendRequestLimiter]
    for (const limiter of limiters) {
      const req = {
        socket: { remoteAddress: '10.0.0.2' },
        headers: {},
        app: { get: () => false },
      }
      const res = createMockRes()
      let nextCalled = false
      const next = () => {
        nextCalled = true
      }

      await limiter(req, res, next)
      expect(nextCalled).toBe(true)
    }
  })
})
