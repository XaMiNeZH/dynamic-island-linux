// SPDX-License-Identifier: GPL-3.0-or-later

import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Kind} from '../activity-stack.js';
import {SourceTracker} from '../utils.js';

export class NotificationSource {
    constructor({stack, settings}) {
        this._stack = stack;
        this._settings = settings;
        this._tracker = new SourceTracker();
        this._sourceIds = new Map();
        this._seen = new WeakSet();

        const tray = Main.messageTray;
        if (!tray)
            return;

        this._applyBannerBlock();
        this._tracker.connect(settings, 'changed::suppress-banners', () => this._applyBannerBlock());
        this._tracker.connect(settings, 'changed::enable-notifications', () => {
            if (!settings.get_boolean('enable-notifications'))
                this._stack.remove('notification');
        });

        this._tracker.connect(tray, 'source-added', (_t, source) => this._watchSource(source));
        this._tracker.connect(tray, 'source-removed', (_t, source) => this._unwatchSource(source));

        for (const source of tray.getSources?.() ?? [])
            this._watchSource(source);
    }

    _applyBannerBlock() {
        if (!Main.messageTray)
            return;
        Main.messageTray.bannerBlocked =
            this._settings.get_boolean('suppress-banners') &&
            this._settings.get_boolean('enable-notifications');
    }

    _watchSource(source) {
        if (!source || this._sourceIds.has(source))
            return;

        const ids = [];
        const handler = (_s, notification) => this._onNotification(notification);

        if (GObject.signal_lookup('notification-request-banner', source.constructor.$gtype))
            ids.push(source.connect('notification-request-banner', handler));
        else if (GObject.signal_lookup('notification-added', source.constructor.$gtype))
            ids.push(source.connect('notification-added', handler));

        if (GObject.signal_lookup('notification-removed', source.constructor.$gtype)) {
            ids.push(source.connect('notification-removed', (_s, notification) => {
                if (this._stack.get('notification')?.payload?.notification === notification)
                    this._stack.remove('notification');
            }));
        }

        this._sourceIds.set(source, ids);
    }

    _unwatchSource(source) {
        const ids = this._sourceIds.get(source);
        if (!ids)
            return;
        for (const id of ids) {
            try {
                source.disconnect(id);
            } catch {
                // source disposed
            }
        }
        this._sourceIds.delete(source);
    }

    _onNotification(notification) {
        if (!this._settings.get_boolean('enable-notifications'))
            return;
        if (!notification || this._seen.has(notification))
            return;

        this._seen.add(notification);
        if (notification.forFeedback)
            return;

        const timeout = this._settings.get_int('notification-timeout');
        this._stack.upsert({
            id: 'notification',
            kind: Kind.NOTIFICATION,
            persistent: false,
            durationMs: timeout,
            payload: {
                title: notification.title ?? notification.source?.title ?? '',
                body: notification.body ?? '',
                gicon: notification.gicon ?? notification.source?.icon ?? null,
                iconName: notification.iconName,
                notification,
                activate: () => {
                    try {
                        notification.activate();
                    } catch {
                        try {
                            notification.source?.open?.();
                        } catch {
                            // nothing to activate
                        }
                    }
                },
            },
        });
    }

    destroy() {
        for (const source of [...this._sourceIds.keys()])
            this._unwatchSource(source);
        this._tracker.destroy();
        if (Main.messageTray)
            Main.messageTray.bannerBlocked = false;
        this._stack = null;
        this._settings = null;
    }
}
