#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';

import {formatClock, classifyOsd} from '../src/lib/utils.js';

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

const dt = GLib.DateTime.new_from_iso8601('2026-09-03T18:05:09+00:00', null);
const h24 = formatClock(dt, {use24h: true, showSeconds: false});
const h24s = formatClock(dt, {use24h: true, showSeconds: true});
assert(/^\d{2}:\d{2}$/.test(h24), `24h clock ${h24}`);
assert(/^\d{2}:\d{2}:\d{2}$/.test(h24s), `24h+seconds ${h24s}`);

const h12 = formatClock(dt, {use24h: false, showSeconds: false});
assert(!h12.startsWith(' '), `12h has no leading space: "${h12}"`);
assert(/AM|PM/i.test(h12), `12h includes meridiem: ${h12}`);

assert(classifyOsd({names: ['display-brightness-symbolic']}, '') === 'brightness', 'brightness icon');
assert(classifyOsd({names: ['audio-volume-high-symbolic']}, 'Volume') === 'volume', 'volume icon');
assert(classifyOsd({iconName: 'microphone-sensitivity-muted-symbolic'}, 'Microphone') === 'mute', 'mic icon');

print(`clock-format: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
