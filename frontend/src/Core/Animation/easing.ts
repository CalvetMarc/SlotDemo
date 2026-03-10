export type EaseFn = (t: number) => number;

export const linear: EaseFn = (t) => t;

export const easeOutQuad: EaseFn = (t) => 1 - (1 - t) * (1 - t);

export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);

export const easeOutQuartic: EaseFn = (t) => {
    const inv = 1 - t;
    return 1 - inv * inv * inv * inv;
};

export const easeInCubic: EaseFn = (t) => t * t * t;

export const easeOutElastic: EaseFn = (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

