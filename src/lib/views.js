// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {Kind} from './activity-stack.js';

function label(text, styleClass) {
    const widget = new St.Label({
        text: text ?? '',
        style_class: styleClass,
        y_align: Clutter.ActorAlign.CENTER,
    });
    widget.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    widget.clutter_text.single_line_mode = true;
    return widget;
}

function icon(name, size = 16) {
    return new St.Icon({
        icon_name: name || 'dialog-information-symbolic',
        icon_size: size,
        style_class: 'dynamic-island-icon',
        y_align: Clutter.ActorAlign.CENTER,
    });
}

function iconFromGicon(gicon, fallback, size = 20) {
    const widget = new St.Icon({
        icon_size: size,
        style_class: 'dynamic-island-icon',
        y_align: Clutter.ActorAlign.CENTER,
    });
    if (gicon)
        widget.gicon = gicon;
    else
        widget.icon_name = fallback;
    return widget;
}

function artIcon(url, size = 22) {
    const widget = new St.Icon({
        icon_size: size,
        style_class: 'dynamic-island-art',
        y_align: Clutter.ActorAlign.CENTER,
        icon_name: 'audio-x-generic-symbolic',
    });
    if (url) {
        try {
            widget.gicon = new Gio.FileIcon({file: Gio.File.new_for_uri(url)});
        } catch {
            widget.icon_name = 'audio-x-generic-symbolic';
        }
    }
    return widget;
}

function iconButton(iconName, callback) {
    const button = new St.Button({
        style_class: 'dynamic-island-icon-button',
        reactive: true,
        can_focus: true,
        track_hover: true,
        child: new St.Icon({
            icon_name: iconName,
            icon_size: 16,
        }),
    });
    button.connect('clicked', () => callback());
    button.connect('button-press-event', () => Clutter.EVENT_STOP);
    return button;
}

function levelBar(value) {
    const pct = Math.max(0, Math.min(1, value ?? 0));
    const track = new St.Widget({
        style_class: 'dynamic-island-level',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        height: 4,
    });
    const fill = new St.Widget({
        style_class: 'dynamic-island-level-fill',
        height: 4,
        width: Math.round(pct * 120),
    });
    track.add_child(fill);
    track.setLevel = next => {
        const n = Math.max(0, Math.min(1, next ?? 0));
        fill.width = Math.round(n * 120);
    };
    return track;
}

function row(children, extraClass = '') {
    const box = new St.BoxLayout({
        style_class: `dynamic-island-row ${extraClass}`.trim(),
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });
    for (const child of children)
        box.add_child(child);
    return box;
}

export function buildIdleView(clockText) {
    const clock = label(clockText ?? '', 'dynamic-island-clock');
    const box = row([clock], 'dynamic-island-idle');
    box.updateClock = text => {
        clock.text = text ?? '';
    };
    return box;
}

export function buildMediaCompact(payload) {
    const playing = payload?.playing !== false;
    return row([
        artIcon(payload?.artUrl, 20),
        icon(playing ? 'media-playback-start-symbolic' : 'media-playback-pause-symbolic', 14),
    ], 'dynamic-island-media-compact');
}

export function buildMediaExpanded(payload) {
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-media-expanded',
        vertical: true,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });

    const top = new St.BoxLayout({
        style_class: 'dynamic-island-row',
        x_expand: true,
    });
    top.add_child(artIcon(payload?.artUrl, 44));

    const textCol = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'dynamic-island-text-col',
    });
    textCol.add_child(label(payload?.title || 'Not playing', 'dynamic-island-title'));
    textCol.add_child(label(payload?.artist || '', 'dynamic-island-subtitle'));
    top.add_child(textCol);
    root.add_child(top);

    const controls = new St.BoxLayout({
        style_class: 'dynamic-island-controls',
        x_align: Clutter.ActorAlign.CENTER,
    });
    controls.add_child(iconButton('media-skip-backward-symbolic', () => payload?.previous?.()));
    controls.add_child(iconButton(
        payload?.playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic',
        () => payload?.playPause?.()));
    controls.add_child(iconButton('media-skip-forward-symbolic', () => payload?.next?.()));
    root.add_child(controls);
    return root;
}

