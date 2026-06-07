import { describe, it, expect, beforeEach } from '@jest/globals';
import { Container, token } from '../../src/lib/container';

interface ITestService {
  getValue(): string;
}

interface IAnotherService {
  getName(): string;
}

class TestServiceImpl implements ITestService {
  getValue() { return 'test-value'; }
}

class AnotherServiceImpl implements IAnotherService {
  constructor(private prefix: string) {}
  getName() { return `${this.prefix}-name`; }
}

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register', () => {
    it('should register and resolve a service', () => {
      const testToken = token<ITestService>('ITestService');
      container.register(testToken, () => new TestServiceImpl());
      const result = container.resolve(testToken);
      expect(result.getValue()).toBe('test-value');
    });

    it('should create new instance each time with register', () => {
      const testToken = token<ITestService>('ITestService');
      container.register(testToken, () => new TestServiceImpl());
      const a = container.resolve(testToken);
      const b = container.resolve(testToken);
      expect(a).not.toBe(b);
    });

    it('should throw when resolving unregistered service', () => {
      const testToken = token<ITestService>('ITestService');
      expect(() => container.resolve(testToken)).toThrow('Service not registered: ITestService');
    });
  });

  describe('registerSingleton', () => {
    it('should return same instance each time', () => {
      const testToken = token<ITestService>('ITestService');
      container.registerSingleton(testToken, () => new TestServiceImpl());
      const a = container.resolve(testToken);
      const b = container.resolve(testToken);
      expect(a).toBe(b);
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      const testToken = token<ITestService>('ITestService');
      container.register(testToken, () => new TestServiceImpl());
      expect(container.has(testToken)).toBe(true);
    });

    it('should return false for unregistered service', () => {
      const testToken = token<ITestService>('ITestService');
      expect(container.has(testToken)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all registrations', () => {
      const testToken = token<ITestService>('ITestService');
      container.register(testToken, () => new TestServiceImpl());
      container.reset();
      expect(container.has(testToken)).toBe(false);
      expect(() => container.resolve(testToken)).toThrow();
    });

    it('should clear singleton cache', () => {
      const testToken = token<ITestService>('ITestService');
      container.registerSingleton(testToken, () => new TestServiceImpl());
      const a = container.resolve(testToken);
      container.reset();
      container.registerSingleton(testToken, () => new TestServiceImpl());
      const b = container.resolve(testToken);
      expect(a).not.toBe(b);
    });
  });

  describe('dependency resolution', () => {
    it('should resolve dependencies through container', () => {
      const testToken = token<ITestService>('ITestService');
      const anotherToken = token<IAnotherService>('IAnotherService');
      container.register(testToken, () => new TestServiceImpl());
      container.register(anotherToken, () => new AnotherServiceImpl(
        container.resolve(testToken).getValue(),
      ));
      const result = container.resolve(anotherToken);
      expect(result.getName()).toBe('test-value-name');
    });

    it('should resolve singleton dependencies correctly', () => {
      const testToken = token<ITestService>('ITestService');
      const anotherToken = token<IAnotherService>('IAnotherService');
      container.registerSingleton(testToken, () => new TestServiceImpl());
      container.register(anotherToken, () => new AnotherServiceImpl(
        container.resolve(testToken).getValue(),
      ));
      const a = container.resolve(anotherToken);
      const b = container.resolve(anotherToken);
      expect(a.getName()).toBe('test-value-name');
      expect(b.getName()).toBe('test-value-name');
      expect(a).not.toBe(b);
    });
  });

  describe('type safety', () => {
    it('should enforce type at token level', () => {
      const testToken = token<ITestService>('ITestService');
      container.register(testToken, () => new TestServiceImpl());
      const result = container.resolve(testToken);
      expect(typeof result.getValue).toBe('function');
    });
  });
});
