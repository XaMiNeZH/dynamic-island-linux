#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    fftBarLevel,
    mixBarLevel,
    setFftLevels,
    sixBandsFromSpectrum,
    unpackSpectrumMagnitudes,
} from '../src/lib/fft.js';
import {BAR_COUNT, currentBarLevel, proceduralLevel} from '../src/lib/waveform.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed += 1;
        return;
    }
    failed += 1;
    print(`FAIL: ${message}`);
}

const spectrum = [-60, -55, -40, -35, -20, -18, -25, -22, -30, -28, -50, -48];
const bands = sixBandsFromSpectrum(spectrum);
assert(bands?.length === BAR_COUNT, 'spectrum bins collapse to six bars');
assert(bands.every(n => n >= 0 && n <= 1), 'FFT bars stay normalized');
assert(bands[2] > bands[0], 'louder mid bins paint taller than quiet lows');
assert(sixBandsFromSpectrum([]) == null, 'empty spectrum yields no FFT overlay');
assert(unpackSpectrumMagnitudes([-12, -18]).length === 2, 'plain arrays unpack');

setFftLevels(null);
assert(fftBarLevel(0) == null, 'cleared FFT leaves procedural fallback');
assert(currentBarLevel(0, 0.4, {playing: true}) ===
    proceduralLevel(0, 0.4, {playing: true}),
    'missing FFT uses the procedural waveform');
assert(currentBarLevel(0, 0.4, {playing: false}) === 0, 'paused bars rest even with FFT');

setFftLevels([1, 0, 0, 0, 0, 0]);
assert(fftBarLevel(0) === 1, 'live FFT publishes the first band');
const mixed = mixBarLevel(1, 0, {playing: true, fftWeight: 0.78});
assert(mixed === 0.78, 'FFT is mixed with the procedural fallback');
assert(currentBarLevel(0, 0.4, {playing: true}) !==
    proceduralLevel(0, 0.4, {playing: true}),
    'a live FFT band changes the painted height');
setFftLevels(null);

print(`fft: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
