export interface TransformConfig {
    position?: { x?: number; y?: number };
    scale?: { x?: number; y?: number };
    rotation?: number;
}

export class Transform {
    readonly x: number;
    readonly y: number;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly rotation: number;

    constructor(config?: TransformConfig) {
        this.x = config?.position?.x ?? 0;
        this.y = config?.position?.y ?? 0;

        this.scaleX = config?.scale?.x ?? 1;
        this.scaleY = config?.scale?.y ?? 1;

        this.rotation = config?.rotation ?? 0;
    }

    applyTo(target: {
        position: { set(x: number, y: number): void };
        scale: { set(x: number, y: number): void };
        rotation: number;
    }) {
        target.position.set(this.x, this.y);
        target.scale.set(this.scaleX, this.scaleY);
        target.rotation = this.rotation;
    }
}
