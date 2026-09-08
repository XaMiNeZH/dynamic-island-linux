// SPDX-License-Identifier: GPL-3.0-or-later

const BANDS = 6;

let fftLevels = null;

export function setFftLevels(levels) {
    if (!Array.isArray(levels) || levels.length < BANDS) {
        fftLevels = null;
        return;
    }
    fftLevels = levels.slice(0, BANDS).map(n => Math.max(0, Math.min(1, Number(n) || 0)));
}

export function fftBarLevel(index) {
    if (!fftLevels)
        return null;
    const value = fftLevels[index];
    return Number.isFinite(value) ? value : null;
}

export function sixBandsFromSpectrum(magnitudes, {minDb = -70, maxDb = -10, bands = BANDS} = {}) {
    const values = [...(magnitudes ?? [])].map(Number).filter(n => Number.isFinite(n));
    if (values.length < bands)
        return null;
    const out = [];
    const size = Math.max(1, Math.floor(values.length / bands));
    for (let i = 0; i < bands; i++) {
        const start = i * size;
        const end = i === bands - 1 ? values.length : start + size;
        const slice = values.slice(start, end);
        const avg = slice.reduce((sum, n) => sum + n, 0) / slice.length;
        const normalized = (avg - minDb) / Math.max(1e-6, maxDb - minDb);
        out.push(Math.max(0, Math.min(1, normalized)));
    }
    return out;
}

export function mixBarLevel(fft, procedural, {playing = true, fftWeight = 0.78} = {}) {
    if (!playing)
        return 0;
    const fallback = Math.max(0, Math.min(1, Number(procedural) || 0));
    if (fft == null || !Number.isFinite(fft))
        return fallback;
    const live = Math.max(0, Math.min(1, fft));
    const weight = Math.max(0, Math.min(1, fftWeight));
    return live * weight + fallback * (1 - weight);
}

export function unpackSpectrumMagnitudes(raw) {
    if (raw == null)
        return [];
    if (Array.isArray(raw))
        return raw.map(Number);
    try {
        if (typeof raw.deepUnpack === 'function')
            return [...raw.deepUnpack()].map(Number);
    } catch {
        // not a GVariant
    }
    try {
        if (typeof raw.length === 'number') {
            const rows = [];
            for (let i = 0; i < raw.length; i++)
                rows.push(Number(raw[i]));
            return rows;
        }
    } catch {
        // not an array-like Gst value
    }
    return [];
}

const MONITOR_NAME = /^[A-Za-z0-9._:-]+$/;

/** Pulse/PipeWire monitor only — never a raw capture source. */
export function monitorDeviceName(sinkName) {
    const name = String(sinkName ?? '').trim();
    if (!MONITOR_NAME.test(name))
        return null;
    return name.endsWith('.monitor') ? name : `${name}.monitor`;
}

export function spectrumPipelines(sinkName) {
    const monitor = monitorDeviceName(sinkName);
    if (!monitor)
        return [];
    const tail = 'audioconvert ! audio/x-raw,channels=1 ' +
        '! spectrum bands=24 interval=50000000 threshold=-80 post-messages=true ! fakesink';
    return [
        `pulsesrc device="${monitor}" ! ${tail}`,
        `pipewiresrc target-object="${monitor}" ! ${tail}`,
    ];
}

export function fftShouldRun(media) {
    return media?.payload?.playing === true;
}
