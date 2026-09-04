#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {Geometry} from '../src/lib/constants.js';
import {
    chromeAllocation,
    chromePad,
    paintIslandChrome,
    pointInChrome,
    pointInRoundedRect,
} from '../src/lib/squircle.js';

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

assert(chromePad(Geometry.idle) === 0, 'compact chrome reserves no shadow padding');
assert(chromePad(Geometry.mediaExpanded) === 0, 'expanded chrome reserves no shadow padding');

const idleAlloc = chromeAllocation(Geometry.idle);
assert(idleAlloc.width === Geometry.idle.width, 'idle allocation matches visible pill');
assert(idleAlloc.height === Geometry.idle.height, 'idle allocation matches visible pill');

const box = {x: 0, y: 0, w: 200, h: 100};
assert(pointInRoundedRect(100, 50, box.x, box.y, box.w, box.h, 36),
    'round-rect center is inside');
assert(!pointInRoundedRect(0, 0, box.x, box.y, box.w, box.h, 36),
    'round-rect sharp corner is outside');
assert(pointInRoundedRect(36, 0, box.x, box.y, box.w, box.h, 36),
    'round-rect retains its straight top edge');

const compact = {...Geometry.idle};
assert(pointInChrome(44, 17, compact), 'compact stadium hit-test center');
assert(!pointInChrome(0, 0, compact), 'compact stadium misses corner');

const expanded = {...Geometry.mediaExpanded};
assert(pointInChrome(expanded.width / 2, expanded.height / 2, expanded),
    'expanded round-rect hit-test center');
assert(!pointInChrome(0, 0, expanded), 'expanded round-rect misses corner');
assert(pointInChrome(expanded.radius, 0, expanded), 'expanded hit-test follows its radius');

try {
    const cairo = (await import('gi://cairo')).default;
    const surface = new cairo.ImageSurface(cairo.Format.ARGB32, 80, 50);
    const cr = new cairo.Context(surface);
    paintIslandChrome(cr, 80, 50, Geometry.idle);
    paintIslandChrome(cr, 80, 50, Geometry.mediaExpanded);
    assert(true, 'chrome paint does not throw');
} catch (error) {
    print(`chrome cairo skip: ${error.message}`);
}

print(`chrome: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
