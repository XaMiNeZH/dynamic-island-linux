// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {Kind} from './activity-stack.js';
import {formatMediaClockUs, formatMediaRemainingUs} from './utils.js';

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
    widget.setArt = nextUrl => widget.setMedia({artUrl: nextUrl});
    widget.setMedia = data => {
        if (data?.artUrl) {
            try {
                widget.gicon = new Gio.FileIcon({file: Gio.File.new_for_uri(data.artUrl)});
                return;
            } catch {
                // fall through
            }
        }
        if (data?.gicon) {
            widget.gicon = data.gicon;
            return;
        }
        widget.gicon = null;
        widget.icon_name = data?.iconName || 'audio-x-generic-symbolic';
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
    clip.setMedia = next => image.setMedia(next);
    return clip;
}

function fractionFromEvent(actor, event) {
    let x = 0;
    try {
        const coords = event.get_coords();
        x = coords[coords.length - 2] ?? coords[0] ?? 0;
    } catch {
        return null;
    }
    let origin = 0;
    try {
        const pos = actor.get_transformed_position();
        origin = pos?.[0] ?? 0;
    } catch {
        origin = 0;
    }
    const width = Math.max(1, actor.width || 1);
    return Math.max(0, Math.min(1, (x - origin) / width));
}

function isPrimaryPress(event) {
    try {
        const type = event.type();
        if (type === Clutter.EventType.TOUCH_BEGIN)
            return true;
        const button = event.get_button();
        return button === 1 || button === Clutter.BUTTON_PRIMARY;
    } catch {
        return true;
    }
}

function connectStage(signal, handler) {
    try {
        const stage = globalThis.global?.stage;
        if (!stage)
            return 0;
        return stage.connect(signal, handler);
    } catch {
        return 0;
    }
}

function disconnectStage(id) {
    if (!id)
        return;
    try {
        globalThis.global?.stage?.disconnect(id);
    } catch {
        // stage already gone
    }
}

