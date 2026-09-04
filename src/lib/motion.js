// SPDX-License-Identifier: GPL-3.0-or-later

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function lerp(from, to, t) {
    return from + (to - from) * t;
}

/** Ease-out-back. Small overshoot, Apple-like settle. */
export function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
}

export function easeOutCubic(t) {
    const p = 1 - t;
    return 1 - p * p * p;
}

/**
 * Underdamped spring from 0 → 1. Small overshoot, settles near t = 1.
 * zeta < 1; omega is in “per unit-time” (t is 0..1 over the morph).
 */
export function springProgress(t, {zeta = 0.78, omega = 14} = {}) {
    const x = Math.max(0, Number(t) || 0);
    if (zeta >= 1) {
        const a = omega;
        return 1 - (1 + a * x) * Math.exp(-a * x);
    }
    const wd = omega * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
    const e = Math.exp(-zeta * omega * x);
    return 1 - e * (Math.cos(wd * x) + (zeta * omega / wd) * Math.sin(wd * x));
}

export function springOvershoot(opts) {
    let max = 1;
    for (let i = 0; i <= 80; i++)
        max = Math.max(max, springProgress(i / 40, opts));
    return max - 1;
}

export function morphFrame(from, to, t, easing = easeOutBack) {
    const k = easing(clamp(t, 0, 1));
    return {
        width: lerp(from.width, to.width, k),
        height: lerp(from.height, to.height, k),
        radius: lerp(from.radius ?? 17, to.radius ?? 17, k),
    };
}

export function sameGeometry(a, b) {
    if (!a || !b)
        return false;
    return a.width === b.width &&
        a.height === b.height &&
        (a.radius ?? 0) === (b.radius ?? 0);
}

export function activityKey(activity) {
    return `${activity.id}:${activity.kind}:${activity.expanded ? 1 : 0}`;
}
