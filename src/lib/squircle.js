// SPDX-License-Identifier: GPL-3.0-or-later

export function chromePad(geom) {
    // The chrome is painted exactly into its allocation. Extra padding was
    // previously reserved for painted shadow rings, which showed as a halo.
    return 0;
}

export function chromeAllocation(geom) {
    const pad = chromePad(geom);
    return {
        pad,
        width: Math.round(geom.width + pad * 2),
        height: Math.round(geom.height + pad * 2),
    };
}

export function pointInRoundedRect(px, py, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(Number(radius) || 0, w / 2, h / 2));
    if (px < x || px > x + w || py < y || py > y + h)
        return false;
    if (r === 0 || (px >= x + r && px <= x + w - r) ||
        (py >= y + r && py <= y + h - r))
        return true;
    const cx = px < x + r ? x + r : x + w - r;
    const cy = py < y + r ? y + r : y + h - r;
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

export function pointInChrome(px, py, geom, pad = chromePad(geom)) {
    const x = pad;
    const y = pad;
    const w = geom.width;
    const h = geom.height;
    const radius = geom?.compact === false
        ? (geom.radius ?? 22)
        : Math.min(w, h) / 2;
    return pointInRoundedRect(px, py, x, y, w, h, radius);
}

export function traceRoundedRect(cr, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(Number(radius) || 0, w / 2, h / 2));
    cr.newSubPath();
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    cr.closePath();
}

export function traceChrome(cr, x, y, w, h, compact, radius = null) {
    const resolvedRadius = compact === false
        ? (radius ?? 22)
        : Math.min(w, h) / 2;
    traceRoundedRect(cr, x, y, w, h, resolvedRadius);
}

/** Paint only the black rounded chrome — no shadow, glow, or halo. */
export function paintIslandChrome(cr, allocW, allocH, geom) {
    const pad = chromePad(geom);
    const x = pad;
    const y = pad;
    const w = geom.width;
    const h = geom.height;
    const compact = geom.compact !== false;

    cr.save();
    if (allocW > 0 && allocH > 0) {
        cr.rectangle(0, 0, allocW, allocH);
        cr.clip();
    }

    cr.setSourceRGB(0, 0, 0);
    traceChrome(cr, x, y, w, h, compact, geom.radius);
    cr.fill();
    cr.restore();
}
