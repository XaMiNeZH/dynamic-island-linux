// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {Kind} from './activity-stack.js';

function label(text, styleClass, expand = false) {
    const widget = new St.Label({
        text: text ?? '',
        style_class: styleClass,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: expand,
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
    widget.setArt = nextUrl => {
        if (nextUrl) {
            try {
                widget.gicon = new Gio.FileIcon({file: Gio.File.new_for_uri(nextUrl)});
                return;
            } catch {
                // fall through
            }
        }
        widget.gicon = null;
        widget.icon_name = 'audio-x-generic-symbolic';
    };
    return widget;
}

function artClip(url, size) {
    const clip = new St.Bin({
        style_class: 'dynamic-island-art-clip',
        width: size,
        height: size,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
    clip.clip_to_allocation = true;
    const image = artIcon(url, size);
    clip.set_child(image);
    clip.setArt = next => image.setArt(next);
    return clip;
}

function iconButton(iconName, callback, extraClass = '') {
    const button = new St.Button({
        style_class: `dynamic-island-icon-button ${extraClass}`.trim(),
        reactive: true,
        can_focus: true,
        track_hover: true,
        child: new St.Icon({
            icon_name: iconName,
            icon_size: extraClass.includes('play') ? 18 : 15,
        }),
    });
    button.connect('clicked', () => callback());
    button.connect('button-press-event', () => Clutter.EVENT_STOP);
    button.setIconName = name => {
        button.child.icon_name = name;
    };
    return button;
}

function levelBar(value) {
    const pct = Math.max(0, Math.min(1, value ?? 0));
    const track = new St.Widget({
        style_class: 'dynamic-island-level',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        y_expand: false,
    });
    const fill = new St.Widget({
        style_class: 'dynamic-island-level-fill',
        height: 5,
        width: Math.max(5, Math.round(pct * 148)),
    });
    track.add_child(fill);
    track.setLevel = next => {
        const n = Math.max(0, Math.min(1, next ?? 0));
        fill.ease({
            width: Math.max(5, Math.round(n * 148)),
            duration: 140,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    };
    return track;
}

function equalizer(playing) {
    const box = new St.BoxLayout({
        style_class: 'dynamic-island-eq',
        y_align: Clutter.ActorAlign.CENTER,
        x_align: Clutter.ActorAlign.END,
    });
    const bars = [];
    for (let i = 0; i < 4; i++) {
        const bar = new St.Widget({
            style_class: 'dynamic-island-eq-bar',
            width: 3,
            height: playing ? 6 + (i % 3) * 3 : 4,
        });
        box.add_child(bar);
        bars.push(bar);
    }

    let timer = 0;
    const pulse = () => {
        if (!box._playing) {
            for (const bar of bars) {
                bar.remove_all_transitions();
                bar.height = 4;
            }
            return GLib.SOURCE_CONTINUE;
        }
        for (const bar of bars) {
            const next = 4 + Math.round(Math.random() * 10);
            bar.ease({
                height: next,
                duration: 140,
                mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
            });
        }
        return GLib.SOURCE_CONTINUE;
    };

    box._playing = !!playing;
    if (playing)
        timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, pulse);

    box.setPlaying = next => {
        box._playing = !!next;
        if (next && !timer)
            timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, pulse);
        if (!next)
            pulse();
    };

    box.connect('destroy', () => {
        if (timer) {
            GLib.source_remove(timer);
            timer = 0;
        }
    });
    return box;
}

function slot(child, side) {
    const bin = new St.Bin({
        style_class: `dynamic-island-slot dynamic-island-slot-${side}`,
        x_align: side === 'leading' ? Clutter.ActorAlign.START : Clutter.ActorAlign.END,
        y_align: Clutter.ActorAlign.CENTER,
        width: 28,
        x_expand: false,
    });
    if (child)
        bin.set_child(child);
    bin.replace = next => {
        const prev = bin.get_child();
        bin.set_child(next);
        prev?.destroy();
    };
    return bin;
}

function splitChrome({leading = null, trailing = null, clockText = ''}) {
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-split',
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const lead = slot(leading, 'leading');
    const clock = label(clockText ?? '', 'dynamic-island-clock', true);
    clock.x_align = Clutter.ActorAlign.CENTER;
    const trail = slot(trailing, 'trailing');
    root.add_child(lead);
    root.add_child(clock);
    root.add_child(trail);
    root.updateClock = text => {
        clock.text = text ?? '';
    };
    root.leading = lead;
    root.trailing = trail;
    root.clock = clock;
    return root;
}

function volumeIconName(level, kind) {
    if (kind === Kind.BRIGHTNESS)
        return 'display-brightness-symbolic';
    if (kind === Kind.MUTE)
        return level === 0
            ? 'microphone-sensitivity-muted-symbolic'
            : 'microphone-sensitivity-high-symbolic';
    if (level == null)
        return 'audio-volume-medium-symbolic';
    if (level <= 0.01)
        return 'audio-volume-muted-symbolic';
    if (level < 0.34)
        return 'audio-volume-low-symbolic';
    if (level < 0.67)
        return 'audio-volume-medium-symbolic';
    return 'audio-volume-high-symbolic';
}

export function buildIdleView(clockText) {
    const clock = label(clockText ?? '', 'dynamic-island-clock');
    const box = new St.BoxLayout({
        style_class: 'dynamic-island-idle',
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
    box.add_child(clock);
    box.updateClock = text => {
        clock.text = text ?? '';
    };
    return box;
}

export function buildMediaCompact(payload, clockText) {
    const art = artClip(payload?.artUrl, 22);
    const eq = equalizer(payload?.playing !== false);
    const root = splitChrome({leading: art, trailing: eq, clockText});
    root.update = next => {
        art.setArt(next?.artUrl);
        eq.setPlaying(next?.playing !== false);
    };
    return root;
}

export function buildMediaExpanded(payload) {
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-media-expanded',
        vertical: true,
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });

    const top = new St.BoxLayout({
        style_class: 'dynamic-island-row',
        x_expand: true,
    });
    const art = artClip(payload?.artUrl, 52);
    top.add_child(art);

    const textCol = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'dynamic-island-text-col',
    });
    const title = label(payload?.title || 'Not playing', 'dynamic-island-title', true);
    const artist = label(payload?.artist || '', 'dynamic-island-subtitle', true);
    textCol.add_child(title);
    textCol.add_child(artist);
    top.add_child(textCol);
    root.add_child(top);

    const controls = new St.BoxLayout({
        style_class: 'dynamic-island-controls',
        x_align: Clutter.ActorAlign.CENTER,
    });
    root._payload = payload;
    const prev = iconButton('media-skip-backward-symbolic', () => root._payload?.previous?.());
    const play = iconButton(
        payload?.playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic',
        () => root._payload?.playPause?.(),
        'is-play');
    const next = iconButton('media-skip-forward-symbolic', () => root._payload?.next?.());
    controls.add_child(prev);
    controls.add_child(play);
    controls.add_child(next);
    root.add_child(controls);

    root.update = data => {
        root._payload = data;
        art.setArt(data?.artUrl);
        title.text = data?.title || 'Not playing';
        artist.text = data?.artist || '';
        play.setIconName(data?.playing
            ? 'media-playback-pause-symbolic'
            : 'media-playback-start-symbolic');
    };
    return root;
}

export function buildNotificationView(payload) {
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-notification',
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const badge = new St.Bin({
        style_class: 'dynamic-island-app-badge',
        width: 40,
        height: 40,
    });
    badge.clip_to_allocation = true;
    badge.set_child(iconFromGicon(payload?.gicon, payload?.iconName || 'dialog-information-symbolic', 28));
    root.add_child(badge);

    const textCol = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'dynamic-island-text-col',
    });
    textCol.add_child(label(payload?.title || '', 'dynamic-island-title', true));
    textCol.add_child(label(payload?.body || '', 'dynamic-island-subtitle', true));
    root.add_child(textCol);
    return root;
}

