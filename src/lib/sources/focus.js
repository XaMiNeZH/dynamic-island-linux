// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Kind} from '../activity-stack.js';
import {isFocusActive} from '../focus.js';
import {SourceTracker} from '../utils.js';

const NOTIFICATION_SCHEMA = 'org.gnome.desktop.notifications';

export class FocusSource {
    constructor({stack, settings}) {
        this._stack = stack;
        this._settings = settings;
        this._tracker = new SourceTracker();
        this._notificationSettings = null;

        this._tracker.connect(settings, 'changed::enable-focus', () => this._publish());
        this._tracker.connect(Main.sessionMode, 'updated', () => this._publish());
        try {
            this._notificationSettings = new Gio.Settings({schema_id: NOTIFICATION_SCHEMA});
            this._tracker.connect(this._notificationSettings, 'changed::show-banners',
                () => this._publish());
        } catch {
            // Desktop notification settings are absent: no reliable DND signal.
        }
        this._publish();
    }

    _sessionIsUsable() {
        const mode = Main.sessionMode;
        return !!mode && !mode.isGreeter && !mode.isLocked;
    }

    _publish() {
        if (!this._settings.get_boolean('enable-focus') || !this._notificationSettings) {
            this._stack.remove('focus');
            return;
        }
        let showBanners = true;
        try {
            showBanners = this._notificationSettings.get_boolean('show-banners');
        } catch {
            this._stack.remove('focus');
            return;
        }
        if (!isFocusActive(showBanners, this._sessionIsUsable())) {
            this._stack.remove('focus');
            return;
        }
        this._stack.upsert({
            id: 'focus',
            kind: Kind.FOCUS,
            persistent: true,
            payload: {},
        });
    }

    destroy() {
        this._tracker.destroy();
        this._stack.remove('focus');
        this._stack = null;
        this._settings = null;
        this._notificationSettings = null;
    }
}
