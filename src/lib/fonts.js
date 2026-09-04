// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';
import Pango from 'gi://Pango';

const FONT_FILES = ['Inter-Regular.ttf', 'Inter-SemiBold.ttf'];

export const FALLBACK_FAMILY = 'Inter';

const DISPLAY_ALIASES = [
    'SF Pro Display',
    'SFProDisplay',
    'SF Pro Display Regular',
    '.SF NS Display',
    'SFNS Display',
    'SF Pro',
    'SFPro',
];

const TEXT_ALIASES = [
    'SF Pro Text',
    'SFProText',
    'SF Pro Text Regular',
    '.SF NS Text',
    'SFNS Text',
    'SF Pro',
    'SFPro',
    'SF Pro Display',
    'SFProDisplay',
];

/** Last resolved families. Views read this after registerIslandFonts(). */
export const islandType = {
    display: FALLBACK_FAMILY,
    text: FALLBACK_FAMILY,
};

function normalize(name) {
    return String(name ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

export function pickFamily(available, aliases, fallback = FALLBACK_FAMILY) {
    const list = Array.isArray(available) ? available.filter(Boolean) : [];
    const byNorm = new Map(list.map(name => [normalize(name), name]));
    for (const alias of aliases) {
        const hit = byNorm.get(normalize(alias));
        if (hit)
            return hit;
    }
    for (const alias of aliases) {
        const needle = normalize(alias);
        for (const name of list) {
            if (normalize(name).includes(needle) || needle.includes(normalize(name)))
                return name;
        }
    }
    return fallback;
}

export function resolveIslandFonts(availableFamilies) {
    const display = pickFamily(availableFamilies, DISPLAY_ALIASES, FALLBACK_FAMILY);
    const text = pickFamily(availableFamilies, TEXT_ALIASES, display);
    return {display, text};
}

function namesFromFontMap(map) {
    return (map?.list_families?.() ?? []).map(f => f.get_name()).filter(Boolean);
}

function listFcListFamilies() {
    try {
        const [ok, stdout] = GLib.spawn_command_line_sync('fc-list : family');
        if (!ok || !stdout)
            return [];
        const text = new TextDecoder().decode(stdout);
        const names = [];
        for (const line of text.split('\n')) {
            for (const part of line.split(',')) {
                const name = part.trim();
                if (name)
                    names.push(name);
            }
        }
        return names;
    } catch {
        return [];
    }
}

export function listSystemFamilies() {
    const seen = new Set();
    const names = [];
    const add = list => {
        for (const name of list ?? []) {
            const key = normalize(name);
            if (!key || seen.has(key))
                continue;
            seen.add(key);
            names.push(name);
        }
    };

    try {
        add(namesFromFontMap(Pango.FontMap.get_default()));
    } catch {
        // FontMap.get_default is missing on some Pango builds
    }

    if (!names.length) {
        try {
            add(namesFromFontMap(globalThis.imports?.gi?.PangoCairo?.font_map_get_default?.()));
        } catch {
            // PangoCairo typelib not loaded
        }
    }

    add(listFcListFamilies());
    return names;
}

export function typeStack(optical = 'display') {
    const family = optical === 'text' ? islandType.text : islandType.display;
    const quoted = family.includes(' ') ? `"${family}"` : family;
    return `${quoted}, Inter, "Adwaita Sans", sans-serif`;
}

export function typeCss(optical = 'display') {
    return `font-family: ${typeStack(optical)};`;
}

function addFontconfigFile(path) {
    let lib = null;
    try {
        const ctypes = globalThis.imports?.ctypes;
        if (!ctypes)
            return false;
        lib = ctypes.open('libfontconfig.so.1');
        const FcConfigAppFontAddFile = lib.declare(
            'FcConfigAppFontAddFile',
            ctypes.default_abi,
            ctypes.int,
            ctypes.voidptr_t,
            ctypes.char.ptr);
        const cpath = ctypes.char.array()(path);
        return FcConfigAppFontAddFile(null, cpath) === 1;
    } catch {
        return false;
    } finally {
        try {
            lib?.close?.();
        } catch {
            // mapping stays if close is unsupported
        }
    }
}

export function registerIslandFonts(extensionDir) {
    try {
        const dir = extensionDir.get_child('fonts');
        for (const name of FONT_FILES) {
            const file = dir.get_child(name);
            if (!file.query_exists(null))
                continue;
            const path = file.get_path();
            if (path)
                addFontconfigFile(path);
        }
    } catch {
        // CSS @font-face still applies
    }

    const resolved = resolveIslandFonts(listSystemFamilies());
    islandType.display = resolved.display;
    islandType.text = resolved.text;
}
