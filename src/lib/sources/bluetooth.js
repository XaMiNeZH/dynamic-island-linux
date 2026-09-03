// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';

import {Kind} from '../activity-stack.js';
import {SourceTracker} from '../utils.js';

const BLUEZ = 'org.bluez';
const OBJECT_MANAGER = 'org.freedesktop.DBus.ObjectManager';
const DEVICE_IFACE = 'org.bluez.Device1';
const PROPS_IFACE = 'org.freedesktop.DBus.Properties';

const ManagerIface = `
<node>
  <interface name="org.freedesktop.DBus.ObjectManager">
    <method name="GetManagedObjects">
      <arg type="a{oa{sa{sv}}}" direction="out" name="objects"/>
    </method>
    <signal name="InterfacesAdded">
      <arg type="o" name="object"/>
      <arg type="a{sa{sv}}" name="interfaces"/>
    </signal>
    <signal name="InterfacesRemoved">
      <arg type="o" name="object"/>
      <arg type="as" name="interfaces"/>
    </signal>
  </interface>
</node>`;

const ManagerProxy = Gio.DBusProxy.makeProxyWrapper(ManagerIface);

function unpackMaybe(variant) {
    if (variant == null)
        return undefined;
    if (typeof variant !== 'object' || typeof variant.deepUnpack !== 'function')
        return variant;
    try {
        return variant.deepUnpack();
    } catch {
        try {
            return variant.unpack();
        } catch {
            return variant;
        }
    }
}

export class BluetoothSource {
    constructor({stack, settings}) {
        this._stack = stack;
        this._settings = settings;
        this._tracker = new SourceTracker();
        this._connected = new Map();

        this._tracker.connect(settings, 'changed::enable-bluetooth', () => {
            if (!settings.get_boolean('enable-bluetooth'))
                this._stack.remove('bluetooth');
        });

        try {
            this._manager = new ManagerProxy(
                Gio.DBus.system,
                BLUEZ,
                '/',
                (proxy, error) => {
                    if (error)
                        return;
                    this._ready();
                });
        } catch {
            this._manager = null;
        }
    }

    async _ready() {
        try {
            const [objects] = await this._manager.GetManagedObjectsAsync();
            for (const [path, ifaces] of Object.entries(objects))
                this._ingest(path, ifaces);
        } catch {
            // BlueZ not running
        }

        this._addedId = this._manager.connectSignal('InterfacesAdded',
            (_p, _s, [path, ifaces]) => this._ingest(path, ifaces));

        this._propSub = this._tracker.subscribe(
            Gio.DBus.system,
            BLUEZ,
            PROPS_IFACE,
            'PropertiesChanged',
            null,
            null,
            Gio.DBusSignalFlags.NONE,
            (_conn, _sender, objectPath, _iface, _signal, params) => {
                const [iface, changed] = params.deepUnpack();
                if (iface !== DEVICE_IFACE)
                    return;
                this._onProps(objectPath, changed);
            });
    }

    _ingest(path, ifaces) {
        const device = ifaces?.[DEVICE_IFACE];
        if (!device)
            return;
        const connected = unpackMaybe(device.Connected) === true;
        const name = unpackMaybe(device.Alias) || unpackMaybe(device.Name) || 'Device';
        const known = this._connected.has(path);
        const was = this._connected.get(path) === true;
        this._connected.set(path, connected);
        if (known && connected && !was)
            this._show(name);
    }

    _onProps(path, changed) {
        if (!changed?.Connected)
            return;
        const connected = unpackMaybe(changed.Connected) === true;
        const was = this._connected.get(path) === true;
        this._connected.set(path, connected);
        if (connected && !was) {
            let name = 'Device';
            try {
                const proxy = Gio.DBusProxy.new_for_bus_sync(
                    Gio.BusType.SYSTEM,
                    Gio.DBusProxyFlags.NONE,
                    null,
                    BLUEZ,
                    path,
                    DEVICE_IFACE,
                    null);
                name = proxy.get_cached_property('Alias')?.unpack() ||
                    proxy.get_cached_property('Name')?.unpack() ||
                    name;
            } catch {
                // name unknown
            }
            this._show(name);
        }
    }

    _show(name) {
        if (!this._settings.get_boolean('enable-bluetooth'))
            return;
        this._stack.upsert({
            id: 'bluetooth',
            kind: Kind.BLUETOOTH,
            persistent: false,
            durationMs: this._settings.get_int('system-timeout'),
            payload: {name},
        });
    }

    destroy() {
        if (this._addedId && this._manager) {
            try {
                this._manager.disconnectSignal(this._addedId);
            } catch {
                // already gone
            }
        }
        this._tracker.destroy();
        this._stack.remove('bluetooth');
        this._manager = null;
        this._stack = null;
        this._settings = null;
    }
}