export function buildNotificationView(payload) {
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-notification',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    root.add_child(iconFromGicon(payload?.gicon, payload?.iconName || 'dialog-information-symbolic', 28));

    const textCol = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'dynamic-island-text-col',
    });
    textCol.add_child(label(payload?.title || '', 'dynamic-island-title'));
    textCol.add_child(label(payload?.body || '', 'dynamic-island-subtitle'));
    root.add_child(textCol);
    return root;
}

export function buildOsdView(payload) {
    const kind = payload?.kind;
    let iconName = payload?.iconName;
    if (!iconName) {
        if (kind === Kind.BRIGHTNESS)
            iconName = 'display-brightness-symbolic';
        else if (kind === Kind.MUTE)
            iconName = 'microphone-sensitivity-muted-symbolic';
        else
            iconName = 'audio-volume-medium-symbolic';
    }

    const children = [icon(iconName, 16)];
    if (payload?.level != null)
        children.push(levelBar(payload.level));
    const percent = payload?.level != null
        ? `${Math.round(payload.level * 100)}%`
        : (payload?.label ?? '');
    if (percent)
        children.push(label(percent, 'dynamic-island-osd-label'));
    return row(children, 'dynamic-island-osd');
}

export function buildChargingView(payload) {
    const charging = payload?.charging !== false;
    const percent = Math.round(payload?.percent ?? 0);
    return row([
        icon(charging ? 'battery-level-100-charged-symbolic' : 'battery-symbolic', 16),
        label(charging ? `Charging  ${percent}%` : `${percent}%`, 'dynamic-island-title'),
    ], 'dynamic-island-system');
}

export function buildBluetoothView(payload) {
    return row([
        icon('bluetooth-active-symbolic', 16),
        label(payload?.name ? `Connected  ${payload.name}` : 'Bluetooth connected', 'dynamic-island-title'),
    ], 'dynamic-island-system');
}

export function buildPrivacyView(payload) {
    const parts = [];
    if (payload?.camera)
        parts.push('Camera');
    if (payload?.mic)
        parts.push('Mic');
    const text = parts.length ? `${parts.join(' · ')} in use` : 'Privacy';
    return row([
        icon(payload?.camera ? 'camera-web-symbolic' : 'audio-input-microphone-symbolic', 16),
        label(text, 'dynamic-island-title'),
    ], 'dynamic-island-system');
}

export function buildRecordingView(payload) {
    let time = 'REC';
    if (payload?.seconds != null) {
        const minutes = Math.floor(payload.seconds / 60);
        const seconds = payload.seconds % 60;
        time = `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    return row([
        icon('media-record-symbolic', 14),
        label(time, 'dynamic-island-title'),
    ], 'dynamic-island-recording');
}

export function buildView(activity, clockText) {
    const {kind, payload, expanded} = activity;
    switch (kind) {
    case Kind.MEDIA:
        return expanded ? buildMediaExpanded(payload) : buildMediaCompact(payload);
    case Kind.NOTIFICATION:
        return buildNotificationView(payload);
    case Kind.VOLUME:
    case Kind.BRIGHTNESS:
    case Kind.MUTE:
        return buildOsdView({...payload, kind});
    case Kind.CHARGING:
        return buildChargingView(payload);
    case Kind.BLUETOOTH:
        return buildBluetoothView(payload);
    case Kind.PRIVACY:
        return buildPrivacyView(payload);
    case Kind.RECORDING:
        return expanded ? buildRecordingView(payload) : buildRecordingView(payload);
    case Kind.IDLE:
    default:
        return buildIdleView(clockText);
    }
}
