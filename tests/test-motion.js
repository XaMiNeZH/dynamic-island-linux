#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {clamp, lerp, easeOutBack, easeOutCubic, morphFrame, sameGeometry} from '../src/lib/motion.js';
import {geometryFor, Geometry} from '../src/lib/constants.js';

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

assert(clamp(5, 0, 3) === 3, 'clamp high');
assert(clamp(-1, 0, 3) === 0, 'clamp low');
assert(lerp(0, 10, 0.5) === 5, 'lerp midpoint');
assert(easeOutCubic(0) === 0, 'cubic start');
assert(easeOutCubic(1) === 1, 'cubic end');
assert(Math.abs(easeOutBack(1) - 1) < 1e-9, 'back end');
assert(easeOutBack(0.8) > 1, 'back overshoots before settle');

const mid = morphFrame(Geometry.idle, Geometry.notification, 0.5);
assert(mid.width > Geometry.idle.width, 'morph grows width');
assert(mid.width < Geometry.notification.width * 1.2, 'morph stays bounded');

assert(sameGeometry(Geometry.idle, {...Geometry.idle}), 'sameGeometry true');
assert(!sameGeometry(Geometry.idle, Geometry.osd), 'sameGeometry false');

assert(geometryFor('idle').width === Geometry.idle.width, 'idle geom');
assert(geometryFor('media', false).width === Geometry.compact.width, 'media compact');
assert(geometryFor('media', true).width === Geometry.mediaExpanded.width, 'media expanded');
assert(geometryFor('notification').overlay === true, 'notification overlays');
assert(geometryFor('volume').overlay === false, 'osd stays in panel');

print(`motion: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
