#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {Kind, Priority} from '../src/lib/activity-stack.js';
import {isFocusActive} from '../src/lib/focus.js';

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

assert(isFocusActive(false), 'disabled notification banners activate the focus pill');
assert(!isFocusActive(true), 'enabled notification banners do not activate focus');
assert(!isFocusActive(false, false), 'lock or greeter sessions cannot receive focus chrome');
assert(Kind.FOCUS === 'focus', 'focus has an explicit activity kind');
assert(Priority[Kind.FOCUS] > Priority[Kind.MEDIA],
    'focus remains visible ahead of ordinary media');
assert(Priority[Kind.FOCUS] < Priority[Kind.PRIVACY],
    'privacy indicators retain their higher-priority safety signal');

print(`focus: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
