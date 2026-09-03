// SPDX-License-Identifier: GPL-3.0-or-later

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {
    Geometry,
    compactHeightForPanel,
    compactTopInset,
    fitGeometryToPanel,
    isExpandedGeometry,
} from './constants.js';
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
        this.reactive = false;
        this.can_focus = false;
        this.track_hover = false;

        this._geom = {...Geometry.idle};
        this._morphGen = 0;
        this._contentGen = 0;
        this._chrome = false;

        this._spacer = new St.Widget({
            style_class: 'dynamic-island-spacer',
            width: Geometry.idle.width,
            height: 1,
            x_expand: false,
        });
        this.add_child(this._spacer);

        this._capsule = new St.Bin({
            style_class: 'dynamic-island-capsule',
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_expand: false,
            y_expand: false,
        });
        this._capsule.clip_to_allocation = true;
        this._capsule.set_pivot_point(0.5, 0);
        this._capsule.accessible_name = extension.gettext('Dynamic Island');
        this._capsule.set_size(this._geom.width, this._geom.height);
        this._applyRadius(this._geom.radius);

        this._content = new St.Bin({
            style_class: 'dynamic-island-content',
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            opacity: 255,
        });
        this._capsule.set_child(this._content);

        this._capsule.connect('button-press-event', (_actor, event) => this._onPress(event));
        this._capsule.connect('notify::hover', () => this._onHover());
        this._tryClickGesture(this._capsule);

        this._mountChrome();
        this._bindPanel();
        this.relayout(false);

        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this.relayout(false));
    }

    _mountChrome() {
        try {
            Main.layoutManager.addChrome(this._capsule, {
                affectsInputRegion: true,
                affectsStruts: false,
            });
            this._chrome = true;
        } catch {
            Main.layoutManager.uiGroup.add_child(this._capsule);
            this._chrome = false;
        }
        try {
            this._capsule.get_parent()?.set_child_above_sibling(this._capsule, null);
        } catch {
            // stacking not available
        }
    }

    _unmountChrome() {
        if (this._chrome) {
            try {
                Main.layoutManager.removeChrome(this._capsule);
            } catch {
                const parent = this._capsule.get_parent();
                parent?.remove_child(this._capsule);
            }
            this._chrome = false;
            return;
        }
        const parent = this._capsule.get_parent();
        parent?.remove_child(this._capsule);
    }

    _tryClickGesture(actor) {
        if (!Clutter.ClickGesture)
            return;
        try {
            const gesture = new Clutter.ClickGesture();
            if (gesture.set_recognize_on_press)
                gesture.set_recognize_on_press(false);
            gesture.connect('recognize', () => this.emit('primary-click'));
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

    _onHover() {
        const hover = this._capsule.hover;
        this._capsule.ease({
            scale_x: hover ? 1.03 : 1.0,
            scale_y: hover ? 1.03 : 1.0,
            duration: 160,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        if (hover)
            this._capsule.add_style_class_name('is-hover');
        else
            this._capsule.remove_style_class_name('is-hover');
    }

    bounce() {
        this._capsule.remove_all_transitions();
        this._capsule.set_pivot_point(0.5, 0);
        this._capsule.scale_x = 1;
        this._capsule.scale_y = 1;
        this._capsule.ease({
            scale_x: 1.08,
            scale_y: 1.08,
            duration: 90,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._capsule.ease({
                    scale_x: 1,
                    scale_y: 1,
                    duration: 240,
                    mode: Clutter.AnimationMode.EASE_OUT_BACK,
                });
            },
        });
    }

    setContent(actor, {fade = true} = {}) {
        const prev = this._content.get_child();
        if (!fade || !prev) {
            this._content.set_child(actor);
            if (prev && prev !== actor)
                prev.destroy();
            this._content.opacity = 255;
            return Promise.resolve();
        }

        const gen = ++this._contentGen;
        this._content.remove_all_transitions();
        return new Promise(resolve => {
            this._content.ease({
                opacity: 0,
                duration: 90,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._content.get_child() !== actor) {
                        this._content.set_child(actor);
                        if (prev && prev !== actor)
                            prev.destroy();
                    }
                    this._content.opacity = 0;
                    this._content.ease({
                        opacity: 255,
                        duration: 180,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                        onComplete: resolve,
                        onStopped: resolve,
                    });
                },
                onStopped: () => {
                    if (gen !== this._contentGen) {
                        resolve();
                        return;
                    }
                    this._content.set_child(actor);
                    if (prev && prev !== actor)
                        prev.destroy();
                    this._content.opacity = 255;
                    resolve();
                },
            });
        });
    }

    updateClock(text) {
        const child = this._content.get_child();
        if (child?.updateClock)
            child.updateClock(text);
    }

    get geometry() {
        return this._geom;
    }

    _bindPanel() {
        const box = Main.layoutManager.panelBox;
        this._panelIds = [];
        if (box) {
            for (const prop of ['allocation', 'height', 'y', 'x']) {
                try {
                    this._panelIds.push(box.connect(`notify::${prop}`, () => this.relayout(false)));
                } catch {
                    // property not available on this Shell
                }
            }
        }
        try {
            this._startupId = Main.layoutManager.connect('startup-complete', () => this.relayout(false));
        } catch {
            this._startupId = 0;
        }
    }

    _unbindPanel() {
        const box = Main.layoutManager.panelBox;
        if (box && this._panelIds?.length) {
            for (const id of this._panelIds) {
                try {
                    box.disconnect(id);
                } catch {
                    // already gone
                }
            }
        }
        this._panelIds = [];
        if (this._startupId) {
            try {
                Main.layoutManager.disconnect(this._startupId);
            } catch {
                // already gone
            }
            this._startupId = 0;
        }
    }

    _panelRect() {
        const monitor = Main.layoutManager.primaryMonitor;
        const panelBox = Main.layoutManager.panelBox;
        const fallback = {
            x: monitor?.x ?? 0,
            y: monitor?.y ?? 0,
            width: monitor?.width ?? 0,
            height: Main.panel?.height || 32,
        };

        if (!panelBox)
            return fallback;

        let x = Number.isFinite(panelBox.x) ? panelBox.x : fallback.x;
        let y = Number.isFinite(panelBox.y) ? panelBox.y : fallback.y;
        let width = panelBox.width || fallback.width;
        let height = panelBox.height || fallback.height;

        try {
            const pos = panelBox.get_transformed_position?.();
            if (Array.isArray(pos) && pos.length >= 2 &&
                Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
                const parent = this._capsule?.get_parent();
                const panelParent = panelBox.get_parent();
                if (!parent || parent === panelParent) {
                    x = panelBox.x;
                    y = panelBox.y;
                } else {
                    x = pos[0];
                    y = pos[1];
                }
            }
        } catch {
            // keep actor x/y
        }

        const panelHeight = Main.panel?.height;
        if (panelHeight > 0)
            height = panelHeight;
        if (!(height > 0))
            height = fallback.height;
        if (!(width > 0))
            width = fallback.width;

        return {x, y, width, height};
    }

    fitGeometry(geom) {
        return fitGeometryToPanel(geom, this._panelRect().height);
    }

    _targetBox(geom) {
        const panel = this._panelRect();
        const monitor = Main.layoutManager.primaryMonitor;
        const resolved = this.fitGeometry(geom);
        const compactHeight = resolved.compact === false
            ? compactHeightForPanel(panel.height)
            : resolved.height;
        const inset = compactTopInset(panel.height, compactHeight);
        const screenX = monitor?.x ?? panel.x;
        const screenW = monitor?.width ?? panel.width;
        return {
            x: screenX + Math.round((screenW - resolved.width) / 2),
            y: panel.y + inset,
        };
    }

    _applyRadius(radius) {
        this._capsule.style = `border-radius: ${radius}px;`;
    }

    relayout(animate = false) {
        this._geom = this.fitGeometry(this._geom);
        const box = this._targetBox(this._geom);
        if (animate) {
            this.morphTo(this._geom);
            return;
        }
        this._capsule.set_position(box.x, box.y);
        this._capsule.set_size(this._geom.width, this._geom.height);
        this._applyRadius(this._geom.radius);
        this._spacer.width = Geometry.idle.width;
    }

    async morphTo(geom, durationMs = 420) {
        if (!geom)
            return;
        const resolved = this.fitGeometry(geom);
        if (sameGeometry(this._geom, resolved) && !this._capsule.get_transition('width')) {
            this.relayout(false);
            return;
        }

        this._geom = {...resolved};
        this._applyRadius(resolved.radius ?? 17);
        if (isExpandedGeometry(resolved))
            this._capsule.add_style_class_name('is-expanded');
        else
            this._capsule.remove_style_class_name('is-expanded');

        const box = this._targetBox(resolved);
        const props = {
            x: box.x,
            y: box.y,
            width: resolved.width,
            height: resolved.height,
            duration: durationMs,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
        };

        this._morphGen++;
        const gen = this._morphGen;
        this._capsule.remove_all_transitions();

        try {
            if (this._capsule.easeAsync) {
                try {
                    await this._capsule.easeAsync(props);
                } catch {
                    // superseded
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
            if (gen === this._morphGen)
                this.relayout(false);
        }
    }

    forceIdle() {
        this._geom = this.fitGeometry(Geometry.idle);
        this._capsule.remove_style_class_name('is-expanded');
        this._capsule.scale_x = 1;
        this._capsule.scale_y = 1;
        this.relayout(false);
    }

    destroy() {
        if (this._monitorsId) {
            Main.layoutManager.disconnect(this._monitorsId);
            this._monitorsId = 0;
        }
        this._unbindPanel();
        this._unmountChrome();
        this._capsule.destroy();
        super.destroy();
    }
});
