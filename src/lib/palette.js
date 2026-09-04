// SPDX-License-Identifier: GPL-3.0-or-later

/** Neutral greys when there is no artwork to sample. */
export const FALLBACK_PALETTE = {
    primary: '#737373',
    secondary: '#4d4d4d',
    accent: '#999999',
};

function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return 0;
    return Math.min(1, Math.max(0, n));
}

export function rgbToHex(r, g, b) {
    const h = n => Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
    if (!match)
        return {r: 0.45, g: 0.45, b: 0.45};
    const n = parseInt(match[1], 16);
    return {
        r: ((n >> 16) & 255) / 255,
        g: ((n >> 8) & 255) / 255,
        b: (n & 255) / 255,
    };
}

export function mixHex(from, to, t) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    const k = clamp01(t);
    return rgbToHex(
        a.r + (b.r - a.r) * k,
        a.g + (b.g - a.g) * k,
        a.b + (b.b - a.b) * k);
}

function brightness(sample) {
    return (sample.r + sample.g + sample.b) / 3;
}

function saturation(sample) {
    const maxC = Math.max(sample.r, sample.g, sample.b);
    const minC = Math.min(sample.r, sample.g, sample.b);
    if (!(maxC > 0))
        return 0;
    return (maxC - minC) / maxC;
}

/** Favour colourful mid-tones over the near-black backgrounds on most covers. */
export function sampleVibrancy(sample) {
    return saturation(sample) * (1 - Math.abs(brightness(sample) - 0.55) * 1.4);
}

export function sampleDistance(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function liftHex(sample, minBrightness) {
    const current = brightness(sample);
    if (!(current > 0) || current >= minBrightness)
        return rgbToHex(sample.r, sample.g, sample.b);
    const scale = minBrightness / current;
    return rgbToHex(
        Math.min(1, sample.r * scale),
        Math.min(1, sample.g * scale),
        Math.min(1, sample.b * scale));
}

export function paletteFromSamples(samples) {
    if (!Array.isArray(samples) || !samples.length)
        return {...FALLBACK_PALETTE};

    const ranked = [...samples].sort((a, b) => sampleVibrancy(b) - sampleVibrancy(a));
    const primary = ranked[0];
    const secondary = ranked.find(s => sampleDistance(s, primary) > 0.25)
        ?? ranked[Math.min(1, ranked.length - 1)];
    const accent = ranked.find(s =>
        sampleDistance(s, primary) > 0.35 && sampleDistance(s, secondary) > 0.25)
        ?? primary;

    return {
        primary: liftHex(primary, 0.35),
        secondary: liftHex(secondary, 0.28),
        accent: liftHex(accent, 0.45),
    };
}

export function paletteFromRgbaBytes(bytes, {width, height, nChannels = 4, rowstride} = {}) {
    if (!bytes || !(width > 0) || !(height > 0))
        return {...FALLBACK_PALETTE};

    const channels = Math.max(3, nChannels);
    const stride = rowstride || width * channels;
    const samples = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * stride + x * channels;
            if (i + 2 >= bytes.length)
                continue;
            const alpha = channels > 3 ? bytes[i + 3] / 255 : 1;
            if (alpha <= 0.5)
                continue;
            samples.push({
                r: bytes[i] / 255,
                g: bytes[i + 1] / 255,
                b: bytes[i + 2] / 255,
            });
        }
    }
    return paletteFromSamples(samples);
}
