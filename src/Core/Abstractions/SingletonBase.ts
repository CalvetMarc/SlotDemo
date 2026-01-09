export abstract class SingletonBase<T extends SingletonBase<T>> {
  private static _instance: any;

  public static get I(): any {
    if (!(this as any)._instance) {
      (this as any)._instance = new (this as any)();
    }
    return (this as any)._instance;
  }

  protected constructor() {
    const ctor = this.constructor as any;
    if (ctor._instance)
      throw new Error(`${ctor.name} already has an instance!`);
  }
}
