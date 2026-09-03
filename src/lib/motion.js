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
