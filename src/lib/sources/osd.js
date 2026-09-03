// SPDX-License-Identifier: GPL-3.0-or-later

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Kind} from '../activity-stack.js';
import {classifyOsd, themedIconName} from '../utils.js';

export class OsdSource {
    constructor({stack, settings}) {
        this._stack = stack;
        this._settings = settings;
        this._mgr = Main.osdWindowManager;
        this._patched = false;

        if (!this._mgr)
            return;

        this._orig = {
            show: this._mgr.show.bind(this._mgr),
            showOne: this._mgr.showOne?.bind(this._mgr),
            showAll: this._mgr.showAll?.bind(this._mgr),
        };

        this._onSettings = settings.connect('changed', () => this._syncPatch());
        this._syncPatch();
    }

    _enabled() {
        return this._settings.get_boolean('enable-osd') &&
            this._settings.get_boolean('takeover-osd');
    }

    _syncPatch() {
        if (this._enabled())
            this._patch();
        else
            this._unpatch();
    }

    _patch() {
        if (this._patched || !this._mgr)
            return;

        this._mgr.show = (...args) => this._onShow(...args);
        if (this._mgr.showOne) {
            this._mgr.showOne = (monitorIndex, icon, label, level, maxLevel) => {
                this._emit(icon, label, level, maxLevel);
            };
        }
        if (this._mgr.showAll) {
            this._mgr.showAll = (icon, label, level, maxLevel) => {
                this._emit(icon, label, level, maxLevel);
            };
        }
        this._patched = true;
        try {
            this._mgr.hideAll?.();
        } catch {
            // nothing visible
        }
    }

    _onShow(...args) {
        // GNOME 49+: show(icon, label, levels)
        // Older:     show(monitorIndex, icon, label, level, maxLevel)
        if (args.length >= 3 && args[2] && typeof args[2] === 'object' && !args[2].get_names) {
            const [icon, label, levels] = args;
            const primary = Main.layoutManager.primaryIndex ?? 0;
            const entry = levels?.[primary] ?? Object.values(levels ?? {})[0] ?? {};
            this._emit(icon, label, entry.level, entry.maxLevel);
            return;
        }
        const icon = args[1];
        const label = args[2];
        const level = args[3];
        const maxLevel = args[4];
        this._emit(icon, label, level, maxLevel);
    }

    _emit(icon, label, level, maxLevel) {
        if (!this._settings.get_boolean('enable-osd')) {
            this._orig.showAll?.(icon, label, level, maxLevel);
            return;
        }

        const kindName = classifyOsd(icon, label);
        const kind = kindName === 'brightness'
            ? Kind.BRIGHTNESS
            : kindName === 'mute'
                ? Kind.MUTE
                : Kind.VOLUME;

        let normalized = level;
        if (normalized != null) {
            const max = maxLevel && maxLevel > 0 ? maxLevel : 1;
            normalized = Math.max(0, Math.min(1, normalized / max));
        }

        this._stack.upsert({
            id: `osd-${kind}`,
            kind,
            persistent: false,
            durationMs: this._settings.get_int('osd-timeout'),
            payload: {
                iconName: themedIconName(icon),
                label: label ?? '',
                level: normalized,
                kind,
            },
        });
    }

    _unpatch() {
        if (!this._patched || !this._mgr)
            return;
        this._mgr.show = this._orig.show;
        if (this._orig.showOne)
            this._mgr.showOne = this._orig.showOne;
        if (this._orig.showAll)
            this._mgr.showAll = this._orig.showAll;
        this._patched = false;
    }

    destroy() {
        if (this._onSettings && this._settings)
            this._settings.disconnect(this._onSettings);
        this._unpatch();
        this._stack.remove('osd-volume');
        this._stack.remove('osd-brightness');
        this._stack.remove('osd-mute');
        this._stack = null;
        this._settings = null;
        this._mgr = null;
    }
}
