import { validate } from '../../src/middleware/validation';
import { z } from 'zod';

describe('Validation Middleware', () => {
  const mockRequest = (body: any) => ({ body } as any);
  const mockResponse = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  };
  const mockNext = jest.fn();

  describe('validate function', () => {
    const schema = z.object({
      email: z.string().email('ERR_INVALID_EMAIL'),
      password: z.string().min(8, 'ERR_PASSWORD_TOO_SHORT'),
    });

    beforeEach(() => {
      mockNext.mockClear();
    });

    it('should call next when validation passes', () => {
      const req = mockRequest({ email: 'test@example.com', password: 'password123' });
      const res = mockResponse();

      validate(schema)(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should replace req.body with validated data', () => {
      const req = mockRequest({ email: 'test@example.com', password: 'password123' });
      const res = mockResponse();

      validate(schema)(req, res, mockNext);

      expect(req.body).toEqual({ email: 'test@example.com', password: 'password123' });
    });

    it('should return 400 with field errors when validation fails', () => {
      const req = mockRequest({ email: 'invalid-email', password: 'short' });
      const res = mockResponse();

      validate(schema)(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ERR_VALIDATION_FAILED',
        details: expect.objectContaining({
          email: expect.arrayContaining(['ERR_INVALID_EMAIL']),
          password: expect.arrayContaining(['ERR_PASSWORD_TOO_SHORT']),
        }),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should hide field errors when validation details are disabled', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const req = mockRequest({ email: 'invalid-email', password: 'short' });
      req.originalUrl = '/api/v1/auth/register';
      const res = mockResponse();

      try {
        validate(schema, {
          exposeDetails: false,
          publicErrorCode: 'ERR_REGISTRATION_REQUEST_INVALID',
        })(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'ERR_REGISTRATION_REQUEST_INVALID',
        });
        expect(res.json.mock.calls[0][0]).not.toHaveProperty('details');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Validation] Request body validation failed',
          expect.objectContaining({
            path: '/api/v1/auth/register',
            errors: expect.objectContaining({
              email: expect.arrayContaining(['ERR_INVALID_EMAIL']),
              password: expect.arrayContaining(['ERR_PASSWORD_TOO_SHORT']),
            }),
          }),
        );
        expect(mockNext).not.toHaveBeenCalled();
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });

    it('should handle nested field errors', () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string().min(1, 'ERR_NAME_REQUIRED'),
        }),
      });
      const req = mockRequest({ user: { name: '' } });
      const res = mockResponse();

      validate(nestedSchema)(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ERR_VALIDATION_FAILED',
        details: {
          'user.name': ['ERR_NAME_REQUIRED'],
        },
      });
    });

    it('should handle missing required fields', () => {
      const req = mockRequest({ email: 'test@example.com' });
      const res = mockResponse();

      validate(schema)(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ERR_VALIDATION_FAILED',
        details: expect.objectContaining({
          password: expect.any(Array),
        }),
      });
    });

    it('should handle empty body', () => {
      const req = mockRequest({});
      const res = mockResponse();

      validate(schema)(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ERR_VALIDATION_FAILED',
        details: expect.objectContaining({
          email: expect.any(Array),
          password: expect.any(Array),
        }),
      });
    });
  });
});
