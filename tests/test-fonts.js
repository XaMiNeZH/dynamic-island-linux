#!/usr/bin/env gjs
// SPDX-License-Identifier: GPL-3.0-or-later

import {
    FALLBACK_FAMILY,
    islandType,
    pickFamily,
    resolveIslandFonts,
    typeCss,
    typeStack,
} from '../src/lib/fonts.js';

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

assert(pickFamily([], ['SF Pro Display'], 'Inter') === 'Inter', 'empty list uses fallback');
assert(pickFamily(['Inter', 'SF Pro Display'], ['SF Pro Display']) === 'SF Pro Display',
    'exact SF Pro Display');
assert(pickFamily(['SFProDisplay', 'Inter'], ['SF Pro Display', 'SFProDisplay']) === 'SFProDisplay',
    'Linux SFProDisplay alias');
assert(pickFamily(['.SF NS Display'], ['SF Pro Display', '.SF NS Display']) === '.SF NS Display',
    'hidden SF NS Display alias');
assert(pickFamily(['SF Pro'], ['SF Pro Display', 'SF Pro']) === 'SF Pro',
    'generic SF Pro matches');

const resolved = resolveIslandFonts(['Inter', 'SFProText', 'SFProDisplay']);
assert(resolved.display === 'SFProDisplay', `display ${resolved.display}`);
assert(resolved.text === 'SFProText', `text ${resolved.text}`);

const textOnly = resolveIslandFonts(['SF Pro Text', 'Adwaita Sans']);
assert(textOnly.display === 'SF Pro Text' || textOnly.display === FALLBACK_FAMILY,
    'display can fall back through text aliases');
assert(textOnly.text === 'SF Pro Text', 'text family from SF Pro Text');

const none = resolveIslandFonts(['Adwaita Sans', 'Cantarell']);
assert(none.display === FALLBACK_FAMILY, 'no SF → Inter display');
assert(none.text === FALLBACK_FAMILY, 'no SF → Inter text');

const prev = {...islandType};
islandType.display = 'SF Pro Display';
islandType.text = 'SF Pro Text';
assert(typeStack('display').includes('"SF Pro Display"'), 'display stack quotes SF Pro Display');
assert(typeCss('text').includes('"SF Pro Text"'), 'text CSS quotes SF Pro Text');
assert(!typeCss('text').includes('SF Pro Display'), 'text optical size is not Display');
islandType.display = prev.display;
islandType.text = prev.text;

print(`fonts: ${passed} passed, ${failed} failed`);
if (failed)
    throw new Error(`${failed} assertion(s) failed`);
