// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Kind} from '../activity-stack.js';
import {SourceTracker} from '../utils.js';

export class PrivacySource {
    constructor({stack, settings}) {
        this._stack = stack;
        this._settings = settings;
        this._tracker = new SourceTracker();
        this._mic = false;
        this._camera = false;
        this._recording = false;
        this._seconds = 0;
        this._tickId = 0;

        this._tracker.connect(settings, 'changed::enable-privacy', () => {
            if (!settings.get_boolean('enable-privacy')) {
                this._stack.remove('privacy');
                this._stack.remove('recording');
            } else {
                this._publish();
            }
        });

        this._destroyed = false;
        this._watchRecording();
        this._watchMixer();
    }

    _watchRecording() {
        if (Main.screenshotUI) {
            this._tracker.connect(Main.screenshotUI, 'notify::screencast-in-progress', () => {
                this._recording = !!Main.screenshotUI.screencast_in_progress;
                if (this._recording)
                    this._startTick();
                else
                    this._stopTick();
                this._publish();
            });
            this._recording = !!Main.screenshotUI.screencast_in_progress;
        }

        try {
            const controller = global.backend.get_remote_access_controller?.();
            if (!controller)
                return;
            this._handles = new Set();
            this._tracker.connect(controller, 'new-handle', (_c, handle) => {
                const recording = handle.is_recording ?? handle.isRecording;
                if (!recording)
                    return;
                this._handles.add(handle);
                handle.connect('stopped', () => {
                    this._handles.delete(handle);
                    this._recording = this._handles.size > 0 || !!Main.screenshotUI?.screencast_in_progress;
                    if (!this._recording)
                        this._stopTick();
                    this._publish();
                });
                this._recording = true;
                this._startTick();
                this._publish();
            });
        } catch {
            // remote access API not present
        }
    }

    _watchMixer() {
        import('gi://Gvc').then(mod => {
            if (this._destroyed)
                return;
            const Gvc = mod.default;
            if (!Gvc?.MixerControl)
                return;
            this._mixer = new Gvc.MixerControl({name: 'dynamic-island-privacy'});
            this._mixer.open();
            const sync = () => {
                let count = 0;
                try {
                    const outputs = this._mixer.get_source_outputs?.() ?? [];
                    count = outputs.length ?? 0;
                } catch {
                    count = 0;
                }
                const next = count > 0;
                if (next === this._mic)
                    return;
                this._mic = next;
                this._publish();
            };
            this._tracker.connect(this._mixer, 'stream-added', sync);
            this._tracker.connect(this._mixer, 'stream-removed', sync);
            this._tracker.connect(this._mixer, 'state-changed', sync);
        }).catch(() => {
            this._mixer = null;
        });
    }

    _startTick() {
        if (this._tickId)
            return;
        this._seconds = 0;
        this._tickId = this._tracker.timeoutAdd(1000, () => {
            this._seconds += 1;
            this._publish();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTick() {
        if (this._tickId) {
            this._tracker.timeoutRemove(this._tickId);
            this._tickId = 0;
        }
        this._seconds = 0;
    }

    _publish() {
        if (!this._settings.get_boolean('enable-privacy'))
            return;

        if (this._recording) {
            this._stack.upsert({
                id: 'recording',
                kind: Kind.RECORDING,
                persistent: true,
                payload: {
                    seconds: this._seconds,
                    activate: () => {
                        try {
                            Main.screenshotUI?.stopScreencast?.();
                        } catch {
                            // cannot stop
                        }
                    },
                },
            });
        } else {
            this._stack.remove('recording');
        }

        if (this._mic || this._camera) {
            this._stack.upsert({
                id: 'privacy',
                kind: Kind.PRIVACY,
                persistent: true,
                payload: {mic: this._mic, camera: this._camera},
            });
        } else {
            this._stack.remove('privacy');
        }
    }

    destroy() {
        this._destroyed = true;
        this._stopTick();
        this._tracker.destroy();
        if (this._mixer) {
            try {
                this._mixer.close();
            } catch {
                // already closed
            }
        }
        this._stack.remove('privacy');
        this._stack.remove('recording');
        this._stack = null;
        this._settings = null;
        this._mixer = null;
    }
}
