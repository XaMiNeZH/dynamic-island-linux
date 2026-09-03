// SPDX-License-Identifier: GPL-3.0-or-later

export const UUID = 'dynamic-island@xaminezh.xyz';
export const ROLE = 'dynamic-island';
export const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.dynamic-island';

export const Geometry = {
    idle: {width: 128, height: 28, overlay: false, radius: 14},
    compact: {width: 168, height: 28, overlay: false, radius: 14},
    osd: {width: 228, height: 28, overlay: false, radius: 14},
    system: {width: 220, height: 40, overlay: true, radius: 20},
    notification: {width: 320, height: 68, overlay: true, radius: 22},
    mediaExpanded: {width: 304, height: 92, overlay: true, radius: 24},
};

export function geometryFor(kind, expanded = false) {
    switch (kind) {
    case 'notification':
        return Geometry.notification;
    case 'media':
        return expanded ? Geometry.mediaExpanded : Geometry.compact;
    case 'volume':
    case 'brightness':
    case 'mute':
        return Geometry.osd;
    case 'charging':
    case 'bluetooth':
    case 'privacy':
    case 'recording':
        return expanded ? Geometry.system : Geometry.compact;
    case 'idle':
    default:
        return Geometry.idle;
    }
}
