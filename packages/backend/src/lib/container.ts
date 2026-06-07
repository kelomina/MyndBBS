export type ServiceToken<T> = string & { __brand: T };

export const token = <T>(name: string): ServiceToken<T> => name as ServiceToken<T>;

export class Container {
  private factories = new Map<ServiceToken<unknown>, () => unknown>();
  private singletons = new Map<ServiceToken<unknown>, unknown>();

  register<T>(token: ServiceToken<T>, factory: () => T): void {
    this.factories.set(token, factory);
  }

  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void {
    this.factories.set(token, () => {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, factory());
      }
      return this.singletons.get(token);
    });
  }

  resolve<T>(serviceToken: ServiceToken<T>): T {
    const factory = this.factories.get(serviceToken);
    if (!factory) throw new Error(`Service not registered: ${serviceToken}`);
    return factory() as T;
  }

  has<T>(serviceToken: ServiceToken<T>): boolean {
    return this.factories.has(serviceToken);
  }

  reset(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}

export const container = new Container();
