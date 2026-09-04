#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {Geometry} from '../src/lib/constants.js';
import {
    SQUIRCLE_N,
    chromeAllocation,
    chromePad,
    paintIslandChrome,
    pointInChrome,
    pointInStadium,
    pointInSuperellipse,
    superellipsePoint,
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

assert(SQUIRCLE_N === 5, 'expanded chrome uses squircle n=5');
assert(chromePad(Geometry.idle) === 3, 'compact pad is small');
assert(chromePad(Geometry.mediaExpanded) === 10, 'expanded pad leaves room for shadow');

const idleAlloc = chromeAllocation(Geometry.idle);
assert(idleAlloc.width === Geometry.idle.width + 6, 'idle actor includes pad');
assert(idleAlloc.height === Geometry.idle.height + 6, 'idle actor height includes pad');

const box = {x: 0, y: 0, w: 200, h: 100};
assert(pointInSuperellipse(100, 50, box.x, box.y, box.w, box.h), 'squircle center is inside');
assert(!pointInSuperellipse(0, 0, box.x, box.y, box.w, box.h, 5),
    'squircle sharp corner is outside');
assert(pointInStadium(10, 17, 0, 0, 88, 34), 'stadium left cap is inside');
assert(!pointInStadium(0, 0, 0, 0, 88, 34), 'stadium corner is outside');

const p = superellipsePoint(0, 0, 10, 10, 0, 5);
assert(Math.abs(p.x - 10) < 1e-6, 'superellipse at 0 is on the +x vertex');

const compact = {...Geometry.idle};
assert(pointInChrome(3 + 44, 3 + 17, compact), 'compact hit-test center');
assert(!pointInChrome(0, 0, compact), 'compact hit-test misses pad corner');

const expanded = {...Geometry.mediaExpanded};
assert(pointInChrome(10 + 260, 10 + 73, expanded), 'expanded hit-test center');
assert(!pointInChrome(10, 10, expanded), 'expanded squircle misses the box corner');

try {
    const cairo = (await import('gi://cairo')).default;
    const surface = new cairo.ImageSurface(cairo.Format.ARGB32, 80, 50);
    const cr = new cairo.Context(surface);
    paintIslandChrome(cr, 80, 50, Geometry.idle);
    paintIslandChrome(cr, 80, 50, Geometry.mediaExpanded);
    assert(true, 'chrome paint does not throw');
} catch (error) {
    print(`squircle cairo skip: ${error.message}`);
}

print(`squircle: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
