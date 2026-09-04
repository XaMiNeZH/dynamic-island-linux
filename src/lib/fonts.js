// SPDX-License-Identifier: GPL-3.0-or-later

const FONT_FILES = ['Inter-Regular.ttf', 'Inter-SemiBold.ttf'];

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
        // CSS @font-face and system Inter still apply
    }
}