function dragBar(styleClass, fraction, {onCommit, onPreview} = {}) {
    const pct = Math.max(0, Math.min(1, fraction ?? 0));
    const track = new St.Widget({
        style_class: `dynamic-island-slider ${styleClass}`.trim(),
        reactive: true,
        track_hover: true,
        x_expand: true,
        y_expand: false,
        y_align: Clutter.ActorAlign.CENTER,
        height: 16,
        layout_manager: new Clutter.BinLayout(),
    });
    const rail = new St.Widget({
        style_class: 'dynamic-island-seek-rail',
        height: 2,
        x_expand: true,
        x_align: Clutter.ActorAlign.FILL,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const fill = new St.Widget({
        style_class: 'dynamic-island-seek-fill',
        height: 3,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.CENTER,
        width: Math.max(0, Math.round(pct * 148)),
    });
    track.add_child(rail);
    track.add_child(fill);

    let dragging = false;
    let capturedId = 0;
    let last = pct;

    const railWidth = () => Math.max(1, track.width || rail.width || 148);

    const apply = (next, animate) => {
        const n = Math.max(0, Math.min(1, next ?? 0));
        last = n;
        const width = Math.round(n * railWidth());
        fill.remove_all_transitions();
        fill.visible = width > 0;
        const target = Math.max(width > 0 ? 2 : 0, width);
        if (animate && width > 0) {
            fill.ease({
                width: target,
                duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
            return n;
        }
        fill.width = target;
        return n;
    };

    const stopCapture = () => {
        disconnectStage(capturedId);
        capturedId = 0;
    };

    const finish = event => {
        if (!dragging)
            return;
        dragging = false;
        stopCapture();
        const next = event ? fractionFromEvent(track, event) : null;
        const n = apply(next ?? last, false);
        onCommit?.(n);
    };

    const preview = (event, animate = false) => {
        const next = fractionFromEvent(track, event);
        if (next == null)
            return;
        apply(next, animate);
        onPreview?.(next);
    };

    const onCaptured = (_stage, event) => {
        if (!dragging)
            return Clutter.EVENT_PROPAGATE;
        const type = event.type();
        if (type === Clutter.EventType.MOTION || type === Clutter.EventType.TOUCH_UPDATE) {
            preview(event);
            return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.BUTTON_RELEASE ||
            type === Clutter.EventType.TOUCH_END ||
            type === Clutter.EventType.TOUCH_CANCEL) {
            finish(event);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    };

    track.connect('button-press-event', (_actor, event) => {
        if (!isPrimaryPress(event))
            return Clutter.EVENT_PROPAGATE;
        dragging = true;
        preview(event);
        stopCapture();
        capturedId = connectStage('captured-event', onCaptured);
        return Clutter.EVENT_STOP;
    });

    track.connect('motion-event', (_actor, event) => {
        if (!dragging || capturedId)
            return Clutter.EVENT_PROPAGATE;
        preview(event);
        return Clutter.EVENT_STOP;
    });

    track.connect('button-release-event', (_actor, event) => {
        if (!dragging || capturedId)
            return Clutter.EVENT_PROPAGATE;
        finish(event);
        return Clutter.EVENT_STOP;
    });

    track.connect('notify::width', () => apply(last, false));
    track.connect('destroy', () => {
        dragging = false;
        stopCapture();
    });

    track.setLevel = next => {
        if (dragging)
            return;
        apply(next, true);
    };
    Object.defineProperty(track, 'dragging', {
        get() {
            return dragging;
        },
    });
    apply(pct, false);
    return track;
}

function iconButton(iconName, callback, extraClass = '', iconSize = null) {
    const size = iconSize ?? (extraClass.includes('compact-play')
        ? 14
        : extraClass.includes('play') ? 18 : 15);
    const button = new St.Button({
        style_class: `dynamic-island-icon-button ${extraClass}`.trim(),
        reactive: true,
        can_focus: true,
        track_hover: true,
        child: new St.Icon({
            icon_name: iconName,
            icon_size: size,
        }),
    });
    button.connect('button-press-event', () => {
        callback();
        return Clutter.EVENT_STOP;
    });
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

function equalizer(playing, options = {}) {
    const accent = options.accent === true;
    const barCount = options.bars ?? (accent ? 5 : 4);
    const minH = accent ? 6 : 4;
    const span = accent ? 14 : 10;
    const palette = ['#ff7a59', '#ff8a55', '#ffb070', '#ff7a59', '#ff9a60'];
    const box = new St.BoxLayout({
        style_class: accent
            ? 'dynamic-island-eq dynamic-island-eq-accent'
            : 'dynamic-island-eq',
        y_align: Clutter.ActorAlign.CENTER,
        x_align: Clutter.ActorAlign.END,
        x_expand: false,
    });
    const bars = [];
    for (let i = 0; i < barCount; i++) {
        const bar = new St.Widget({
            style_class: 'dynamic-island-eq-bar',
            width: 3,
            height: playing ? minH + (i % 3) * 3 : minH,
            y_align: Clutter.ActorAlign.CENTER,
        });
        if (accent)
            bar.style = `background-color: ${palette[i % palette.length]};`;
        box.add_child(bar);
        bars.push(bar);
    }

    let timer = 0;
    const pulse = () => {
        if (!box._playing) {
            for (const bar of bars) {
                bar.remove_all_transitions();
                bar.height = minH;
            }
            return GLib.SOURCE_CONTINUE;
        }
        for (const bar of bars) {
            const next = minH + Math.round(Math.random() * span);
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

function splitChrome({leading = null, trailing = null}) {
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-split',
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const lead = slot(leading, 'leading');
    const mid = new St.Widget({x_expand: true, height: 1});
    const trail = slot(trailing, 'trailing');
    root.add_child(lead);
    root.add_child(mid);
    root.add_child(trail);
    root.leading = lead;
    root.trailing = trail;
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

export function buildIdleView() {
    return new St.Widget({
        style_class: 'dynamic-island-idle',
        x_expand: true,
        y_expand: true,
    });
}

function mediaPlayIcon(playing) {
    return playing
        ? 'media-playback-pause-symbolic'
        : 'media-playback-start-symbolic';
}

export function buildMediaCompact(payload) {
    const hold = {payload};
    const art = artClip(payload?.artUrl, 22);
    art.setMedia(payload);

    const stack = new St.Widget({
        style_class: 'dynamic-island-compact-trail',
        width: 22,
        height: 22,
    });
    const eq = equalizer(payload?.playing === true);
    eq.set_position(2, 4);
    const play = iconButton(
        mediaPlayIcon(payload?.playing === true),
        () => hold.payload?.playPause?.(),
        'is-compact-play',
        14);
    play.set_position(2, 2);
    stack.add_child(eq);
    stack.add_child(play);

    const root = splitChrome({leading: art, trailing: stack});
    root.add_style_class_name('dynamic-island-media-compact');
    root.suppressHoverScale = true;
    root._payload = payload;
    root._hover = false;

    const showHover = hover => {
        eq.opacity = hover ? 0 : 255;
        eq.reactive = !hover;
        play.opacity = hover ? 255 : 0;
        play.reactive = !!hover;
        play.visible = true;
        eq.visible = true;
    };
    showHover(false);

    root.setHover = hover => {
        root._hover = !!hover;
        showHover(root._hover);
    };
    root.update = next => {
        hold.payload = next;
        root._payload = next;
        art.setMedia(next);
        eq.setPlaying(next?.playing === true);
        play.setIconName(mediaPlayIcon(next?.playing === true));
        showHover(root._hover);
    };
    return root;
}

function eventY(event) {
    try {
        const coords = event.get_coords();
        return coords[coords.length - 1] ?? coords[1] ?? 0;
    } catch {
        return 0;
    }
}

function volumeOutput(payload, getPayload) {
    const button = new St.Button({
        style_class: 'dynamic-island-icon-button is-output dynamic-island-volume',
        reactive: true,
        can_focus: true,
        track_hover: true,
        x_align: Clutter.ActorAlign.END,
        y_align: Clutter.ActorAlign.CENTER,
        child: new St.Icon({
            icon_name: volumeIconName(payload?.volume, Kind.VOLUME),
            icon_size: 16,
        }),
    });

    const setLevel = level => {
        button.child.icon_name = volumeIconName(level, Kind.VOLUME);
    };

    const commit = next => {
        const value = Math.max(0, Math.min(1, next));
        getPayload()?.setVolume?.(value);
        setLevel(value);
    };

    button.connect('scroll-event', (_actor, event) => {
        let delta = 0;
        try {
            const direction = event.get_scroll_direction();
            if (direction === Clutter.ScrollDirection.UP)
                delta = 0.06;
            else if (direction === Clutter.ScrollDirection.DOWN)
                delta = -0.06;
            else if (direction === Clutter.ScrollDirection.SMOOTH) {
                const [, dy] = event.get_scroll_delta();
                delta = -dy * 0.06;
            }
        } catch {
            return Clutter.EVENT_STOP;
        }
        commit((getPayload()?.volume ?? 0) + delta);
        return Clutter.EVENT_STOP;
    });

    let dragging = false;
    let capturedId = 0;
    let startY = 0;
    let startVol = 0;

    const stopCapture = () => {
        disconnectStage(capturedId);
        capturedId = 0;
    };

    const finish = () => {
        dragging = false;
        stopCapture();
    };

    const onCaptured = (_stage, event) => {
        if (!dragging)
            return Clutter.EVENT_PROPAGATE;
        const type = event.type();
        if (type === Clutter.EventType.MOTION || type === Clutter.EventType.TOUCH_UPDATE) {
            const dy = startY - eventY(event);
            commit(startVol + dy / 140);
            return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.BUTTON_RELEASE ||
            type === Clutter.EventType.TOUCH_END ||
            type === Clutter.EventType.TOUCH_CANCEL) {
            finish();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    };

    button.connect('button-press-event', (_actor, event) => {
        if (!isPrimaryPress(event))
            return Clutter.EVENT_PROPAGATE;
        dragging = true;
        startY = eventY(event);
        startVol = getPayload()?.volume ?? 0;
        stopCapture();
        capturedId = connectStage('captured-event', onCaptured);
        return Clutter.EVENT_STOP;
    });

    button.connect('destroy', finish);
    button.setLevel = setLevel;
    return button;
}

export function buildMediaExpanded(payload) {
    const root = new St.BoxLayout({
        style_class: 'dynamic-island-media-expanded',
        vertical: true,
        x_expand: true,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    root._payload = payload;
    root.suppressHoverScale = true;

    const top = new St.BoxLayout({
        style_class: 'dynamic-island-row dynamic-island-media-top',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const art = artClip(payload?.artUrl, 52);
    art.setMedia(payload);
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

    const eq = equalizer(payload?.playing === true, {accent: true, bars: 5});
    top.add_child(eq);
    root.add_child(top);

    const lengthUs = payload?.lengthUs ?? 0;
    const positionUs = payload?.positionUs ?? 0;
    const frac = lengthUs > 0 ? positionUs / lengthUs : 0;

    const seekBlock = new St.BoxLayout({
        style_class: 'dynamic-island-seek-block',
        vertical: true,
        x_expand: true,
    });
    const timeRow = new St.BoxLayout({
        style_class: 'dynamic-island-seek-times',
        x_expand: true,
    });
    const elapsed = label(formatMediaClockUs(positionUs), 'dynamic-island-seek-time');
    const remaining = label(
        formatMediaRemainingUs(positionUs, lengthUs),
        'dynamic-island-seek-time is-remaining');
    remaining.clutter_text.line_alignment = Pango.Alignment.RIGHT;
    timeRow.add_child(elapsed);
    timeRow.add_child(new St.Widget({x_expand: true, height: 1}));
    timeRow.add_child(remaining);

    const previewTimes = nextFrac => {
        const length = root._payload?.lengthUs ?? 0;
        const pos = length > 0 ? nextFrac * length : 0;
        elapsed.text = formatMediaClockUs(pos);
        remaining.text = formatMediaRemainingUs(pos, length);
    };

    const seek = dragBar('dynamic-island-seek', frac, {
        onCommit: next => root._payload?.seek?.(next),
        onPreview: previewTimes,
    });
    seekBlock.add_child(timeRow);
    seekBlock.add_child(seek);
    root.add_child(seekBlock);

    const bottom = new St.Widget({
        style_class: 'dynamic-island-media-bottom',
        x_expand: true,
        y_expand: false,
        layout_manager: new Clutter.BinLayout(),
    });
    const controls = new St.BoxLayout({
        style_class: 'dynamic-island-controls',
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const prev = iconButton(
        'media-skip-backward-symbolic',
        () => root._payload?.previous?.(),
        'is-transport-skip',
        18);
    const play = iconButton(
        mediaPlayIcon(payload?.playing === true),
        () => root._payload?.playPause?.(),
        'is-transport-play',
        24);
    const next = iconButton(
        'media-skip-forward-symbolic',
        () => root._payload?.next?.(),
        'is-transport-skip',
        18);
    controls.add_child(prev);
    controls.add_child(play);
    controls.add_child(next);
    bottom.add_child(controls);

    const volume = volumeOutput(payload, () => root._payload);
    volume.x_align = Clutter.ActorAlign.END;
    volume.y_align = Clutter.ActorAlign.CENTER;
    volume.visible = payload?.hasVolume === true;
    bottom.add_child(volume);
    root.add_child(bottom);

    root.update = data => {
        root._payload = data;
        art.setMedia(data);
        title.text = data?.title || 'Not playing';
        artist.text = data?.artist || '';
        play.setIconName(mediaPlayIcon(data?.playing === true));
        eq.setPlaying(data?.playing === true);
        const length = data?.lengthUs ?? 0;
        if (!seek.dragging) {
            seek.setLevel(length > 0 ? (data.positionUs ?? 0) / length : 0);
            elapsed.text = formatMediaClockUs(data?.positionUs);
            remaining.text = formatMediaRemainingUs(data?.positionUs, length);
        }
        const showVolume = data?.hasVolume === true;
        volume.visible = showVolume;
        if (showVolume)
            volume.setLevel(data.volume ?? 0);
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

export function buildPrivacyView(payload) {
    const cam = payload?.camera
        ? icon('camera-web-symbolic', 14)
        : new St.Widget({width: 1, height: 1});
    const mic = payload?.mic
        ? icon('audio-input-microphone-symbolic', 14)
        : new St.Widget({width: 1, height: 1});
    const root = splitChrome({leading: cam, trailing: mic});
    root.update = next => {
        root.leading.replace(next?.camera
            ? icon('camera-web-symbolic', 14)
            : new St.Widget({width: 1, height: 1}));
        root.trailing.replace(next?.mic
            ? icon('audio-input-microphone-symbolic', 14)
            : new St.Widget({width: 1, height: 1}));
    };
    return root;
}

export function buildRecordingView(payload, _clockText, expanded) {
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
    const root = splitChrome({leading: dot, trailing: rec});
    root.add_style_class_name('dynamic-island-recording');
    root.update = next => {
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
            : buildMediaCompact(payload);
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
        return buildRecordingView(payload, clockText, expanded);
    case Kind.IDLE:
    default:
        return buildIdleView();
    }
}
