// SPDX-License-Identifier: GPL-3.0-or-later

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ActivityStack} from './lib/activity-stack.js';
import {ClockSource, setDateMenuVisible} from './lib/clock.js';
import {ROLE} from './lib/constants.js';
import {Island} from './lib/island.js';
import {Presenter} from './lib/presenter.js';
import {BatterySource} from './lib/sources/battery.js';
import {BluetoothSource} from './lib/sources/bluetooth.js';
import {MprisSource} from './lib/sources/mpris.js';
import {NotificationSource} from './lib/sources/notifications.js';
import {OsdSource} from './lib/sources/osd.js';
import {PrivacySource} from './lib/sources/privacy.js';

export default class DynamicIslandExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._stack = new ActivityStack();
        this._clock = new ClockSource(this._settings);
        this._island = new Island(this);

        Main.panel.addToStatusArea(ROLE, this._island, 0, 'center');
        setDateMenuVisible(Main, false);

        this._presenter = new Presenter({
            island: this._island,
            stack: this._stack,
            settings: this._settings,
            clock: this._clock,
            Main,
        });

        this._sources = [];
        this._addSource(() => new NotificationSource({stack: this._stack, settings: this._settings}));
        this._addSource(() => new MprisSource({stack: this._stack, settings: this._settings}));
        this._addSource(() => new OsdSource({stack: this._stack, settings: this._settings}));
        this._addSource(() => new BatterySource({stack: this._stack, settings: this._settings}));
        this._addSource(() => new BluetoothSource({stack: this._stack, settings: this._settings}));
        this._addSource(() => new PrivacySource({stack: this._stack, settings: this._settings}));

        this._sessionId = Main.sessionMode.connect('updated', () => {
            setDateMenuVisible(Main, false);
            this._island?.forceDock();
            this._stack?.collapse();
        });
    }

    _addSource(factory) {
        try {
            this._sources.push(factory());
        } catch (error) {
            console.warn(`[dynamic-island] source failed to start: ${error.message}`);
        }
    }

    disable() {
        if (this._sessionId) {
            Main.sessionMode.disconnect(this._sessionId);
            this._sessionId = 0;
        }

        for (const source of this._sources ?? []) {
            try {
                source.destroy();
            } catch {
                // keep tearing down
            }
        }
        this._sources = [];

        this._presenter?.destroy();
        this._presenter = null;

        this._island?.destroy();
        this._island = null;

        this._clock?.destroy();
        this._clock = null;

        this._stack?.clear();
        this._stack = null;

        setDateMenuVisible(Main, true);
        if (Main.messageTray)
            Main.messageTray.bannerBlocked = false;

        this._settings = null;
    }
}
