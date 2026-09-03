// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';

import {Kind} from '../activity-stack.js';
import {SourceTracker} from '../utils.js';

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';

const DBusIface = `
<node>
  <interface name="org.freedesktop.DBus">
    <method name="ListNames">
      <arg type="as" direction="out" name="names"/>
    </method>
    <signal name="NameOwnerChanged">
      <arg type="s" name="name"/>
      <arg type="s" name="old_owner"/>
      <arg type="s" name="new_owner"/>
    </signal>
  </interface>
</node>`;

const PlayerIface = `
<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="PlayPause"/>
    <method name="Next"/>
    <method name="Previous"/>
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Metadata" type="a{sv}" access="read"/>
    <property name="CanGoNext" type="b" access="read"/>
    <property name="CanGoPrevious" type="b" access="read"/>
    <property name="CanPlay" type="b" access="read"/>
  </interface>
</node>`;

const DBusProxy = Gio.DBusProxy.makeProxyWrapper(DBusIface);
const PlayerProxy = Gio.DBusProxy.makeProxyWrapper(PlayerIface);

function unpackMetadata(raw) {
    const metadata = {};
    if (!raw)
        return metadata;
    for (const key in raw) {
        try {
            metadata[key] = raw[key].deepUnpack();
        } catch {
            metadata[key] = raw[key];
        }
    }
    return metadata;
}

class Player {
    constructor(busName, onChange, onGone) {
        this.busName = busName;
        this._onChange = onChange;
        this._onGone = onGone;
        this.title = '';
        this.artist = '';
        this.artUrl = '';
        this.status = 'Stopped';
        this.canPlay = false;

        this._proxy = new PlayerProxy(
            Gio.DBus.session,
            busName,
            '/org/mpris/MediaPlayer2',
            (proxy, error) => {
                if (error) {
                    this._onGone?.(this);
                    return;
                }
                this._ready();
            });
    }

    _ready() {
        this._propId = this._proxy.connect('g-properties-changed', () => this._update());
        this._ownerId = this._proxy.connect('notify::g-name-owner', () => {
            if (!this._proxy.g_name_owner)
                this._onGone?.(this);
        });
        if (!this._proxy.g_name_owner) {
            this._onGone?.(this);
            return;
        }
        this._update();
    }

    _update() {
        const metadata = unpackMetadata(this._proxy.Metadata);
        const artists = metadata['xesam:artist'];
        this.artist = Array.isArray(artists) ? artists.filter(a => typeof a === 'string').join(', ') : '';
        this.title = typeof metadata['xesam:title'] === 'string' ? metadata['xesam:title'] : '';
        this.artUrl = typeof metadata['mpris:artUrl'] === 'string' ? metadata['mpris:artUrl'] : '';
        this.status = this._proxy.PlaybackStatus ?? 'Stopped';
        this.canPlay = !!this._proxy.CanPlay;
        this.canGoNext = !!this._proxy.CanGoNext;
        this.canGoPrevious = !!this._proxy.CanGoPrevious;
        this._onChange?.(this);
    }

    get playing() {
        return this.status === 'Playing';
    }

    playPause() {
        this._proxy.PlayPauseAsync().catch(() => {});
    }

    next() {
        this._proxy.NextAsync().catch(() => {});
    }

    previous() {
        this._proxy.PreviousAsync().catch(() => {});
    }

    destroy() {
        if (this._propId)
            this._proxy.disconnect(this._propId);
        if (this._ownerId)
            this._proxy.disconnect(this._ownerId);
        this._proxy = null;
    }
}

export class MprisSource {
    constructor({stack, settings}) {
        this._stack = stack;
        this._settings = settings;
        this._tracker = new SourceTracker();
        this._players = new Map();

        this._tracker.connect(settings, 'changed::enable-media', () => this._publish());

        this._bus = new DBusProxy(
            Gio.DBus.session,
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            (proxy, error) => {
                if (error)
                    return;
                this._onBusReady();
            });
    }

    async _onBusReady() {
        try {
            const [names] = await this._bus.ListNamesAsync();
            for (const name of names) {
                if (name.startsWith(MPRIS_PREFIX))
                    this._addPlayer(name);
            }
        } catch {
            // session bus listing failed
        }

        this._nameOwnerId = this._bus.connectSignal('NameOwnerChanged',
            (_p, _s, [name, oldOwner, newOwner]) => {
                if (!name.startsWith(MPRIS_PREFIX))
                    return;
                if (oldOwner)
                    this._removePlayer(name);
                if (newOwner)
                    this._addPlayer(name);
            });
    }

    _addPlayer(busName) {
        if (this._players.has(busName))
            return;
        const player = new Player(
            busName,
            () => this._publish(),
            gone => this._removePlayer(gone.busName));
        this._players.set(busName, player);
    }

    _removePlayer(busName) {
        const player = this._players.get(busName);
        if (!player)
            return;
        player.destroy();
        this._players.delete(busName);
        this._publish();
    }

    _active() {
        const playing = [...this._players.values()].filter(p => p.playing);
        if (playing.length)
            return playing[playing.length - 1];
        const paused = [...this._players.values()].filter(p => p.status === 'Paused' && p.title);
        return paused[paused.length - 1] ?? null;
    }

    _publish() {
        if (!this._settings.get_boolean('enable-media')) {
            this._stack.remove('media');
            return;
        }

        const player = this._active();
        if (!player || (!player.playing && player.status !== 'Paused')) {
            this._stack.remove('media');
            return;
        }

        this._stack.upsert({
            id: 'media',
            kind: Kind.MEDIA,
            persistent: true,
            payload: {
                title: player.title || player.busName.replace(MPRIS_PREFIX, ''),
                artist: player.artist,
                artUrl: player.artUrl,
                playing: player.playing,
                playPause: () => player.playPause(),
                next: () => player.next(),
                previous: () => player.previous(),
            },
        });
    }

    destroy() {
        if (this._nameOwnerId && this._bus) {
            try {
                this._bus.disconnectSignal(this._nameOwnerId);
            } catch {
                // already gone
            }
        }
        for (const player of this._players.values())
            player.destroy();
        this._players.clear();
        this._tracker.destroy();
        this._stack.remove('media');
        this._stack = null;
        this._settings = null;
        this._bus = null;
    }
}
