// SPDX-License-Identifier: GPL-3.0-or-later

import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {FALLBACK_PALETTE, paletteFromRgbaBytes} from './palette.js';

const GRID = 8;
const CACHE_LIMIT = 32;
const cache = new Map();

function remember(url, palette) {
    cache.set(url, palette);
    if (cache.size <= CACHE_LIMIT)
        return palette;
    const first = cache.keys().next().value;
    cache.delete(first);
    return palette;
}

function paletteFromPixbuf(pixbuf) {
    if (!pixbuf)
        return {...FALLBACK_PALETTE};
    let small = pixbuf;
    try {
        small = pixbuf.scale_simple(GRID, GRID, GdkPixbuf.InterpType.BILINEAR) || pixbuf;
    } catch {
        small = pixbuf;
    }
    try {
        return paletteFromRgbaBytes(small.get_pixels(), {
            width: small.get_width(),
            height: small.get_height(),
            nChannels: small.get_n_channels(),
            rowstride: small.get_rowstride(),
        });
    } catch {
        return {...FALLBACK_PALETTE};
    }
}

function loadFromPath(path) {
    try {
        return paletteFromPixbuf(GdkPixbuf.Pixbuf.new_from_file(path));
    } catch {
        return null;
    }
}

function loadFromBytes(bytes) {
    try {
        const payload = bytes instanceof GLib.Bytes ? bytes : GLib.Bytes.new(bytes);
        const stream = Gio.MemoryInputStream.new_from_bytes(payload);
        return paletteFromPixbuf(GdkPixbuf.Pixbuf.new_from_stream(stream, null));
    } catch {
        return {...FALLBACK_PALETTE};
    }
}

/** Sample album art into a 3-stop palette. Calls back with fallback on failure. */
export function requestPalette(url, callback) {
    const emit = palette => {
        try {
            callback(palette);
        } catch {
            // view already gone
        }
    };

    if (!url) {
        emit({...FALLBACK_PALETTE});
        return;
    }
    if (cache.has(url)) {
        emit(cache.get(url));
        return;
    }

    let file;
    try {
        file = Gio.File.new_for_uri(url);
    } catch {
        emit(remember(url, {...FALLBACK_PALETTE}));
        return;
    }

    const path = file.get_path?.();
    if (path) {
        const local = loadFromPath(path);
        if (local) {
            emit(remember(url, local));
            return;
        }
    }

    try {
        file.load_contents_async(null, (source, res) => {
            try {
                const [, contents] = source.load_contents_finish(res);
                emit(remember(url, loadFromBytes(contents)));
            } catch {
                emit(remember(url, {...FALLBACK_PALETTE}));
            }
        });
    } catch {
        emit(remember(url, {...FALLBACK_PALETTE}));
    }
}
