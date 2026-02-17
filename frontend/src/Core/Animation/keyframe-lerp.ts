export interface Keyframe {
    time: number;
    value: number;
}

/**
 * Evaluate a set of keyframes at a given elapsed time.
 * Linearly interpolates between the two surrounding keyframes.
 * Clamps to the last keyframe value when elapsed exceeds the final time.
 */
export function evalKeyframes(keyframes: readonly Keyframe[], elapsed: number): number {
    const last = keyframes[keyframes.length - 1];
    const t = Math.min(elapsed, last.time);

    let i = 0;
    while (i < keyframes.length - 1 && keyframes[i + 1].time <= t) i++;

    const kf0 = keyframes[i];
    const kf1 = keyframes[Math.min(i + 1, keyframes.length - 1)];
    const seg = kf1.time - kf0.time;
    const lerp = seg > 0 ? (t - kf0.time) / seg : 1;

    return kf0.value + (kf1.value - kf0.value) * lerp;
}
