#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {isControlActor, isControlTarget} from '../src/lib/control-target.js';

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

const capsule = {};
const markedVolumeButton = {
    _dynamicIslandControl: true,
    get_parent: () => capsule,
};
const volumeButton = {
    get_parent: () => capsule,
};
const volumeGlyph = {
    get_parent: () => volumeButton,
};
const classOnlyVolume = {
    has_style_class_name: name => name === 'dynamic-island-volume',
    get_parent: () => capsule,
};
const plainContent = {
    get_parent: () => capsule,
};

assert(isControlActor(markedVolumeButton, capsule),
    'the marked volume button is an island control target');
assert(isControlActor(volumeButton, capsule, actor => actor === volumeButton),
    'the volume St.Button is an island control target');
assert(isControlActor(volumeGlyph, capsule, actor => actor === volumeButton),
    'a DrawingArea child resolves to its volume button parent');
assert(isControlActor(classOnlyVolume, capsule),
    'the volume style class is an island control target');
assert(isControlTarget({get_source: () => volumeGlyph}, capsule, actor => actor === volumeButton),
    'an event from the volume glyph resolves as a control target');
assert(!isControlActor(plainContent, capsule),
    'ordinary capsule content is not a control target');

print(`control-target: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
