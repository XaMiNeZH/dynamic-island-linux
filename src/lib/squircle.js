// SPDX-License-Identifier: GPL-3.0-or-later

/** Superellipse exponent for expanded cards (iOS-like continuous corner). */
export const SQUIRCLE_N = 5;

export function chromePad(geom) {
    return geom?.compact === false ? 10 : 3;
}

export function chromeAllocation(geom) {
    const pad = chromePad(geom);
    return {
        pad,
        width: Math.round(geom.width + pad * 2),
        height: Math.round(geom.height + pad * 2),
    };
}

function sgn(v) {
    return v < 0 ? -1 : 1;
}

/** Point on a superellipse centered in a box. n=2 is ellipse; n≈5 is a squircle. */
export function superellipsePoint(cx, cy, rx, ry, t, n = SQUIRCLE_N) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const exp = 2 / Math.max(2, n);
    return {
        x: cx + rx * sgn(c) * Math.pow(Math.abs(c), exp),
        y: cy + ry * sgn(s) * Math.pow(Math.abs(s), exp),
    };
}

export function pointInSuperellipse(px, py, x, y, w, h, n = SQUIRCLE_N) {
    const rx = w / 2;
    const ry = h / 2;
    if (!(rx > 0) || !(ry > 0))
        return false;
    const dx = Math.abs((px - (x + rx)) / rx);
    const dy = Math.abs((py - (y + ry)) / ry);
    return Math.pow(dx, n) + Math.pow(dy, n) <= 1 + 1e-6;
}

export function pointInStadium(px, py, x, y, w, h) {
    const r = Math.max(1, h / 2);
    if (px >= x + r && px <= x + w - r && py >= y && py <= y + h)
        return true;
    const left = (px - (x + r)) ** 2 + (py - (y + r)) ** 2 <= r * r;
    const right = (px - (x + w - r)) ** 2 + (py - (y + r)) ** 2 <= r * r;
    return left || right;
}

export function pointInChrome(px, py, geom, pad = chromePad(geom)) {
    const x = pad;
    const y = pad;
    const w = geom.width;
    const h = geom.height;
    if (geom?.compact === false)
        return pointInSuperellipse(px, py, x, y, w, h, SQUIRCLE_N);
    return pointInStadium(px, py, x, y, w, h);
}

export function traceStadium(cr, x, y, w, h) {
    const r = Math.max(1, h / 2);
    cr.newSubPath();
    cr.arc(x + r, y + r, r, Math.PI / 2, 3 * Math.PI / 2);
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    cr.closePath();
}

export function traceSuperellipse(cr, x, y, w, h, n = SQUIRCLE_N, steps = 72) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    cr.newPath();
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const p = superellipsePoint(cx, cy, rx, ry, t, n);
        if (i === 0)
            cr.moveTo(p.x, p.y);
        else
            cr.lineTo(p.x, p.y);
    }
    cr.closePath();
}

export function traceChrome(cr, x, y, w, h, compact) {
    if (compact === false)
        traceSuperellipse(cr, x, y, w, h, SQUIRCLE_N);
    else
        traceStadium(cr, x, y, w, h);
}

/** Paint shape-matched shadow, fill, and a thin inner highlight. Never CSS box-shadow. */
export function paintIslandChrome(cr, allocW, allocH, geom) {
    const pad = chromePad(geom);
    const x = pad;
    const y = pad;
    const w = geom.width;
    const h = geom.height;
    const compact = geom.compact !== false;
    const rings = compact ? 3 : 8;

    cr.save();
    if (allocW > 0 && allocH > 0) {
        cr.rectangle(0, 0, allocW, allocH);
        cr.clip();
    }

    for (let i = rings; i >= 1; i--) {
        const grow = i * (compact ? 0.7 : 1.05);
        const alpha = compact ? 0.04 : 0.045;
        cr.setSourceRGBA(0, 0, 0, alpha);
        traceChrome(cr, x - grow, y - grow * 0.35, w + grow * 2, h + grow * 2, compact);
        cr.fill();
    }

    cr.setSourceRGB(0, 0, 0);
    traceChrome(cr, x, y, w, h, compact);
    cr.fill();

    cr.setSourceRGBA(1, 1, 1, compact ? 0.05 : 0.09);
    cr.setLineWidth(1);
    const inset = 0.6;
    traceChrome(cr, x + inset, y + inset, w - inset * 2, h - inset * 2, compact);
    cr.stroke();
    cr.restore();
}
