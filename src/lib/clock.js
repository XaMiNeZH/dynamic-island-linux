// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {SourceTracker, formatClock} from './utils.js';

export class ClockSource {
    constructor(settings) {
        this._settings = settings;
        this._tracker = new SourceTracker();
        this._listeners = new Set();
        this._text = '';
        this._intervalId = 0;

        try {
            this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
            this._tracker.connect(this._interface, 'changed::clock-format', () => this._tick());
            this._tracker.connect(this._interface, 'changed::clock-show-seconds', () => this.restart());
        } catch {
            this._interface = null;
        }

        this._tracker.connect(settings, 'changed::show-seconds', () => this.restart());
        this._tracker.connect(settings, 'changed::clock-format', () => this.restart());

        this.restart();
    }

    onTick(fn) {
        this._listeners.add(fn);
        fn(this._text);
        return () => this._listeners.delete(fn);
    }

    get text() {
        return this._text;
    }

    _use24h() {
        const mode = this._settings.get_string('clock-format');
        if (mode === '24h')
            return true;
        if (mode === '12h')
            return false;
        try {
            return this._interface?.get_string('clock-format') !== '12h';
        } catch {
            return true;
        }
    }

    _showSeconds() {
        if (this._settings.get_boolean('show-seconds'))
            return true;
        try {
            return this._interface?.get_boolean('clock-show-seconds') === true;
        } catch {
            return false;
        }
    }

    _tick() {
        const dt = GLib.DateTime.new_now_local();
        const text = formatClock(dt, {
            use24h: this._use24h(),
            showSeconds: this._showSeconds(),
        });
        if (text === this._text)
            return;
        this._text = text;
        for (const fn of this._listeners)
            fn(text);
    }

    restart() {
        if (this._intervalId) {
            this._tracker.timeoutRemove(this._intervalId);
            this._intervalId = 0;
        }
        this._tick();
        const ms = this._showSeconds() ? 1000 : 5000;
        this._intervalId = this._tracker.timeoutAdd(ms, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    destroy() {
        this._listeners.clear();
        this._tracker.destroy();
        this._interface = null;
        this._settings = null;
    }
}

export function setDateMenuVisible(Main, visible) {
    const container = Main?.panel?.statusArea?.dateMenu?.container;
    if (!container)
        return;
    if (visible)
        container.show();
    else if (container.visible)
        container.hide();
}

export function openDateMenu(Main) {
    const dateMenu = Main?.panel?.statusArea?.dateMenu;
    if (!dateMenu?.menu)
        return;
    try {
        dateMenu.menu.open();
    } catch {
        // menu not available in this session mode
    }
}
