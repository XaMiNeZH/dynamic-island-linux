// SPDX-License-Identifier: GPL-3.0-or-later

/** Six center-growing pills, silence = a row of dots. */
export const BAR_COUNT = 6;
export const BAR_THICKNESS = 3;
export const DOT_HEIGHT = 3;

const FREQUENCIES = [0.95, 1.33, 0.78, 1.55, 1.10, 0.68];
const PHASES = [0.15, 1.05, 1.72, 0.52, 2.18, 1.41];

export function proceduralLevel(index, seconds, {playing = true} = {}) {
    if (!playing)
        return 0;
    const frequency = FREQUENCIES[index % FREQUENCIES.length];
    const phase = PHASES[index % PHASES.length];
    const wave = Math.sin(Number(seconds) * frequency * 3.05 + phase);
    return 0.16 + (wave + 1) / 2 * 0.74;
}

export function proceduralLevels(seconds, options = {}) {
    const count = options.bars ?? BAR_COUNT;
    const levels = [];
    for (let i = 0; i < count; i++)
        levels.push(proceduralLevel(i, seconds, options));
    return levels;
}

export function barHeightPx(level, stripHeight, dotHeight = DOT_HEIGHT) {
    const height = Math.max(0, Number(stripHeight) || 0);
    const n = Math.min(1, Math.max(0, Number(level) || 0));
    return Math.max(dotHeight, Math.round(height * n));
}