export function buildOsdView(payload) {
    const kind = payload?.kind;
    const iconName = payload?.iconName || volumeIconName(payload?.level, kind);
    const glyph = icon(iconName, 16);
    const bar = payload?.level != null ? levelBar(payload.level) : null;
    const percent = payload?.level != null
        ? `${Math.round(payload.level * 100)}`
        : (payload?.label ?? '');
    const pct = label(percent, 'dynamic-island-osd-label');

    const root = new St.BoxLayout({
        style_class: 'dynamic-island-osd',
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    root.add_child(glyph);
    if (bar)
        root.add_child(bar);
    root.add_child(pct);

    root.update = next => {
        glyph.icon_name = next?.iconName || volumeIconName(next?.level, next?.kind ?? kind);
        if (bar && next?.level != null)
            bar.setLevel(next.level);
        if (next?.level != null)
            pct.text = `${Math.round(next.level * 100)}`;
        else if (next?.label)
            pct.text = next.label;
    };
    return root;
}

export function buildChargingView(payload) {
    const charging = payload?.charging !== false;
    const percent = Math.round(payload?.percent ?? 0);
    const title = label(charging ? `Charging  ${percent}%` : `${percent}%`, 'dynamic-island-title');
    const glyph = icon(charging ? 'battery-level-100-charged-symbolic' : 'battery-symbolic', 18);
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-system',
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
    root.add_child(glyph);
    root.add_child(title);
    root.update = next => {
        const on = next?.charging !== false;
        const n = Math.round(next?.percent ?? 0);
        glyph.icon_name = on ? 'battery-level-100-charged-symbolic' : 'battery-symbolic';
        title.text = on ? `Charging  ${n}%` : `${n}%`;
    };
    return root;
}

export function buildBluetoothView(payload) {
    const title = label(payload?.name ? payload.name : 'Connected', 'dynamic-island-title');
    const sub = label('Bluetooth', 'dynamic-island-subtitle');
    const textCol = new St.BoxLayout({
        vertical: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'dynamic-island-text-col',
    });
    textCol.add_child(title);
    textCol.add_child(sub);
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-system',
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    root.add_child(icon('bluetooth-active-symbolic', 18));
    root.add_child(textCol);
    return root;
}

export function buildPrivacyView(payload, clockText) {
    const cam = payload?.camera
        ? icon('camera-web-symbolic', 14)
        : new St.Widget({width: 1, height: 1});
    const mic = payload?.mic
        ? icon('audio-input-microphone-symbolic', 14)
        : new St.Widget({width: 1, height: 1});
    const root = splitChrome({leading: cam, trailing: mic, clockText});
    root.update = (next, clock) => {
        if (clock != null)
            root.updateClock(clock);
        root.leading.replace(next?.camera
            ? icon('camera-web-symbolic', 14)
            : new St.Widget({width: 1, height: 1}));
        root.trailing.replace(next?.mic
            ? icon('audio-input-microphone-symbolic', 14)
            : new St.Widget({width: 1, height: 1}));
    };
    return root;
}

export function buildRecordingView(payload, clockText, expanded) {
    if (expanded) {
        let time = 'Recording';
        if (payload?.seconds != null) {
            const minutes = Math.floor(payload.seconds / 60);
            const seconds = payload.seconds % 60;
            time = `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
        const title = label(time, 'dynamic-island-title');
        const root = new St.BoxLayout({
            style_class: 'dynamic-island-recording dynamic-island-system',
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        root.add_child(icon('media-record-symbolic', 16));
        root.add_child(title);
        root.update = next => {
            if (next?.seconds != null) {
                const minutes = Math.floor(next.seconds / 60);
                const seconds = next.seconds % 60;
                title.text = `${minutes}:${String(seconds).padStart(2, '0')}`;
            }
        };
        return root;
    }

    const dot = new St.Widget({style_class: 'dynamic-island-rec-dot', width: 8, height: 8});
    let recText = 'REC';
    if (payload?.seconds != null) {
        const minutes = Math.floor(payload.seconds / 60);
        const seconds = payload.seconds % 60;
        recText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    const rec = label(recText, 'dynamic-island-rec-time');
    const root = splitChrome({leading: dot, trailing: rec, clockText});
    root.add_style_class_name('dynamic-island-recording');
    root.update = (next, clock) => {
        if (clock != null)
            root.updateClock(clock);
        if (next?.seconds != null) {
            const minutes = Math.floor(next.seconds / 60);
            const seconds = next.seconds % 60;
            rec.text = `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
    };
    return root;
}

export function buildView(activity, clockText) {
    const {kind, payload, expanded} = activity;
    switch (kind) {
    case Kind.MEDIA:
        return expanded
            ? buildMediaExpanded(payload)
            : buildMediaCompact(payload, clockText);
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
        return buildPrivacyView(payload, clockText);
    case Kind.RECORDING:
        return buildRecordingView(payload, clockText, expanded);
    case Kind.IDLE:
    default:
        return buildIdleView(clockText);
    }
}
