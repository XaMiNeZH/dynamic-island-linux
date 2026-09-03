// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';

import {Kind} from '../activity-stack.js';
import {SourceTracker} from '../utils.js';

const UPOWER_NAME = 'org.freedesktop.UPower';
const DISPLAY_PATH = '/org/freedesktop/UPower/devices/DisplayDevice';
const DEVICE_IFACE = 'org.freedesktop.UPower.Device';

const STATE_CHARGING = 1;
const STATE_FULLY_CHARGED = 4;

export class BatterySource {
    constructor({stack, settings}) {
        this._stack = stack;
        this._settings = settings;
        this._tracker = new SourceTracker();
        this._state = null;
        this._percent = 0;
        this._present = false;

        this._tracker.connect(settings, 'changed::enable-battery', () => {
            if (!settings.get_boolean('enable-battery'))
                this._stack.remove('charging');
        });

        try {
            this._proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.NONE,
                null,
                UPOWER_NAME,
                DISPLAY_PATH,
                DEVICE_IFACE,
                null);
            this._read();
            this._tracker.connect(this._proxy, 'g-properties-changed', () => this._onChange());
        } catch {
            this._proxy = null;
        }
    }

    _read() {
        if (!this._proxy)
            return;
        try {
            this._state = this._proxy.get_cached_property('State')?.unpack() ?? this._state;
            this._percent = this._proxy.get_cached_property('Percentage')?.unpack() ?? this._percent;
            this._present = this._proxy.get_cached_property('IsPresent')?.unpack() ?? this._present;
        } catch {
            // UPower not available
        }
    }

    _onChange() {
        const prev = this._state;
        this._read();
        if (!this._settings.get_boolean('enable-battery'))
            return;
        if (!this._present)
            return;

        const plugged = this._state === STATE_CHARGING || this._state === STATE_FULLY_CHARGED;
        const wasPlugged = prev === STATE_CHARGING || prev === STATE_FULLY_CHARGED;
        if (prev != null && plugged && !wasPlugged)
            this._show();
        else if (this._state === STATE_CHARGING && prev !== STATE_CHARGING)
            this._show();
    }

    _show() {
        this._stack.upsert({
            id: 'charging',
            kind: Kind.CHARGING,
            persistent: false,
            durationMs: this._settings.get_int('system-timeout'),
            payload: {
                percent: this._percent,
                charging: this._state === STATE_CHARGING || this._state === STATE_FULLY_CHARGED,
            },
        });
    }

    destroy() {
        this._tracker.destroy();
        this._stack.remove('charging');
        this._proxy = null;
        this._stack = null;
        this._settings = null;
    }
}
