export type EaseFn = (t: number) => number;

export const linear: EaseFn = (t) => t;

export const easeOutQuad: EaseFn = (t) => 1 - (1 - t) * (1 - t);

export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);

export const easeOutQuartic: EaseFn = (t) => {
    const inv = 1 - t;
    return 1 - inv * inv * inv * inv;
};

export const easeInCubic: EaseFn = (t) => t * t * t;

export const easeInOutCubic: EaseFn = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutElastic: EaseFn = (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

export const easeOutBounce: EaseFn = (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
};
