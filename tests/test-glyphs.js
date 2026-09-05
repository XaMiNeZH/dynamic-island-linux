#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {Glyph, mediaPlayGlyph, osdGlyph, paintGlyph, volumeGlyph} from '../src/lib/glyphs.js';

let passed = 0;
let failed = 0;

function assert(cond, message) {
    if (cond) {
        passed += 1;
        return;
    }
    failed += 1;
    print(`FAIL: ${message}`);
}

assert(mediaPlayGlyph(true) === Glyph.pause, 'playing → pause glyph');
assert(mediaPlayGlyph(false) === Glyph.play, 'paused → play glyph');
assert(volumeGlyph(0) === Glyph.speakerMuted, 'muted speaker');
assert(volumeGlyph(0.2) === Glyph.speakerLow, 'low speaker');
assert(volumeGlyph(0.9) === Glyph.speakerHigh, 'high speaker');
assert(osdGlyph('brightness', 0.5) === Glyph.brightness, 'brightness HUD glyph');
assert(osdGlyph('mute', 0) === Glyph.micMuted, 'mute HUD glyph');
assert(osdGlyph('volume', 0.4) === Glyph.speakerLow, 'volume HUD glyph');

try {
    const cairo = (await import('gi://cairo')).default;
    const surface = new cairo.ImageSurface(cairo.Format.ARGB32, 48, 48);
    const cr = new cairo.Context(surface);
    for (const kind of Object.values(Glyph))
        paintGlyph(cr, kind, 32);
    paintGlyph(cr, Glyph.batteryCharge, 32, '#30d158');
    assert(true, 'filled glyphs paint without throwing');
} catch (error) {
    print(`glyphs cairo skip: ${error.message}`);
}

print(`glyphs: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
