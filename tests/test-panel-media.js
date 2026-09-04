#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {isPanelMediaRole} from '../src/lib/panel-media.js';

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

assert(isPanelMediaRole('mediacontrols'), 'role mediacontrols');
assert(isPanelMediaRole('media-controls'), 'role media-controls');
assert(isPanelMediaRole('MediaControls'), 'role MediaControls');
assert(isPanelMediaRole('foo', 'media-controls-panel'), 'style class media-controls');
assert(isPanelMediaRole('', '', 'MediaControlsButton'), 'constructor name');
assert(!isPanelMediaRole('dateMenu'), 'date menu is not media-controls');
assert(!isPanelMediaRole('dynamic-island'), 'island is not media-controls');
assert(!isPanelMediaRole('quickSettings'), 'quick settings is not media-controls');

print(`panel-media: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
