#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    outputVolumeFraction,
    outputVolumeRaw,
    selectVolumeControl,
} from '../src/lib/sources/output-volume.js';

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

assert(outputVolumeFraction(32768, 65536) === 0.5, 'normal sink volume becomes a fraction');
assert(outputVolumeFraction(65536, 65536, true) === 0, 'muted sink uses muted glyph level');
assert(outputVolumeRaw(0.25, 65536) === 16384, 'fraction converts to Gvc volume');
assert(outputVolumeRaw(1.5, 65536) === 65536, 'output volume never amplifies above normal');

let desktopSet = null;
let playerSet = null;
const desktop = {available: true, volume: 0.7, setVolume: n => (desktopSet = n)};
const player = {hasVolume: true, volume: 0.2, setVolume: n => (playerSet = n)};
const desktopControl = selectVolumeControl(desktop, player);
assert(desktopControl.hasVolume && desktopControl.volume === 0.7,
    'desktop output wins over per-player MPRIS volume');
desktopControl.setVolume(0.4);
assert(desktopSet === 0.4 && playerSet === null, 'speaker writes GNOME output');

const playerControl = selectVolumeControl(null, player);
playerControl.setVolume(0.3);
assert(playerControl.hasVolume && playerSet === 0.3, 'MPRIS remains a fallback');
assert(!selectVolumeControl(null, null).hasVolume, 'no capability hides the control');

print(`output-volume: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
