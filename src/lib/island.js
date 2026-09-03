// SPDX-License-Identifier: GPL-3.0-or-later

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {sameGeometry} from './motion.js';

export const Island = GObject.registerClass({
    GTypeName: 'DynamicIslandChrome',
    Signals: {
        'primary-click': {},
        'secondary-click': {},
    },
}, class Island extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, extension.gettext('Dynamic Island'), true);
        this._extension = extension;
        this.add_style_class_name('dynamic-island-button');
        this.accessible_role = Atk.Role.PUSH_BUTTON;
        this.accessible_name = extension.gettext('Dynamic Island');

        this._inOverlay = false;
        this._geom = {width: 128, height: 28, overlay: false, radius: 14};
        this._morphing = false;
        this._spacer = null;

        this._capsule = new St.Bin({
            style_class: 'dynamic-island-capsule',
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._capsule.clip_to_allocation = true;
        this._capsule.set_size(this._geom.width, this._geom.height);

        this._content = new St.Bin({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._capsule.set_child(this._content);
        this.add_child(this._capsule);

        this._capsule.connect('button-press-event', (_actor, event) => this._onPress(event));
        this._tryClickGesture(this._capsule);

        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => {
            if (this._inOverlay)
                this._positionOverlay();
        });
    }

    _tryClickGesture(actor) {
        if (!Clutter.ClickGesture)
            return;
        try {
            const gesture = new Clutter.ClickGesture();
            if (gesture.set_recognize_on_press)
                gesture.set_recognize_on_press(false);
            gesture.connect('recognize', () => {
                this.emit('primary-click');
            });
            actor.add_action(gesture);
            this._clickGesture = gesture;
        } catch {
            this._clickGesture = null;
        }
    }

    _onPress(event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_SECONDARY || button === 3) {
            this.emit('secondary-click');
            return Clutter.EVENT_STOP;
        }
        if (button === Clutter.BUTTON_PRIMARY || button === 1) {
            if (!this._clickGesture)
                this.emit('primary-click');
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_event(event) {
        const type = event.type();
        if (type === Clutter.EventType.BUTTON_PRESS ||
            type === Clutter.EventType.TOUCH_BEGIN) {
            if (type === Clutter.EventType.BUTTON_PRESS)
                return this._onPress(event);
            if (!this._clickGesture)
                this.emit('primary-click');
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    setContent(actor) {
        const prev = this._content.get_child();
        this._content.set_child(actor);
        if (prev && prev !== actor)
            prev.destroy();
    }

    updateClock(text) {
        const child = this._content.get_child();
        if (child?.updateClock)
            child.updateClock(text);
    }

    get geometry() {
        return this._geom;
    }

    async morphTo(geom, durationMs = 360) {
        if (!geom)
            return;
        if (sameGeometry(this._geom, geom) && !this._morphing)
            return;

        this._geom = {...geom};
        const overlay = !!geom.overlay;

        if (overlay && !this._inOverlay)
            this._lift();
        else if (!overlay && this._inOverlay)
            this._dock();

        this._capsule.style = `border-radius: ${geom.radius ?? 14}px;`;

        if (this._inOverlay)
            this._positionOverlay();

        const props = {
            width: geom.width,
            height: geom.height,
            duration: durationMs,
            mode: overlay
                ? Clutter.AnimationMode.EASE_OUT_BACK
                : Clutter.AnimationMode.EASE_OUT_CUBIC,
        };

        this._morphing = true;
        try {
            if (this._capsule.easeAsync) {
                try {
                    await this._capsule.easeAsync(props);
                } catch {
                    // cancelled by a newer morph
                }
            } else {
                await new Promise(resolve => {
                    this._capsule.ease({
                        ...props,
                        onComplete: resolve,
                        onStopped: resolve,
                    });
                });
            }
        } finally {
            this._morphing = false;
        }

        if (this._inOverlay)
            this._positionOverlay();
    }

    _lift() {
        if (this._inOverlay)
            return;

        const parent = this._capsule.get_parent();
        if (parent)
            parent.remove_child(this._capsule);

        if (!this._spacer) {
            this._spacer = new St.Widget({
                style_class: 'dynamic-island-spacer',
                width: 128,
                height: 1,
                x_expand: false,
            });
            this.add_child(this._spacer);
        }

        Main.layoutManager.uiGroup.add_child(this._capsule);
        this._capsule.add_style_class_name('dynamic-island-overlay');
        this._inOverlay = true;
        this._positionOverlay();
    }

    _dock() {
        if (!this._inOverlay)
            return;

        const parent = this._capsule.get_parent();
        if (parent)
            parent.remove_child(this._capsule);

        if (this._spacer) {
            this.remove_child(this._spacer);
            this._spacer.destroy();
            this._spacer = null;
        }

        this._capsule.remove_style_class_name('dynamic-island-overlay');
        this.add_child(this._capsule);
        this._inOverlay = false;
    }

    _positionOverlay() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const width = this._geom.width;
        const x = monitor.x + Math.round((monitor.width - width) / 2);
        const y = monitor.y + 6;
        this._capsule.set_position(x, y);
        try {
            this._capsule.get_parent()?.set_child_above_sibling(this._capsule, null);
        } catch {
            // stacking not available
        }
    }

    forceDock() {
        this._dock();
        this._geom = {width: 128, height: 28, overlay: false, radius: 14};
        this._capsule.set_size(this._geom.width, this._geom.height);
        this._capsule.style = `border-radius: ${this._geom.radius}px;`;
    }

    destroy() {
        if (this._monitorsId) {
            Main.layoutManager.disconnect(this._monitorsId);
            this._monitorsId = 0;
        }
        this._dock();
        super.destroy();
    }
});
