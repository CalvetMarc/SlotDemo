export abstract class SingletonBase {
  protected static _instance: unknown;

  protected constructor() {
    const ctor = this.constructor as typeof SingletonBase;
    if ((ctor as any)._instance) {
      throw new Error(`${ctor.name} already has an instance`);
    }
  }

  protected static getInstance<T>(this: new () => T): T {
    if (!(this as any)._instance) {
      (this as any)._instance = new this();
    }
    return (this as any)._instance;
  }
}
